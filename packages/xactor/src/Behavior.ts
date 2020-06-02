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
  Same,
  Stopped,
}

export enum ActorSignal {
  Start,
  Stop,
  PostStop,
}

export type Behavior<T> = {
  receive(ctx: ActorContext<T>, msg: T): Behavior<T>;
  receiveSignal?(ctx: ActorContext<T>, signal: ActorSignal): Behavior<T>;
};
