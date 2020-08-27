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
