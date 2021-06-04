import { XActorRef } from './ActorRef';
import {
  ActorContext,
  BehaviorTag,
  ActorSignal,
  ActorSignalType,
  Behavior,
  TaggedState,
  BehaviorReducer,
  Subscribable,
  Observer,
  Subscription,
  EventObject,
} from './types';

export const isSignal = (msg: any): msg is ActorSignal => {
  return (
    msg !== null &&
    typeof msg === 'object' &&
    Object.values(ActorSignalType).includes(msg.type)
  );
};

export function isTaggedState<TState>(
  state: TState | TaggedState<TState>
): state is TaggedState<TState> {
  return typeof state === 'object' && state !== null && '$$tag' in state;
}

function createContextProxy<TEvent extends EventObject>(
  ctx: ActorContext<TEvent>
): [ActorContext<TEvent>, any[]] {
  const effects: any[] = [];

  return [
    {
      ...ctx,
      spawn: (behavior, name) => {
        const actor = ctx.spawn(behavior, name);

        effects.push({
          type: 'start',
          actor,
        });

        return actor;
      },
      spawnFrom: (getEntity, name) => {
        const actor = ctx.spawnFrom(getEntity, name);

        effects.push({
          type: 'start',
          actor,
        });

        return actor;
      },
    },
    effects,
  ];
}

export function createBehavior<TEvent extends EventObject, TState = any>(
  reducer: BehaviorReducer<TState, TEvent>,
  initial: TState
): Behavior<TEvent, TState> {
  return [
    (taggedState, msg, ctx) => {
      const { state, $$tag: tag } = taggedState;

      const [ctxProxy, effects] = createContextProxy(ctx);
      const nextState = reducer(state, msg, ctxProxy);

      const nextTaggedState = isTaggedState(nextState)
        ? nextState
        : {
            state: nextState,
            $$tag: tag === BehaviorTag.Setup ? BehaviorTag.Default : tag,
            effects,
          };

      return nextTaggedState;
    },
    { state: initial, $$tag: BehaviorTag.Setup, effects: [] },
  ];
}

export function createStatelessBehavior<TEvent extends EventObject>(
  reducer: BehaviorReducer<undefined, TEvent>
): Behavior<TEvent, undefined> {
  return createBehavior((_, msg, ctx) => {
    reducer(undefined, msg, ctx);
    return undefined;
  }, undefined);
}

export function createSetupBehavior<TEvent extends EventObject, TState = any>(
  setup: (
    initialState: TState,
    ctx: ActorContext<TEvent>
  ) => TState | TaggedState<TState>,
  reducer: BehaviorReducer<TState, TEvent>,
  initial: TState
): Behavior<TEvent, TState> {
  return [
    (taggedState, msg, ctx) => {
      const { state, $$tag: tag } = taggedState;
      const isSetup = tag === BehaviorTag.Setup;

      const [ctxProxy, effects] = createContextProxy(ctx);
      const nextState = isSetup
        ? setup(state, ctxProxy)
        : reducer(state, msg, ctxProxy);

      const nextTaggedState = isTaggedState(nextState)
        ? { ...nextState, effects }
        : {
            state: nextState,
            $$tag: isSetup ? BehaviorTag.Default : tag,
            effects,
          };

      return nextTaggedState;
    },
    { state: initial, $$tag: BehaviorTag.Setup, effects: [] },
  ];
}

export function withTag<TState>(
  state: TState,
  tag: BehaviorTag = BehaviorTag.Default
): TaggedState<TState> {
  return {
    state,
    $$tag: tag,
    effects: [],
  };
}

export function createTimeout<TEvent extends EventObject>(
  parentRef: XActorRef<TEvent>,
  fn: (parentRef: XActorRef<TEvent>) => void,
  timeout: number
): Behavior<any> {
  return [
    s => {
      setTimeout(() => {
        fn(parentRef);
      }, timeout);
      return s;
    },
    withTag(undefined),
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

export function fromPromise<T>(
  getPromise: () => Promise<T>,
  resolve: (value: T) => void,
  reject?: (error: any) => void
): Behavior<any, T | undefined> {
  return [
    taggedState => {
      if (taggedState.$$tag === BehaviorTag.Setup) {
        getPromise().then(resolve, reject);

        return withTag(taggedState.state, BehaviorTag.Default);
      }

      return taggedState;
    },
    withTag(undefined, BehaviorTag.Setup),
  ];
}

export function fromObservable<T>(
  getObservable: () => Subscribable<T>,
  observer: Observer<T>
): Behavior<any, T | undefined> {
  let sub: Subscription;

  return [
    (taggedState, msg) => {
      if (taggedState.$$tag === BehaviorTag.Setup) {
        sub = getObservable().subscribe(observer);

        return withTag(taggedState.state, BehaviorTag.Default);
      }

      if (isSignal(msg) && msg.type === ActorSignalType.PostStop) {
        sub?.unsubscribe();

        return stopped(undefined);
      }

      return taggedState;
    },
    withTag(undefined, BehaviorTag.Setup),
  ];
}

export function fromEntity<T>(
  getEntity: () => Promise<T> | Subscribable<T>,
  observer: Observer<T>
): Behavior<any, T | undefined> {
  return [
    taggedState => {
      if (taggedState.$$tag === BehaviorTag.Setup) {
        const entity = getEntity();

        if ('subscribe' in entity) {
          entity.subscribe(observer);
        } else {
          entity.then(observer.next, observer.error);
        }

        return withTag(taggedState.state, BehaviorTag.Default);
      }

      return taggedState;
    },
    withTag(undefined, BehaviorTag.Setup),
  ];
}
