import { ActorContext, Behavior, Behaviors, ActorSignal } from './Behavior';

export function receive<T>(
  onMessage: (actorCtx: ActorContext<T>, message: T) => Behavior<T> | Behaviors
): Behavior<T> {
  const behavior: Behavior<T> = {
    receive(actorCtx, message) {
      const newBehavior = onMessage(actorCtx, message);

      if (newBehavior === Behaviors.Same) {
        return behavior;
      }

      return newBehavior;
    },
  };

  return behavior;
}

export function setup<T>(
  setup: (ctx: ActorContext<T>) => Behavior<T>
): Behavior<T> {
  return {
    receive() {
      throw new Error('Not started yet');
    },
    receiveSignal(ctx, signal) {
      switch (signal) {
        case ActorSignal.Start:
          return setup(ctx);
        default:
          throw new Error('not implemented');
      }
    },
  };
}
