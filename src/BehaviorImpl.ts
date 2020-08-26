import { ActorRef } from './ActorRef';
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

      // const effects: any[] = [];
      // const ctxProxy: ActorContext<T> = {
      //   ...ctx,
      //   spawn: (behavior, name) => {
      //     effects.push({
      //       type: 'spawn',
      //       behavior,
      //       name
      //     })
      //   }
      // }
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

export function createSetupBehavior<T, TState = any>(
  setup: (
    initialState: TState,
    ctx: ActorContext<T>
  ) => TState | TaggedState<TState>,
  reducer: BehaviorReducer<TState, T>,
  initial: TState
): Behavior<T, TState> {
  return [
    (taggedState, msg, ctx) => {
      const { state, $$tag: tag } = taggedState;
      const isSetup = tag === BehaviorTag.Setup;

      // const effects: any[] = [];
      // const ctxProxy: ActorContext<T> = {
      //   ...ctx,
      //   spawn: (behavior, name) => {
      //     effects.push({
      //       type: 'spawn',
      //       behavior,
      //       name
      //     })
      //   }
      // }
      const nextState = isSetup ? setup(state, ctx) : reducer(state, msg, ctx);

      const nextTaggedState = isTaggedState(nextState)
        ? nextState
        : {
            state: nextState,
            $$tag: isSetup ? BehaviorTag.Default : tag,
            effects: [],
          };

      return nextTaggedState;
    },
    { state: initial, $$tag: BehaviorTag.Setup, effects: [] },
  ];
}

export function createTaggedState<TState>(
  state: TState,
  tag: BehaviorTag = BehaviorTag.Default
): TaggedState<TState> {
  return {
    state,
    $$tag: tag,
    effects: [],
  };
}

export function createTimeout<T>(
  parentRef: ActorRef<T>,
  fn: (parentRef: ActorRef<T>) => void,
  timeout: number
): Behavior<any> {
  return [
    s => {
      setTimeout(() => {
        fn(parentRef);
      }, timeout);
      return s;
    },
    createTaggedState(undefined),
  ];
}

export function stopped<TState>(
  state: TState
): TaggedState<TState> & { $$tag: BehaviorTag.Stopped } {
  return {
    state,
    $$tag: BehaviorTag.Stopped,
    effects: [],
  };
}
