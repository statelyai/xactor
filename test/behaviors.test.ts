import { createBehavior, createSystem, isSignal } from '../src';
import { from, interval } from 'rxjs';
import { map } from 'rxjs/operators';

describe('behaviors', () => {
  it('should result in same behavior', done => {
    const helloWorldBehavior = createBehavior<{ type: 'greet'; whom: string }>(
      (_, message) => {
        if (isSignal(message)) {
          return undefined;
        }

        console.log('Sup, ' + message.whom);

        return undefined;
      },
      undefined
    );

    const system = createSystem(helloWorldBehavior, 'Hello');

    system.send({ type: 'greet', whom: 'David' });

    setTimeout(() => {
      done();
    }, 1000);
  });
});

describe('promise behavior', () => {
  it('can receive a response from a resolved promise', done => {
    const behavior = createBehavior<{ type: 'response'; value: number }>(
      (state, msg, ctx) => {
        if (msg.type === 'response') {
          expect(msg.value).toEqual(42);
          done();
          return state;
        }

        if (state === 'idle') {
          ctx.spawnFrom(() => {
            return new Promise<{ type: 'response'; value: number }>(res => {
              setTimeout(() => {
                res({ type: 'response', value: 42 });
              }, 100);
            });
          }, 'promise');

          return 'pending';
        }

        return state;
      },
      'idle'
    );

    // @ts-ignore
    const system = createSystem(behavior, 'sys');
  });
});

describe('observable behavior', () => {
  it('can receive multiple values from an observable', done => {
    const behavior = createBehavior<{ type: 'response'; value: number }>(
      (state, msg, ctx) => {
        if (msg.type === 'response' && msg.value === 3) {
          done();
          return state;
        }

        if (state === 'idle') {
          ctx.spawnFrom(() => {
            return interval(10).pipe(
              map(n => ({
                type: 'response',
                value: n,
              }))
            );
          }, 'observable');

          return 'pending';
        }

        return state;
      },
      'idle'
    );

    // @ts-ignore
    const system = createSystem(behavior, 'sys');
  });

  it('can be consumed as an observable', done => {
    const behavior = createBehavior<{ type: 'event'; value: number }, number>(
      (state, message) => {
        if (message.type === 'event') {
          return message.value;
        }

        return state;
      },
      0
    );

    const system = createSystem(behavior, 'sys');

    const num$ = from(system);

    num$.subscribe(value => {
      if (value === 42) {
        done();
      }
    });

    system.send({ type: 'event', value: 42 });
  });
});
