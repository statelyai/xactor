import {
  ActorContext,
  Behavior,
  BehaviorTag,
  ActorSignal,
  ActorSignalType,
  Misbehavior,
  MisbehaviorTag,
} from './Behavior';

export function isBehavior<T>(behavior: any): behavior is Behavior<T> {
  return typeof behavior === 'object' && '_tag' in behavior;
}

// function resolveBehavior<T>(
//   behaviorOrTag: Behavior<T> | BehaviorTag,
//   previousBehavior: Misbehavior<T>
// ): Misbehavior<T> {
//   const behaviorTag = isBehavior(behaviorOrTag)
//     ? behaviorOrTag._tag
//     : behaviorOrTag;

//   switch (behaviorTag) {
//     case BehaviorTag.Stopped:
//       return [() => {}, null];
//     // this.actorContext.children.forEach((child) => {
//     //   this.actorContext.stop(child);
//     // });

//     // this.topics.watchers.forEach((watcher) => {
//     //   watcher.signal({
//     //     type: ActorSignalType.Terminated,
//     //     ref: this.actorContext.self,
//     //   });
//     // });

//     // const stoppedBehavior =
//     //   (this.behavior.receiveSignal?.(this.actorContext, {
//     //     type: ActorSignalType.PostStop,
//     //   }) as Behavior<T>) || this.behavior;

//     // return stoppedBehavior;
//     case BehaviorTag.Default:
//       return [() => {}, null];
//     // return behaviorOrTag as Behavior<T>;
//     case BehaviorTag.Same:
//     default:
//       return previousBehavior;
//     // return this.behavior;
//   }
// }

export const isSignal = (msg: any): msg is ActorSignal => {
  return (
    msg !== null &&
    typeof msg === 'object' &&
    Object.values(ActorSignalType).includes(msg.type)
  );
};

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

export type TaggedState<TState> = [TState, MisbehaviorTag];

export type BehaviorReducer<TState, TEvent> = (
  state: TState,
  event: TEvent | ActorSignal,
  actorCtx: ActorContext<TEvent>
) => TState | TaggedState<TState>;

export function reduce<TState, TEvent>(
  reducer: BehaviorReducer<TState, TEvent>,
  initialState: TState
): Behavior<TEvent> {
  const createReducerBehavior = (state: TState): Behavior<TEvent> => {
    return {
      _tag: BehaviorTag.Default,
      receive(ctx, event) {
        const nextState = reducer(state, event, ctx);

        return createReducerBehavior(nextState as any);
      },
    };
  };

  return createReducerBehavior(initialState);
}

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
