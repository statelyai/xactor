import { ActorSystem, Behavior } from '../src';
import * as behaviors from '../src/BehaviorImpl';
import { ActorRef } from '../src/ActorRef';
import { BehaviorTag, Logger, ActorSignal } from '../src/Behavior';

describe('ActorSystem', () => {
  it('simple test', (done) => {
    const rootBehavior: Behavior<any> = {
      _tag: BehaviorTag.Default, // TODO: make this default
      receive(_, event: any) {
        expect(event).toEqual({ type: 'hey' });
        done();
        return rootBehavior;
      },
    };

    const system = new ActorSystem(rootBehavior, 'hello');

    system.send({ type: 'hey' });
  });

  it('First example', (done) => {
    interface Greet {
      whom: string;
      replyTo: ActorRef<Greeted>;
    }
    interface Greeted {
      whom: string;
      from: ActorRef<Greet>;
    }

    interface SayHello {
      name: string;
    }

    const HelloWorld = behaviors.receive<Greet>((ctx, message) => {
      ctx.log(`Hello ${message.whom}!`);

      message.replyTo.send({
        whom: message.whom,
        from: ctx.self,
      });
      return BehaviorTag.Same;
    });

    const HelloWorldBot = (max: number) => {
      const bot = (greetingCounter: number, max: number): Behavior<Greeted> => {
        return behaviors.receive((ctx, message) => {
          const n = greetingCounter + 1;
          ctx.log(`Greeting ${n} for ${message.whom}`);
          if (n === max) {
            return {
              receive: () => {
                /* do nothing */
              },
            } as any;
          } else {
            message.from.send({
              whom: message.whom,
              replyTo: ctx.self,
            });
            return bot(n, max);
          }
        });
      };

      return bot(0, max);
    };

    const HelloWorldMain = behaviors.setup<SayHello>((ctx) => {
      const greeter = ctx.spawn(HelloWorld, 'greeter');

      return behaviors.receive((_, message) => {
        const replyTo = ctx.spawn(HelloWorldBot(3), message.name);
        greeter.send({
          whom: message.name,
          replyTo,
        });

        return BehaviorTag.Same;
      });
    });

    const system = new ActorSystem(HelloWorldMain, 'hello');

    system.send({ name: 'World' });
    system.send({ name: 'Akka' });

    setTimeout(() => {
      done();
    }, 1000);
  });

  it('more complex example', (done) => {
    interface GetSession {
      type: 'GetSession';
      screenName: string;
      replyTo: ActorRef<SessionEvent>;
    }

    type RoomCommand = GetSession | PublishSessionMessage;

    interface SessionGranted {
      type: 'SessionGranted';
      handle: ActorRef<PostMessage>;
    }

    interface SessionDenied {
      type: 'SessionDenied';
      reason: string;
    }

    interface MessagePosted {
      type: 'MessagePosted';
      screenName: string;
      message: string;
    }

    type SessionEvent = SessionGranted | SessionDenied | MessagePosted;

    interface PostMessage {
      type: 'PostMessage';
      message: string;
    }

    interface NotifyClient {
      type: 'NotifyClient';
      message: MessagePosted;
    }

    type SessionCommand = PostMessage | NotifyClient;

    interface PublishSessionMessage {
      type: 'PublishSessionMessage';
      screenName: string;
      message: string;
    }

    // private def chatRoom(sessions: List[ActorRef[SessionCommand]]): Behavior[RoomCommand] =
    // Behaviors.receive { (context, message) =>
    //   message match {
    //     case GetSession(screenName, client) =>
    //       // create a child actor for further interaction with the client
    //       val ses = context.spawn(
    //         session(context.self, screenName, client),
    //         name = URLEncoder.encode(screenName, StandardCharsets.UTF_8.name))
    //       client ! SessionGranted(ses)
    //       chatRoom(ses :: sessions)
    //     case PublishSessionMessage(screenName, message) =>
    //       val notification = NotifyClient(MessagePosted(screenName, message))
    //       sessions.foreach(_ ! notification)
    //       Behaviors.same
    //   }
    // }

    const ChatRoom = (): Behavior<RoomCommand> => chatRoom([]);

    const session = (
      room: ActorRef<PublishSessionMessage>,
      screenName: string,
      client: ActorRef<SessionEvent>
    ): Behavior<SessionCommand> => {
      return behaviors.receive((_, message) => {
        switch (message.type) {
          case 'PostMessage':
            room.send({
              type: 'PublishSessionMessage',
              screenName,
              message: message.message,
            });
            return BehaviorTag.Same;
          case 'NotifyClient':
            client.send(message.message);
            return BehaviorTag.Same;
          default:
            return BehaviorTag.Same;
        }
      });
    };

    // private def chatRoom(sessions: List[ActorRef[SessionCommand]]): Behavior[RoomCommand] =
    // Behaviors.receive { (context, message) =>
    //   message match {
    //     case GetSession(screenName, client) =>
    //       // create a child actor for further interaction with the client
    //       val ses = context.spawn(
    //         session(context.self, screenName, client),
    //         name = URLEncoder.encode(screenName, StandardCharsets.UTF_8.name))
    //       client ! SessionGranted(ses)
    //       chatRoom(ses :: sessions)
    //     case PublishSessionMessage(screenName, message) =>
    //       val notification = NotifyClient(MessagePosted(screenName, message))
    //       sessions.foreach(_ ! notification)
    //       Behaviors.same
    //   }
    // }

    const chatRoom = (
      sessions: ActorRef<SessionCommand>[]
    ): Behavior<RoomCommand> => {
      return behaviors.receive((context, message) => {
        switch (message.type) {
          case 'GetSession':
            const ses = context.spawn(
              session(context.self as any, message.screenName, message.replyTo),
              message.screenName
            );
            message.replyTo.send({
              type: 'SessionGranted',
              handle: ses as any,
            });
            return chatRoom([ses, ...sessions]);
          case 'PublishSessionMessage':
            const notification: NotifyClient = {
              type: 'NotifyClient',
              message: {
                type: 'MessagePosted',
                screenName: message.screenName,
                message: message.message,
              },
            };
            sessions.forEach((session) => session.send(notification));
            return BehaviorTag.Same;
        }
      });
    };

    const Gabbler = (): Behavior<SessionEvent> => {
      return behaviors.setup((context) => {
        return behaviors.receive((_, message) => {
          switch (message.type) {
            case 'SessionGranted':
              message.handle.send({
                type: 'PostMessage',
                message: 'Hello world!',
              });
              return BehaviorTag.Same;
            case 'MessagePosted':
              context.log(
                `message has been posted by '${message.screenName}': ${message.message}`
              );
              done();
              return BehaviorTag.Stopped;
            default:
              return BehaviorTag.Same;
          }
        });
      });
    };

    // val chatRoom = context.spawn(ChatRoom(), "chatroom")
    // val gabblerRef = context.spawn(Gabbler(), "gabbler")
    // context.watch(gabblerRef)
    // chatRoom ! ChatRoom.GetSession("ol’ Gabbler", gabblerRef)

    // Behaviors.receiveSignal {
    //   case (_, Terminated(_)) =>
    //     Behaviors.stopped
    // }

    const Main = (): any => {
      return behaviors.setup((context) => {
        const chatRoom = context.spawn(ChatRoom(), 'chatRoom');
        const gabblerRef = context.spawn(Gabbler(), 'gabbler');

        // context.watch(gabblerRef); // TODO

        chatRoom.send({
          type: 'GetSession',
          screenName: "ol' Gabbler",
          replyTo: gabblerRef,
        });

        return BehaviorTag.Same as any;
      });
    };

    const mainSystem = new ActorSystem(Main(), 'ChatRoomDemo');
  });

  it('aggregation example', (done) => {
    interface OrchestratorState {
      entities: Map<string, ActorRef<EntityEvent>>;
      aggregations: {
        [entityId: string]: number | undefined;
      };
    }
    type OrchestratorEvent =
      | {
          type: 'entity.add';
          entityId: string;
          value: number;
        }
      | {
          type: 'entity.receive';
          entity: ActorRef<EntityEvent>;
          count: number;
        }
      | {
          type: 'getAll';
        };

    type EntityEvent =
      | {
          type: 'add';
          value: number;
        }
      | {
          type: 'get';
          ref: ActorRef<OrchestratorEvent>;
        };

    interface EntityState {
      count: number;
    }

    const entityReducer: behaviors.BehaviorReducer<EntityState, EntityEvent> = (
      state,
      event,
      ctx
    ) => {
      if (event.type === 'add') {
        ctx.log('adding', event.value, state.count);
        state.count += event.value;
      }

      if (event.type === 'get') {
        event.ref.send({
          type: 'entity.receive',
          entity: ctx.self,
          count: state.count,
        });
      }

      return state;
    };

    const orchestratorReducer: behaviors.BehaviorReducer<
      OrchestratorState,
      OrchestratorEvent
    > = (state, event, ctx) => {
      if (event.type === 'entity.add') {
        let entity = state.entities.get(event.entityId);
        if (!entity) {
          entity = ctx.spawn(
            behaviors.reduce(entityReducer, { count: 0 }),
            event.entityId
          );
          state.entities.set(event.entityId, entity);
        }

        entity.send({ type: 'add', value: event.value });
      }

      if (event.type === 'getAll') {
        Array.from(state.entities.entries()).forEach(([entityId, entity]) => {
          state.aggregations[entityId] = undefined;

          entity.send({ type: 'get', ref: ctx.self });
        });
      }

      if (event.type === 'entity.receive') {
        state.aggregations[event.entity.name] = event.count;

        if (
          Object.values(state.aggregations).every(
            (value) => value !== undefined
          )
        ) {
          ctx.log(state.aggregations);
          done();
        }
      }

      return state;
    };

    const system = new ActorSystem(
      behaviors.reduce(orchestratorReducer, {
        entities: new Map(),
        aggregations: {},
      }),
      'orchestrator'
    );

    system.send({
      type: 'entity.add',
      entityId: 'foo',
      value: 3,
    });

    system.send({
      type: 'entity.add',
      entityId: 'foo',
      value: 3,
    });

    system.send({
      type: 'entity.add',
      entityId: 'foo',
      value: 2,
    });

    system.send({
      type: 'entity.add',
      entityId: 'bar',
      value: 3,
    });

    system.send({
      type: 'entity.add',
      entityId: 'bar',
      value: 3,
    });

    system.send({
      type: 'entity.add',
      entityId: 'bar',
      value: 2,
    });

    system.send({
      type: 'entity.add',
      entityId: 'foo',
      value: 1,
    });

    system.send({
      type: 'getAll',
    });
  });

  it('guardian actor should receive messages sent to system', (done) => {
    const HelloWorldMain = behaviors.receive<{ type: 'hello' }>((_, event) => {
      expect(event.type).toEqual('hello');

      done();

      return BehaviorTag.Same;
    });

    const system = new ActorSystem(HelloWorldMain, 'hello');

    system.send({ type: 'hello' });
  });

  it('stopping actors', (done) => {
    // https://doc.akka.io/docs/akka/2.6.5/typed/actor-lifecycle.html#stopping-actors
    const stoppedActors: any[] = [];

    interface SpawnJob {
      type: 'SpawnJob';
      name: string;
    }

    interface GracefulShutdown {
      type: 'GracefulShutdown';
    }

    type Command = SpawnJob | GracefulShutdown;

    const Job = (name: string): Behavior<Command> => {
      return behaviors.receiveSignal<Command>((context, signal) => {
        if (signal === ActorSignal.PostStop) {
          context.log(`Worker ${name} stopped`);
          stoppedActors.push(name);
        }

        return BehaviorTag.Same;
      });
    };

    const MasterControlProgram = (): Behavior<Command> => {
      const cleanup = (log: Logger): void => {
        log(`Cleaning up!`);
      };

      return behaviors.receive(
        (context, message) => {
          switch (message.type) {
            case 'SpawnJob':
              const { name: jobName } = message;
              context.log(`Spawning job ${jobName}!`);
              context.spawn(Job(jobName), jobName);
              return BehaviorTag.Same;
            case 'GracefulShutdown':
              context.log(`Initiating graceful shutdown...`);
              return behaviors.stopped(() => {
                cleanup(context.log);
              });
          }
        },
        (context, signal) => {
          if (signal === ActorSignal.PostStop) {
            context.log(`Master Control Program stopped`);

            expect(stoppedActors).toEqual(['a', 'b']);
            done();
          }
          return BehaviorTag.Same;
        }
      );
    };

    const system = new ActorSystem(MasterControlProgram(), 'B7700');

    system.send({ type: 'SpawnJob', name: 'a' });
    system.send({ type: 'SpawnJob', name: 'b' });

    setTimeout(() => {
      system.send({ type: 'GracefulShutdown' });
    }, 100);
  });
});
