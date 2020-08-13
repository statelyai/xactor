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
  spawn<U>(behavior: Misbehavior<U>, name: string): ActorRef<U>;
  stop<U>(child: ActorRef<U>): void;
}

export enum BehaviorTag {
  Default,
  Same,
  Stopped,
  Topic,
}

export enum ActorSignalType {
  Start,
  PostStop,
  Watch,
  Terminated,
}

export type ActorSignal =
  | { type: ActorSignalType.Start }
  | { type: ActorSignalType.PostStop }
  | { type: ActorSignalType.Watch; ref: ActorRef<any> }
  | { type: ActorSignalType.Terminated; ref: ActorRef<any> };

export type Behavior<T> = {
  readonly _tag: BehaviorTag;
  receive(ctx: ActorContext<T>, msg: T): Behavior<T> | BehaviorTag;
  receiveSignal?(
    ctx: ActorContext<T>,
    signal: ActorSignal
  ): Behavior<T> | BehaviorTag;
};

export enum MisbehaviorTag {
  Default,
  Stopped,
}

export type Misbehavior<T, TState = any> = [
  (
    state: TState,
    message: T | ActorSignal,
    ctx: ActorContext<T>
  ) => [TState, MisbehaviorTag],
  TState
];
