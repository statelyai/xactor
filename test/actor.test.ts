import { createBehavior, createSystem } from '../src';

describe('getSnapshot() method', () => {
  it('should return a snapshot of the most recently emitted state', () => {
    const behavior = createBehavior<{ type: 'update'; value: number }>(
      (state, msg) => {
        if (msg.type === 'update') {
          return msg.value;
        }

        return state;
      },
      42
    );
    const system = createSystem(behavior, 'test');

    expect(system.getSnapshot()).toEqual(42);
  });

  it('should keep snapshot up to date after state changes', () => {
    const behavior = createBehavior<{ type: 'update'; value: number }>(
      (state, msg) => {
        if (msg.type === 'update') {
          return msg.value;
        }

        return state;
      },
      42
    );
    const system = createSystem(behavior, 'test');

    expect(system.getSnapshot()).toEqual(42);

    system.send({ type: 'update', value: 55 });

    setTimeout(() => {
      expect(system.getSnapshot()).toEqual(55);
    });
  });
});
