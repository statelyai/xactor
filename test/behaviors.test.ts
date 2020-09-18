import { createBehavior, createSystem, isSignal } from '../src';

describe('behaviors', () => {
  it('should result in same behavior', done => {
    const helloWorldBehavior = createBehavior<{ whom: string }>(
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

    system.send({ whom: 'David' });

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
          ctx.spawnPromise(() => {
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
