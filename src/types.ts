import { XActorRef } from './ActorRef';
import { ActorSystem } from './ActorSystem';

export interface Subscription {
  unsubscribe(): void;
}

// export interface Observer<T> {
//   // Sends the next value in the sequence
//   next?: (value: T) => void;

//   // Sends the sequence error
//   error?: (errorValue: any) => void;

//   // Sends the completion notification
//   complete: any; // TODO: what do you want, RxJS???
// }

/** OBSERVER INTERFACES - from RxJS */
export interface NextObserver<T> {
  closed?: boolean;
  next: (value: T) => void;
  error?: (err: any) => void;
  complete?: () => void;
}
export interface ErrorObserver<T> {
  closed?: boolean;
  next?: (value: T) => void;
  error: (err: any) => void;
  complete?: () => void;
}
export interface CompletionObserver<T> {
  closed?: boolean;
  next?: (value: T) => void;
  error?: (err: any) => void;
  complete: () => void;
}

export type Observer<T> =
  | NextObserver<T>
  | ErrorObserver<T>
  | CompletionObserver<T>;

export interface Subscribable<T> {
  subscribe(observer: Observer<T>): Subscription;
  subscribe(
    next: (value: T) => void,
    error?: (error: any) => void,
    complete?: () => void
  ): Subscription;
}

export interface SubscribableByObserver<T> {
  subscribe(observer: Observer<T>): Subscription;
}

export type Logger = any;

export interface ActorContext<TEvent extends EventObject> {
  self: XActorRef<TEvent>;
  system: ActorSystem<any>;
  log: Logger;
  children: Set<XActorRef<any>>;
  watch: (actorRef: XActorRef<any>) => void;
  send: <U extends EventObject>(actorRef: XActorRef<U>, message: U) => void;
  subscribeTo: (topic: 'watchers', subscriber: XActorRef<any>) => void;

  // spawnAnonymous<U>(behavior: Behavior<U>): ActorRef<U>;
  spawn<U extends EventObject>(
    behavior: Behavior<U>,
    name: string
  ): XActorRef<U>;
  spawnFrom<U extends TEvent>(
    getEntity: () => Promise<U> | Subscribable<U>,
    name: string
  ): XActorRef<any, U | undefined>;
  stop<U extends EventObject>(child: XActorRef<U>): void;
}

export enum ActorSignalType {
  Start,
  PostStop,
  Watch,
  Terminated,
  Subscribe,
  Emit,
}

export type ActorSignal =
  | { type: ActorSignalType.Start }
  | { type: ActorSignalType.PostStop }
  | { type: ActorSignalType.Watch; ref: XActorRef<any> }
  | { type: ActorSignalType.Terminated; ref: XActorRef<any> }
  | { type: ActorSignalType.Subscribe; ref: XActorRef<any> }
  | { type: ActorSignalType.Emit; value: any };

export enum BehaviorTag {
  Setup,
  Default,
  Stopped,
}

export interface TaggedState<TState> {
  state: TState;
  $$tag: BehaviorTag;
  effects: any[];
}

export type Behavior<TEvent extends EventObject, TState = any> = [
  (
    state: TaggedState<TState>,
    message: TEvent | ActorSignal,
    ctx: ActorContext<TEvent>
  ) => TaggedState<TState>,
  TaggedState<TState>
];

export type BehaviorReducer<TState, TEvent extends EventObject> = (
  state: TState,
  event: TEvent | ActorSignal,
  actorCtx: ActorContext<TEvent>
) => TState | TaggedState<TState>;

export interface EventObject {
  type: string;
}
