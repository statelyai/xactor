import {
  ActorContext,
  BehaviorTag,
  ActorSignal,
  ActorSignalType,
  Behavior,
  TaggedState,
} from './Behavior';

export const isSignal = (msg: any): msg is ActorSignal => {
  return (
    msg !== null &&
    typeof msg === 'object' &&
    Object.values(ActorSignalType).includes(msg.type)
  );
};

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
  return typeof state === 'object' && state !== null && '$$tag' in state;
}

export function createBehavior<T, TState = any>(
  reducer: BehaviorReducer<TState, T>,
  initial: TState
): Behavior<T, TState> {
  return [
    (taggedState, msg, ctx) => {
      const { state, $$tag: tag } = taggedState;
      const nextState = reducer(state, msg, ctx);

      const nextTaggedState = isTaggedState(nextState)
        ? nextState
        : {
            state: nextState,
            $$tag: tag,
            effects: [],
          };

      return nextTaggedState;
    },
    { state: initial, $$tag: BehaviorTag.Setup, effects: [] },
  ];
}
