import { ActorSystem } from './ActorSystem';
import { ActorRef } from './ActorRef';

type Logger = any;

export interface ActorContext<T> {
  self: ActorRef<T>;
  system: ActorSystem;
  log: Logger;
  children: Set<ActorRef<any>>;

  // spawnAnonymous<U>(behavior: Behavior<U>): ActorRef<U>;
  spawn<U>(behavior: Behavior<U>, name: string): ActorRef<U>;
  stop<U>(child: ActorRef<U>): void;
}

export enum Behaviors {
  Same,
}

export interface Behavior<T> {
  receive(ctx: ActorContext<T>, msg: T): Behavior<T> | Behaviors;
}
