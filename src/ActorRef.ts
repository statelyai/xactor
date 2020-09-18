import { ActorSystem } from './ActorSystem';
import { Actor, Listener } from './Actor';
import { ActorSignal, Behavior, Subscribable, Observer } from './types';
import { symbolObservable } from './observable';

export interface ActorRef<T, TEmitted = any> extends Subscribable<TEmitted> {
  send(message: T): void;
}

function unhandledErrorListener(error: any) {
  console.error(error);
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
    this.send = this.send.bind(this);
    // this.system = system;
  }

  public send(message: T): void {
    this.actor.receive(message);
  }

  public signal(signal: ActorSignal): void {
    this.actor.receiveSignal(signal);
  }

  public subscribe(
    listener: Listener<TEmitted> | Observer<TEmitted>,
    errorListener: Listener<any> = unhandledErrorListener
  ) {
    const observer =
      typeof listener === 'function'
        ? ({
            next: listener,
            error: errorListener,
          } as Observer<TEmitted>)
        : listener;

    return this.actor.subscribe(observer);
  }

  public getSnapshot(): TEmitted {
    return this.actor.getSnapshot();
  }

  public [symbolObservable]() {
    return this;
  }
}
