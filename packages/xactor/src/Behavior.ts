import { ActorSystem } from './ActorSystem';
import { ActorRef } from './ActorRef';

export type Logger = any;

export interface ActorContext<T> {
  self: ActorRef<T>;
  system: ActorSystem<any>;
  log: Logger;
  children: Set<ActorRef<any>>;

  // spawnAnonymous<U>(behavior: Behavior<U>): ActorRef<U>;
  spawn<U>(behavior: Behavior<U>, name: string): ActorRef<U>;
  stop<U>(child: ActorRef<U>): void;
}

export enum BehaviorTag {
  Default,
  Same,
  Stopped,
}

export enum ActorSignal {
  Start,
  Stop,
  PostStop,
}

export type Behavior<T> = {
  readonly _tag: BehaviorTag;
  receive(ctx: ActorContext<T>, msg: T): Behavior<T> | BehaviorTag;
  receiveSignal?(
    ctx: ActorContext<T>,
    signal: ActorSignal
  ): Behavior<T> | BehaviorTag;
};
