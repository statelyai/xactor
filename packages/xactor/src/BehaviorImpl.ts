import { ActorContext, Behavior, Behaviors } from './Behavior';

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
