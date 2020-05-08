import { ActorSystem, Behavior } from '../src';
import * as behaviors from '../src/BehaviorImpl';
import { ActorRef } from '../src/ActorRef';
import { Behaviors } from '../src/Behavior';

describe('ActorSystem', () => {
  it('simple test', (done) => {
    const rootBehavior: Behavior<any> = {
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
      return Behaviors.Same;
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

        return Behaviors.Same;
      });
    });

    const system = new ActorSystem(HelloWorldMain, 'hello');

    system.send({ name: 'World' });
    system.send({ name: 'Akka' });

    setTimeout(() => {
      done();
    }, 1000);
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
});
