// @ts-nocheck
// Adapted from https://github.com/akka/akka-samples/blob/2.6/akka-sample-fsm-scala/src/main/scala/sample/DiningHakkers.scala

import { stat } from 'fs';
import {
  ActorRef,
  createBehavior,
  createSetupBehavior,
  createSystem,
  createTimeout,
} from '../src';
import { ActorRefOf } from '../src/ActorRef';

describe.skip('Dining hakkers', () => {
  it('should', done => {
    const Chopstick = () =>
      createBehavior<any, any>(
        (state, event, ctx) => {
          switch (state.status) {
            case 'available':
              switch (event.type) {
                case 'take':
                  ctx.send(event.hakker, {
                    type: 'taken',
                    chopstick: ctx.self,
                  });
                  return { ...state, status: 'takenBy', owner: event.hakker };
                default:
                  return state;
              }
            case 'takenBy':
              switch (event.type) {
                case 'take':
                  ctx.send(event.hakker, { type: 'busy', chopstick: ctx.self });
                  return state;
                case 'put':
                  return { ...state, status: 'available' };
                default:
                  return state;
              }
            default:
              return state;
          }
        },
        { status: 'available', owner: null }
      );

    type ChopstickActorRef = ActorRefOf<ReturnType<typeof Chopstick>>;

    const Hakker = (
      name: string,
      left: ChopstickActorRef,
      right: ChopstickActorRef
    ) =>
      createBehavior<any, any>(
        (state, event, ctx) => {
          ctx.log(state.status, event.type);
          switch (state.status) {
            case 'waiting':
              switch (event.type) {
                case 'think':
                  ctx.log(`${name} starts to think`);
                  ctx.spawn(
                    createTimeout(
                      ctx.self,
                      ref => {
                        ref.send({ type: 'thinkingStarted' });
                        ref.send({ type: 'eat' });
                      },
                      2000
                    ),
                    'timeout'
                  );
                  return { ...state, status: 'startThinking' };
                default:
                  return state;
              }
            case 'startThinking':
              switch (event.type) {
                case 'thinkingStarted':
                  ctx.log('thinking started');
                  return { ...state, status: 'thinking' };
                default:
                  return state;
              }
            case 'thinking':
              switch (event.type) {
                case 'eat':
                  ctx.send(left, { type: 'take', hakker: ctx.self });
                  ctx.send(right, { type: 'take', hakker: ctx.self });
                  return { ...state, status: 'hungry' };
                default:
                  return state;
              }

            case 'hungry':
              function waitForOtherChopstick(
                chopstickToWaitFor: ChopstickActorRef,
                takenChopstick: ChopstickActorRef
              ) {
                switch (event.type) {
                  case 'taken':
                    ctx.log(
                      `${name} has picked up ${left.name} and ${right.name} and starts to eat`
                    );
                    ctx.spawn(
                      createTimeout(
                        ctx.self,
                        ref => {
                          ref.send({ type: 'think' });
                          ref.send({ type: 'eatingStarted' });
                        },
                        2000
                      ),
                      'timer'
                    );
                    return {
                      ...state,
                      status: 'startEating',
                    };
                  case 'busy':
                    ctx.send(takenChopstick, { type: 'put' });
                    ctx.spawn(
                      createTimeout(
                        ctx.self,
                        ref => {
                          ref.send({ type: 'eat' });
                          ref.send({ type: 'thinkingStarted' });
                        },
                        10
                      ),
                      'timer'
                    );
                    return { ...state, status: 'startThinking' };
                }
              }
              switch (event.type) {
                case 'taken':
                  if (event.chopstick === left) {
                    return waitForOtherChopstick(right, left);
                  } else {
                    return waitForOtherChopstick(left, right);
                  }
                case 'busy':
                  return {
                    ...state,
                    status: 'firstChopstickDenied',
                  };
              }

            case 'startEating':
              if (event.type === 'eatingStarted') {
                return { ...state, status: 'eating' };
              }

            case 'eating':
              switch (event.type) {
                case 'think':
                  ctx.log(
                    `${name} puts down their chopsticks and starts to think`
                  );
                  ctx.send(left, { type: 'put' });
                  ctx.send(right, { type: 'put' });

                  ctx.spawn(
                    createTimeout(
                      ctx.self,
                      ref => {
                        ref.send({ type: 'thinkingStarted' });
                      },
                      2000
                    ),
                    'timeout'
                  );

                  return {
                    ...state,
                    status: 'startThinking',
                  };
              }

            case 'firstChopstickDenied':
              switch (event.type) {
                case 'taken':
                  ctx.send(event.chopstick, { type: 'put' });
                  ctx.spawn(
                    createTimeout(
                      ctx.self,
                      ref => {
                        ref.send({ type: 'thinkingStarted' });
                      },
                      10
                    ),
                    'timeout'
                  );
                  return {
                    ...state,
                    status: 'startThinking',
                  };
                case 'busy':
                  ctx.spawn(
                    createTimeout(
                      ctx.self,
                      ref => {
                        ref.send({ type: 'thinkingStarted' });
                      },
                      10
                    ),
                    'timeout'
                  );
                  return {
                    ...state,
                    status: 'startThinking',
                  };
                default:
                  return state;
              }

            default:
              return state;
          }
        },
        { status: 'waiting' }
      );

    const DiningHakkers = () =>
      createSetupBehavior<any, any>(
        (state, ctx) => {
          const chopsticks = Array(5)
            .fill(null)
            .map((_, i) => {
              return ctx.spawn(Chopstick(), `Chopstick ${i}`);
            });

          const hakkers = ['A', 'B', 'C', 'D', 'E'].map((name, i) => {
            return ctx.spawn(
              Hakker(name, chopsticks[i], chopsticks[(i + 1) % 5]),
              name
            );
          });

          hakkers.forEach(hakker => {
            ctx.send(hakker, { type: 'think' });
          });

          return undefined;
        },
        s => s,
        undefined
      );

    const system = createSystem(DiningHakkers(), 'diningHakkers');
  }, 30000);
});
