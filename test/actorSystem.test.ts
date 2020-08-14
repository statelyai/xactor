import { ActorSystem } from '../src';
import * as behaviors from '../src/BehaviorImpl';
import { ActorRef } from '../src/ActorRef';
import {
  BehaviorTag,
  ActorSignalType,
  Misbehavior,
  Logger,
  MisbehaviorTag,
} from '../src/Behavior';
import { createSystem } from '../src/ActorSystem';

describe('ActorSystem', () => {
  it('simple test', done => {
    const rootBehavior = behaviors.fromReducer((_, msg) => {
      if (behaviors.isSignal(msg)) return undefined;
      console.log('msg recd', msg);
      expect(msg).toEqual({ type: 'hey' });
      done();
      return undefined;
    }, undefined);

    const system = new ActorSystem(rootBehavior, 'hello');

    system.send({ type: 'hey' });
  });

  it('First example', done => {
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

    const HelloWorld = behaviors.fromReducer<Greet>((_, message, ctx) => {
      if (behaviors.isSignal(message)) return _;

      ctx.log(`Hello ${message.whom}!`);

      message.replyTo.send({
        whom: message.whom,
        from: ctx.self,
      });

      return _;
    }, undefined);

    const HelloWorldBot = (max: number) => {
      const bot = (
        greetingCounter: number,
        max: number
      ): Misbehavior<Greeted> => {
        return behaviors.fromReducer(
          (state, message, ctx) => {
            if (behaviors.isSignal(message)) return state;

            const n = state.n + 1;

            ctx.log(`Greeting ${n} for ${message.whom}`);

            if (n === max) {
              return state; // do nothing
            } else {
              message.from.send({
                whom: message.whom,
                replyTo: ctx.self,
              });
              return { n, max };
            }
          },
          { n: greetingCounter, max }
        );
      };

      return bot(0, max);
    };

    const HelloWorldMain: Misbehavior<
      SayHello,
      { greeter: ActorRef<Greet> | undefined }
    > = [
      ([{ greeter }], message, ctx) => {
        if (
          behaviors.isSignal(message) &&
          message.type === ActorSignalType.Start
        ) {
          return [
            { greeter: ctx.spawn(HelloWorld, 'greeter') },
            MisbehaviorTag.Default,
          ];
        }

        if ('name' in message) {
          const replyTo = ctx.spawn(
            HelloWorldBot(3),
            (message as SayHello).name
          );

          greeter?.send({
            whom: (message as SayHello).name,
            replyTo,
          });
        }

        return [{ greeter }, MisbehaviorTag.Default];
      },
      [{ greeter: undefined }, MisbehaviorTag.Default],
    ];

    const system = new ActorSystem(HelloWorldMain, 'hello');

    system.send({ name: 'World' });
    system.send({ name: 'Akka' });

    setTimeout(() => {
      done();
    }, 1000);
  });

  it('more complex example', done => {
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

    const ChatRoom = (): Misbehavior<RoomCommand> => chatRoom([]);

    const session = (
      room: ActorRef<PublishSessionMessage>,
      screenName: string,
      client: ActorRef<SessionEvent>
    ): Misbehavior<SessionCommand> => {
      return behaviors.fromReducer((_, message, _ctx) => {
        switch (message.type) {
          case 'PostMessage':
            room.send({
              type: 'PublishSessionMessage',
              screenName,
              message: message.message,
            });
            return undefined;
          case 'NotifyClient':
            client.send(message.message);
            return undefined;
          default:
            return undefined;
        }
      }, undefined);
    };

    const chatRoom = (
      sessions: ActorRef<SessionCommand>[]
    ): Misbehavior<RoomCommand> => {
      return behaviors.fromReducer(
        (state, message, context) => {
          switch (message.type) {
            case 'GetSession':
              const ses = context.spawn(
                session(
                  context.self as any,
                  message.screenName,
                  message.replyTo
                ),
                message.screenName
              );
              message.replyTo.send({
                type: 'SessionGranted',
                handle: ses as any,
              });
              return { sessions: [ses, ...sessions] };
            case 'PublishSessionMessage':
              const notification: NotifyClient = {
                type: 'NotifyClient',
                message: {
                  type: 'MessagePosted',
                  screenName: message.screenName,
                  message: message.message,
                },
              };
              state.sessions.forEach(session => session.send(notification));
              return state;
            default:
              return state;
          }
        },
        { sessions }
      );
    };

    const Gabbler = (): Misbehavior<SessionEvent> => {
      return behaviors.fromReducer((_, message, context) => {
        switch (message.type) {
          case 'SessionGranted':
            message.handle.send({
              type: 'PostMessage',
              message: 'Hello world!',
            });
            return undefined;
          case 'MessagePosted':
            context.log(
              `message has been posted by '${message.screenName}': ${message.message}`
            );
            done();
            return undefined;
          // return BehaviorTag.Stopped;
          default:
            return undefined;
        }
      }, undefined);
    };

    const Main = () =>
      behaviors.fromReducer((_, message, context) => {
        if (
          behaviors.isSignal(message) &&
          message.type === ActorSignalType.Start
        ) {
          const chatRoom = context.spawn(ChatRoom(), 'chatRoom');
          const gabblerRef = context.spawn(Gabbler(), 'gabbler');

          chatRoom.send({
            type: 'GetSession',
            screenName: "ol' Gabbler",
            replyTo: gabblerRef,
          });
        }
        return [undefined, MisbehaviorTag.Default];
      }, undefined);

    new ActorSystem(Main(), 'Chat');
  });

  it('aggregation example', done => {
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
        ctx.log(`adding ${event.value} ${state.count}`);
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
      console.log('>>>', state);
      if (event.type === 'entity.add') {
        let entity = state.entities.get(event.entityId);
        if (!entity) {
          entity = ctx.spawn(
            behaviors.fromReducer(entityReducer, { count: 0 }),
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
          Object.values(state.aggregations).every(value => value !== undefined)
        ) {
          ctx.log(state.aggregations);
          done();
        }
      }

      return state;
    };

    const system = new ActorSystem(
      behaviors.fromReducer(orchestratorReducer, {
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

  it('guardian actor should receive messages sent to system', done => {
    const HelloWorldMain = behaviors.fromReceive<{ type: 'hello' }>(
      (_, event) => {
        expect(event.type).toEqual('hello');

        done();

        return BehaviorTag.Same;
      }
    );

    const system = new ActorSystem(HelloWorldMain, 'hello');

    system.send({ type: 'hello' });
  });

  it('stopping actors', done => {
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

    const Job = (name: string) =>
      behaviors.fromReducer<Command>((_, signal, ctx) => {
        ctx.log(signal);
        if (signal.type === ActorSignalType.PostStop) {
          ctx.log(`Worker ${name} stopped`);
          stoppedActors.push(name);
        }
      }, undefined);

    const MasterControlProgram = () =>
      behaviors.fromReducer<Command>((state, message, context) => {
        const cleanup = (log: Logger): void => {
          log(`Cleaning up!`);
        };

        if (behaviors.isSignal(message)) {
          if (message.type === ActorSignalType.PostStop) {
            context.log(`Master Control Program stopped`);
            cleanup(context.log);

            expect(stoppedActors).toEqual(['a', 'b']);
            done();
          }
          return;
        }

        switch (message.type) {
          case 'SpawnJob':
            const { name: jobName } = message;
            context.log(`Spawning job ${jobName}!`);
            context.spawn(Job(jobName), jobName);
            return;
          case 'GracefulShutdown':
            context.log(`Initiating graceful shutdown...`);
            return [state, MisbehaviorTag.Stopped];
        }
      }, undefined);

    const system = new ActorSystem(MasterControlProgram(), 'B7700');

    system.send({ type: 'SpawnJob', name: 'a' });
    system.send({ type: 'SpawnJob', name: 'b' });

    setTimeout(() => {
      system.send({ type: 'GracefulShutdown' });
    }, 100);
  });

  it('watching actors', done => {
    interface SpawnJob {
      type: 'SpawnJob';
      jobName: string;
    }

    const Job = (name: string) =>
      behaviors.fromReducer<{ type: 'finished' }, 'one' | 'two'>(
        (state, event, ctx) => {
          ctx.log(state);
          if (state === 'one') {
            setTimeout(() => {
              console.log('send?');
              ctx.self.send({ type: 'finished' });
            }, 100);

            ctx.log(`Hi I am job ${name}`);

            return 'two';
          }

          if (event.type === 'finished') {
            return [state, MisbehaviorTag.Stopped];
          }

          return state;
        },
        'one'
      );

    // const Job = (name: string): Behavior<{ type: 'finished' }> =>
    //   behaviors.setup(ctx => {
    //     setTimeout(() => {
    //       ctx.self.send({ type: 'finished' });
    //     }, 100);

    //     ctx.log(`Hi I am job ${name}`);
    //     return behaviors.receive((ctx, msg) => {
    //       if (msg.type === 'finished') {
    //         return behaviors.stopped(() => {});
    //       }
    //       return BehaviorTag.Same;
    //     });
    //   });

    const MasterControlProgram = () =>
      behaviors.fromReducer<SpawnJob>((state, message, context) => {
        if (behaviors.isSignal(message)) {
          switch (message.type) {
            case ActorSignalType.Terminated:
              context.log(`Job stopped: ${message.ref.name}`);
              expect(message.ref.name).toEqual('job1');
              done();
              return state;
            default:
              return state;
          }
        }

        switch (message.type) {
          case 'SpawnJob':
            context.log(`Spawning job ${message.jobName}!`);
            const job = context.spawn(Job(message.jobName), message.jobName);
            context.watch(job);
            return state;
          default:
            return state;
        }
      }, undefined);

    const sys = createSystem(MasterControlProgram(), 'master');

    sys.send({
      type: 'SpawnJob',
      jobName: 'job1',
    });
  }, 1000);
  // });

  describe('interaction patterns', () => {
    it('fire and forget', done => {
      interface PrintMe {
        type: 'PrintMe';
        message: string;
      }

      // const Printer = (): Behavior<PrintMe> => {
      //   return behaviors.receive((ctx, msg) => {
      //     switch (msg.type) {
      //       case 'PrintMe':
      //         ctx.log(msg.message);
      //         if (msg.message === 'not message 2') {
      //           done();
      //         }
      //         return BehaviorTag.Same;
      //     }
      //   });
      // };

      const Printer = () =>
        behaviors.fromReducer<PrintMe>((state, msg, ctx) => {
          switch (msg.type) {
            case 'PrintMe':
              ctx.log(msg.message);
              if (msg.message === 'not message 2') {
                done();
              }
              return state;
          }
        }, undefined);

      const sys = createSystem(Printer(), 'fire-and-forget-sample');

      sys.send({ type: 'PrintMe', message: 'message 1' });
      sys.send({ type: 'PrintMe', message: 'not message 2' });
    });

    it('request-response', done => {
      interface ResponseMsg {
        type: 'Response';
        result: string;
      }
      interface RequestMsg {
        type: 'Request';
        query: string;
        replyTo: ActorRef<ResponseMsg | any>;
      }

      const CookieFabric = () =>
        behaviors.fromReducer<RequestMsg>((state, msg, ctx) => {
          switch (msg.type) {
            case 'Request':
              ctx.send(msg.replyTo, {
                type: 'Response',
                result: `Here are the cookies for [${msg.query}]!`,
              });
              return state;
            default:
              return state;
          }
        }, undefined);

      const Requestor = () =>
        behaviors.fromReducer<ResponseMsg | { type: 'start' }>(
          (state, msg, ctx) => {
            switch (msg.type) {
              case 'start':
                const cookieFabric = ctx.spawn(CookieFabric(), 'cookie-fabric');

                ctx.send(cookieFabric, {
                  type: 'Request',
                  query: 'my query',
                  replyTo: ctx.self,
                });

                return state;
              case 'Response':
                ctx.log(`Got a response: ${msg.result}`);
                console.log(sys.logs);

                const participants: Set<ActorRef<any>> = new Set();

                sys.logs.map(log => {
                  if ('log' in log) {
                    participants.add(log.ref);
                  } else {
                    participants.add(log.from);
                    participants.add(log.to);
                  }
                });

                const parr = Array.from(participants);

                const seqDiagram =
                  `sequenceDiagram\n` +
                  parr
                    .map((value, index) => {
                      return `  participant ${index} as ${value.name}`;
                    })
                    .join('\n') +
                  '\n' +
                  sys.logs
                    .map(log => {
                      if ('log' in log) {
                        return `  Note right of ${parr.indexOf(log.ref)}: ${
                          log.log
                        }`;
                      }

                      const from = parr.indexOf(log.from);
                      const to = parr.indexOf(log.to);

                      return `  ${from}->>${to}: '${JSON.stringify(
                        log.message,
                        (_key, value) => {
                          if (value instanceof ActorRef) {
                            return value.name;
                          }
                          return value;
                        }
                      )}'`;
                    })
                    .join('\n');

                console.log(seqDiagram);
                done();
                return state;
              default:
                return state;
            }
          },
          undefined
        );

      const sys = createSystem(Requestor(), 'test');

      sys.send({ type: 'start' });
    });

    // it('request-response with ask between two actors', (done) => {
    //   // object Hal {
    //   //   sealed trait Command
    //   //   case class OpenThePodBayDoorsPlease(replyTo: ActorRef[Response]) extends Command
    //   //   case class Response(message: String)

    //   //   def apply(): Behaviors.Receive[Hal.Command] =
    //   //     Behaviors.receiveMessage[Command] {
    //   //       case OpenThePodBayDoorsPlease(replyTo) =>
    //   //         replyTo ! Response("I'm sorry, Dave. I'm afraid I can't do that.")
    //   //         Behaviors.same
    //   //     }
    //   // }

    //   interface HalResponse {
    //     type: 'HalResponse';
    //     message: string;
    //   }

    //   interface OpenThePodBayDoorsPlease {
    //     type: 'OpenThePodBayDoorsPlease';
    //     replyTo: ActorRef<HalResponse>;
    //   }

    //   const Hal = () =>
    //     behaviors.receive<OpenThePodBayDoorsPlease>((ctx, msg) => {
    //       switch (msg.type) {
    //         case 'OpenThePodBayDoorsPlease':
    //           msg.replyTo.send({
    //             type: 'HalResponse',
    //             message: "I'm sorry, Dave. I'm afraid I can't do that.",
    //           });
    //           return BehaviorTag.Same;
    //       }
    //     });
    // });
  });
});
