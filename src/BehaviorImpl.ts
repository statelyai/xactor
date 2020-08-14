import {
  ActorContext,
  BehaviorTag,
  ActorSignal,
  ActorSignalType,
  Misbehavior,
  MisbehaviorTag,
} from './Behavior';

export const isSignal = (msg: any): msg is ActorSignal => {
  return (
    msg !== null &&
    typeof msg === 'object' &&
    Object.values(ActorSignalType).includes(msg.type)
  );
};

export type TaggedState<TState> = [TState, MisbehaviorTag];

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
    (state[1] === MisbehaviorTag.Default || state[1] === MisbehaviorTag.Stopped)
  );
}

export function fromReducer<T, TState = any>(
  reducer: BehaviorReducer<TState, T>,
  initial: TState
): Misbehavior<T, TState> {
  return [
    (taggedState, msg, ctx) => {
      const [state, tag] = taggedState;
      const nextState = reducer(state, msg, ctx);

      const nextTaggedState = isTaggedState(nextState)
        ? nextState
        : ([nextState, tag] as TaggedState<TState>);

      return nextTaggedState;
    },
    [initial, MisbehaviorTag.Setup],
  ];
}

// export function withSetup<T, TState = any>(
//   setup: (state: TState, actorContext: ActorContext<T>) => TState,
//   reducer: BehaviorReducer<TState, T>,
//   initial: TState
// ): Misbehavior<T, TState> {
//   return [
//     (state, msg, ctx) => {

//     }
//   ]
// }

export function fromReceive<T>(
  fn?: (ctx: ActorContext<T>, msg: T) => void,
  signalFn?: (ctx: ActorContext<T>, signal: ActorSignal) => void
): Misbehavior<T> {
  return [
    (_, msg, ctx) => {
      if (isSignal(msg)) {
        signalFn?.(ctx, msg);
        return [undefined, MisbehaviorTag.Default];
      }

      fn?.(ctx, msg);
      return [undefined, MisbehaviorTag.Default];
    },
    [undefined, MisbehaviorTag.Setup],
  ];
}
