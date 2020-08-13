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

describe('ActorSystem', () => {
  it.only('simple test', done => {
    // const rootBehavior: Behavior<any> = {
    //   _tag: BehaviorTag.Default, // TODO: make this default
    //   receive(_, event: any) {
    //     expect(event).toEqual({ type: 'hey' });
    //     done();
    //     return rootBehavior;
    //   },
    // };

    // const rootBehavior: Misbehavior<any> = [
    //   (_, msg, ctx) => {
    //     expect(msg).toEqual({ type: 'hey' });
    //     return;
    //   },
    //   undefined,
    // ];

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

  it.only('First example', done => {
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
      ({ greeter }, message, ctx) => {
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
      { greeter: undefined },
    ];

    // const HelloWorldMain = behaviors.setup<SayHello>((ctx) => {
    //   const greeter = ctx.spawn(HelloWorld, 'greeter');

    //   return behaviors.receive((_, message) => {
    //     const replyTo = ctx.spawn(HelloWorldBot(3), message.name);
    //     greeter.send({
    //       whom: message.name,
    //       replyTo,
    //     });

    //     return BehaviorTag.Same;
    //   });
    // });

    const system = new ActorSystem(HelloWorldMain, 'hello');

    system.send({ name: 'World' });
    system.send({ name: 'Akka' });

    setTimeout(() => {
      done();
    }, 1000);
  });

  it.only('more complex example', done => {
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

    // val chatRoom = context.spawn(ChatRoom(), "chatroom")
    // val gabblerRef = context.spawn(Gabbler(), "gabbler")
    // context.watch(gabblerRef)
    // chatRoom ! ChatRoom.GetSession("ol’ Gabbler", gabblerRef)

    // Behaviors.receiveSignal {
    //   case (_, Terminated(_)) =>
    //     Behaviors.stopped
    // }

    // @ts-ignore
    const Main = (): Misbehavior<any> => {
      return [
        (_state, message, context) => {
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
        },
        undefined,
      ];
      // return behaviors.fromReducer((_, __, context) => {
      //   const chatRoom = context.spawn(ChatRoom(), 'chatRoom');
      //   const gabblerRef = context.spawn(Gabbler(), 'gabbler');

      //   // context.watch(gabblerRef); // TODO

      //   console.log('here');

      //   chatRoom.send({
      //     type: 'GetSession',
      //     screenName: "ol' Gabbler",
      //     replyTo: gabblerRef,
      //   });

      //   return undefined;
      //   // return BehaviorTag.Same as any;
      // }, undefined);
    };

    new ActorSystem(Main(), 'Chat');

    // @ts-ignore
  });

  it.only('aggregation example', done => {
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

  it.only('guardian actor should receive messages sent to system', done => {
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

  it.only('stopping actors', done => {
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
      behaviors.fromReceive<Command>(undefined, (ctx, signal) => {
        if (signal.type === ActorSignalType.PostStop) {
          ctx.log(`Worker ${name} stopped`);
          stoppedActors.push(name);
        }
      });

    // const Job = (name: string): Behavior<Command> => {
    //   return behaviors.receiveSignal<Command>((context, signal) => {
    //     if (signal.type === ActorSignalType.PostStop) {
    //       context.log(`Worker ${name} stopped`);
    //       stoppedActors.push(name);
    //     }

    //     return BehaviorTag.Same;
    //   });
    // };

    const MasterControlProgram = () =>
      behaviors.fromReducer<Command>((_state, message, context) => {
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
            return ['asdf', MisbehaviorTag.Stopped];
        }
      }, 'asdf');

    // const MasterControlProgram = (): Behavior<Command> => {
    //   const cleanup = (log: Logger): void => {
    //     log(`Cleaning up!`);
    //   };

    //   return behaviors.receive(
    //     (context, message) => {
    //       switch (message.type) {
    //         case 'SpawnJob':
    //           const { name: jobName } = message;
    //           context.log(`Spawning job ${jobName}!`);
    //           context.spawn(Job(jobName), jobName);
    //           return BehaviorTag.Same;
    //         case 'GracefulShutdown':
    //           context.log(`Initiating graceful shutdown...`);
    //           return behaviors.stopped(() => {
    //             cleanup(context.log);
    //           });
    //       }
    //     },
    //     (context, signal) => {
    //       if (signal.type === ActorSignalType.PostStop) {
    //         context.log(`Master Control Program stopped`);

    //         expect(stoppedActors).toEqual(['a', 'b']);
    //         done();
    //       }
    //       return BehaviorTag.Same;
    //     }
    //   );
    // };

    const system = new ActorSystem(MasterControlProgram(), 'B7700');

    system.send({ type: 'SpawnJob', name: 'a' });
    system.send({ type: 'SpawnJob', name: 'b' });

    setTimeout(() => {
      system.send({ type: 'GracefulShutdown' });
    }, 100);
  });

  //   it('watching actors', done => {
  //     interface SpawnJob {
  //       type: 'SpawnJob';
  //       jobName: string;
  //     }

  //     const Job = (name: string): Behavior<{ type: 'finished' }> =>
  //       behaviors.setup(ctx => {
  //         setTimeout(() => {
  //           ctx.self.send({ type: 'finished' });
  //         }, 100);

  //         ctx.log(`Hi I am job ${name}`);
  //         return behaviors.receive((ctx, msg) => {
  //           if (msg.type === 'finished') {
  //             return behaviors.stopped(() => {});
  //           }
  //           return BehaviorTag.Same;
  //         });
  //       });

  //     const MasterControlProgram = (): Behavior<SpawnJob> => {
  //       return behaviors.receive(
  //         (context, message) => {
  //           switch (message.type) {
  //             case 'SpawnJob':
  //               context.log(`Spawning job ${message.jobName}!`);
  //               const job = context.spawn(Job(message.jobName), message.jobName);
  //               context.watch(job);
  //               return BehaviorTag.Same;
  //             default:
  //               return BehaviorTag.Same;
  //           }
  //         },
  //         (context, signal) => {
  //           switch (signal.type) {
  //             case ActorSignalType.Terminated:
  //               context.log(`Job stopped: ${signal.ref.name}`);
  //               expect(signal.ref.name).toEqual('job1');
  //               done();
  //               return BehaviorTag.Same;
  //             default:
  //               return BehaviorTag.Same;
  //           }
  //         }
  //       );
  //     };

  //     const sys = createSystem(MasterControlProgram(), 'master');

  //     sys.send({
  //       type: 'SpawnJob',
  //       jobName: 'job1',
  //     });
  //   });
  // });

  // describe('interaction patterns', () => {
  //   it('fire and forget', done => {
  //     interface PrintMe {
  //       type: 'PrintMe';
  //       message: string;
  //     }

  //     const Printer = (): Behavior<PrintMe> => {
  //       return behaviors.receive((ctx, msg) => {
  //         switch (msg.type) {
  //           case 'PrintMe':
  //             ctx.log(msg.message);
  //             if (msg.message === 'not message 2') {
  //               done();
  //             }
  //             return BehaviorTag.Same;
  //         }
  //       });
  //     };

  //     const sys = createSystem(Printer(), 'fire-and-forget-sample');

  //     sys.send({ type: 'PrintMe', message: 'message 1' });
  //     sys.send({ type: 'PrintMe', message: 'not message 2' });
  //   });

  //   it('request-response', done => {
  //     interface ResponseMsg {
  //       type: 'Response';
  //       result: string;
  //     }
  //     interface RequestMsg {
  //       type: 'Request';
  //       query: string;
  //       replyTo: ActorRef<ResponseMsg | any>;
  //     }

  //     const CookieFabric = (): Behavior<RequestMsg> =>
  //       behaviors.receive((ctx, msg) => {
  //         switch (msg.type) {
  //           case 'Request':
  //             ctx.send(msg.replyTo, {
  //               type: 'Response',
  //               result: `Here are the cookies for [${msg.query}]!`,
  //             });
  //             return BehaviorTag.Same;
  //           default:
  //             return BehaviorTag.Same;
  //         }
  //       });

  //     const Requestor = (): Behavior<ResponseMsg | { type: 'start' }> =>
  //       behaviors.receive((ctx, msg) => {
  //         switch (msg.type) {
  //           case 'start':
  //             const cookieFabric = ctx.spawn(CookieFabric(), 'cookie-fabric');

  //             ctx.send(cookieFabric, {
  //               type: 'Request',
  //               query: 'my query',
  //               replyTo: ctx.self,
  //             });

  //             return BehaviorTag.Same;
  //           case 'Response':
  //             ctx.log(`Got a response: ${msg.result}`);
  //             console.log(sys.logs);

  //             const participants: Set<ActorRef<any>> = new Set();

  //             sys.logs.map(log => {
  //               if ('log' in log) {
  //                 participants.add(log.ref);
  //               } else {
  //                 participants.add(log.from);
  //                 participants.add(log.to);
  //               }
  //             });

  //             const parr = Array.from(participants);

  //             const seqDiagram =
  //               `sequenceDiagram\n` +
  //               parr
  //                 .map((value, index) => {
  //                   return `  participant ${index} as ${value.name}`;
  //                 })
  //                 .join('\n') +
  //               '\n' +
  //               sys.logs
  //                 .map(log => {
  //                   if ('log' in log) {
  //                     return `  Note right of ${parr.indexOf(log.ref)}: ${
  //                       log.log
  //                     }`;
  //                   }

  //                   const from = parr.indexOf(log.from);
  //                   const to = parr.indexOf(log.to);

  //                   return `  ${from}->>${to}: '${JSON.stringify(
  //                     log.message,
  //                     (key, value) => {
  //                       if (value instanceof ActorRef) {
  //                         return value.name;
  //                       }
  //                       return value;
  //                     }
  //                   )}'`;
  //                 })
  //                 .join('\n');

  //             console.log(seqDiagram);
  //             done();
  //             return BehaviorTag.Same;
  //           default:
  //             return BehaviorTag.Same;
  //         }
  //       });

  //     const sys = createSystem(Requestor(), 'test');

  //     sys.send({ type: 'start' });
  //   });

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
