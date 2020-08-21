import {
  ActorContext,
  BehaviorTag,
  ActorSignal,
  ActorSignalType,
  Behavior,
} from './Behavior';

export const isSignal = (msg: any): msg is ActorSignal => {
  return (
    msg !== null &&
    typeof msg === 'object' &&
    Object.values(ActorSignalType).includes(msg.type)
  );
};

export type TaggedState<TState> = [TState, BehaviorTag];

export type BehaviorReducer<TState, TEvent> = (
  state: TState,
  event: TEvent | ActorSignal,
  actorCtx: ActorContext<TEvent>
) => TState | TaggedState<TState>;

export function stopped(cleanup: () => void): BehaviorTag.Stopped {
  cleanup(); // TODO: determine where this goes

  return BehaviorTag.Stopped;
}

export function isTaggedState<TState>(
  state: TState | TaggedState<TState>
): state is TaggedState<TState> {
  return (
    Array.isArray(state) &&
    (state[1] === BehaviorTag.Default || state[1] === BehaviorTag.Stopped)
  );
}

export function createBehavior<T, TState = any>(
  reducer: BehaviorReducer<TState, T>,
  initial: TState
): Behavior<T, TState> {
  return [
    (taggedState, msg, ctx) => {
      const [state, tag] = taggedState;
      const nextState = reducer(state, msg, ctx);

      const nextTaggedState = isTaggedState(nextState)
        ? nextState
        : ([nextState, tag] as TaggedState<TState>);

      return nextTaggedState;
    },
    [initial, BehaviorTag.Setup],
  ];
}

export function fromReceive<T>(
  fn?: (ctx: ActorContext<T>, msg: T) => void,
  signalFn?: (ctx: ActorContext<T>, signal: ActorSignal) => void
): Behavior<T> {
  return [
    (_, msg, ctx) => {
      if (isSignal(msg)) {
        signalFn?.(ctx, msg);
        return [undefined, BehaviorTag.Default];
      }

      fn?.(ctx, msg);
      return [undefined, BehaviorTag.Default];
    },
    [undefined, BehaviorTag.Setup],
  ];
}
