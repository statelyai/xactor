import { ActorSystem } from './ActorSystem';
import { Actor, Listener } from './Actor';
import {
  ActorSignal,
  Behavior,
  Subscribable,
  Observer,
  EventObject,
} from './types';
import { symbolObservable } from './observable';

export interface BaseActorRef<T, TEmitted = any>
  extends Subscribable<TEmitted> {
  send: (event: T) => void;
}

export interface ActorRef<TEvent extends EventObject, TEmitted = any>
  extends Subscribable<TEmitted> {
  send: (event: TEvent) => void;
}

export type ActorRefOf<
  TBehavior extends Behavior<any, any>
> = TBehavior extends Behavior<infer TEvent, infer TState>
  ? XActorRef<TEvent, TState>
  : never;

function unhandledErrorListener(error: any) {
  console.error(error);
}

export class XActorRef<TEvent extends EventObject, TEmitted = any>
  implements Subscribable<TEmitted>, ActorRef<TEvent, TEmitted> {
  private actor: Actor<TEvent, TEmitted>;
  // private system: ActorSystem<any>;
  public name: string;

  constructor(
    behavior: Behavior<TEvent, TEmitted>,
    name: string,
    system: ActorSystem<any>
  ) {
    this.name = name;
    this.actor = new Actor(behavior, name, this, system);
    this.send = this.send.bind(this);
    // this.system = system;
  }

  public start(): void {
    this.actor.start();
  }

  public send(message: TEvent): void {
    this.actor.receive(message);
  }

  public signal(signal: ActorSignal): void {
    this.actor.receiveSignal(signal);
  }

  public subscribe(
    listener?: Listener<TEmitted> | Observer<TEmitted> | null,
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
