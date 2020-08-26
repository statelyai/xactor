import { ActorSystem } from './ActorSystem';
import { ActorRef } from './ActorRef';

export type Logger = any;

export interface ActorContext<T> {
  self: ActorRef<T>;
  system: ActorSystem<any>;
  log: Logger;
  children: Set<ActorRef<any>>;
  watch: (actorRef: ActorRef<any>) => void;
  send: <U>(actorRef: ActorRef<U>, message: U) => void;
  subscribeTo: (topic: 'watchers', subscriber: ActorRef<any>) => void;

  // spawnAnonymous<U>(behavior: Behavior<U>): ActorRef<U>;
  spawn<U>(behavior: Behavior<U>, name: string): ActorRef<U>;
  stop<U>(child: ActorRef<U>): void;
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
  | { type: ActorSignalType.Watch; ref: ActorRef<any> }
  | { type: ActorSignalType.Terminated; ref: ActorRef<any> }
  | { type: ActorSignalType.Subscribe; ref: ActorRef<any> }
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

export type Behavior<T, TState = any> = [
  (
    state: TaggedState<TState>,
    message: T | ActorSignal,
    ctx: ActorContext<T>
  ) => TaggedState<TState>,
  TaggedState<TState>
];
