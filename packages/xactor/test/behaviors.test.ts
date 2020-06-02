import { receive } from '../src/BehaviorImpl';
import { BehaviorTag } from '../src/Behavior';
import { ActorSystem } from '../src';

describe('behaviors', () => {
  it('Behaviors.Same should result in same behavior', (done) => {
    const helloWorldBehavior = receive<{ whom: string }>((_, message) => {
      console.log('Sup, ' + message.whom);

      return BehaviorTag.Same;
    });

    const system = new ActorSystem(helloWorldBehavior, 'Hello');

    system.send({ whom: 'David' });

    setTimeout(() => {
      done();
    }, 1000);
  });
});
