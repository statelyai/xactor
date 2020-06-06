import {
  ActorContext,
  Behavior,
  BehaviorTag,
  ActorSignal,
  ActorSignalType,
} from './Behavior';

export function isBehavior<T>(behavior: any): behavior is Behavior<T> {
  return typeof behavior === 'object' && '_tag' in behavior;
}

export function receive<T>(
  onMessage: (
    actorCtx: ActorContext<T>,
    message: T
  ) => Behavior<T> | BehaviorTag,
  onSignal?: (
    actorCtx: ActorContext<T>,
    signal: ActorSignal
  ) => Behavior<T> | BehaviorTag
): Behavior<T> {
  const behavior: Behavior<T> = {
    _tag: BehaviorTag.Default,
    receive(actorCtx, message) {
      const newBehavior = onMessage(actorCtx, message);

      return newBehavior;
    },
    receiveSignal: onSignal
      ? (actorCtx, signal) => {
          const newBehavior = onSignal(actorCtx, signal);

          return newBehavior;
        }
      : undefined,
  };

  return behavior;
}

export function receiveSignal<T>(
  onSignal: (actorCtx: ActorContext<T>, signal: ActorSignal) => Behavior<T>
): Behavior<T> {
  const behavior = {
    _tag: BehaviorTag.Default,
    receive: () => {
      return behavior;
    },
    receiveSignal: onSignal,
  };

  return behavior;
}

export function setup<T>(
  setup: (ctx: ActorContext<T>) => Behavior<T> | BehaviorTag
): Behavior<T> {
  return {
    _tag: BehaviorTag.Default,
    receive() {
      throw new Error('Not started yet');
    },
    receiveSignal(ctx, signal) {
      switch (signal.type) {
        case ActorSignalType.Start:
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
      _tag: BehaviorTag.Default,
      receive(ctx, event) {
        const nextState = reducer(state, event, ctx);

        return createReducerBehavior(nextState);
      },
    };
  };

  return createReducerBehavior(initialState);
}

export function stopped(cleanup: () => void): BehaviorTag.Stopped {
  cleanup(); // TODO: determine where this goes

  return BehaviorTag.Stopped;
}
