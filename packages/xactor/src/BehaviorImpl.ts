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

      if (newBehavior === Behaviors.Stopped) {
        return {
          receive: () => null as any,
        };
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

export type BehaviorReducer<TState, TEvent> = (
  state: TState,
  event: TEvent,
  actorCtx: ActorContext<TEvent>
) => TState;

export function reduce<TState, TEvent>(
  reducer: BehaviorReducer<TState, TEvent>,
  initialState: TState
): Behavior<TEvent> {
  const createReducerBehavior = (state: TState): Behavior<TEvent> => {
    return {
      receive(ctx, event) {
        const nextState = reducer(state, event, ctx);

        return createReducerBehavior(nextState);
      },
    };
  };

  return createReducerBehavior(initialState);
}
