import { ActorSignal, Behavior } from './Behavior';
import { ActorSystem } from './ActorSystem';
import { Actor, Listener } from './Actor';
import { Subscribable } from './types';

export interface ActorRef<T> {
  send(message: T): void;
}

export class ActorRef<T> implements Subscribable<any> {
  private actor: Actor<T>;
  // private system: ActorSystem<any>;
  public name: string;

  constructor(behavior: Behavior<T>, name: string, system: ActorSystem<any>) {
    this.name = name;
    this.actor = new Actor(behavior, name, this, system);
    // this.system = system;
  }

  public send(message: T): void {
    this.actor.receive(message);
  }

  public signal(signal: ActorSignal): void {
    this.actor.receiveSignal(signal);
  }

  public subscribe(listener: Listener<any>) {
    return this.actor.subscribe(listener, err => {
      console.log('ERROR', err);
    });
  }
}
