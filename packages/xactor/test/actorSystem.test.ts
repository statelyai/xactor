import { ActorSystem, Behavior } from '../src';

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
});
