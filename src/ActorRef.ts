import { ActorSystem } from './ActorSystem';
import { Actor, Listener } from './Actor';
import { ActorSignal, Behavior, Subscribable } from './types';

export interface ActorRef<T, TEmitted = any> extends Subscribable<TEmitted> {
  send(message: T): void;
}

export class ActorRef<T, TEmitted = any> implements Subscribable<TEmitted> {
  private actor: Actor<T, TEmitted>;
  // private system: ActorSystem<any>;
  public name: string;

  constructor(
    behavior: Behavior<T, TEmitted>,
    name: string,
    system: ActorSystem<any>
  ) {
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

  public subscribe(listener: Listener<TEmitted>) {
    return this.actor.subscribe(listener, err => {
      console.log('ERROR', err);
    });
  }

  public getSnapshot(): TEmitted {
    return this.actor.getSnapshot();
  }
}
