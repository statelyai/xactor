import { Listener } from './Actor';
import { XActorRef } from './ActorRef';
import { symbolObservable } from './observable';
import { Behavior, Subscribable, Observer, EventObject } from './types';

export class ActorSystem<TEvent extends EventObject, TEmitted = any>
  implements Subscribable<TEmitted> {
  public settings: any;
  private guardian: XActorRef<TEvent>;
  public logger = (actorRef: XActorRef<any>) => (...args: any[]) => {
    const label =
      actorRef === this.guardian
        ? `[${this.name}]`
        : `[${this.name}/${actorRef.name}]`;
    console.log(label, ...args);
  };

  // TODO: structured logging
  public logs: Array<
    | {
        from: XActorRef<any>;
        to: XActorRef<any>;
        message: any;
      }
    | {
        ref: XActorRef<any>;
        log: string;
      }
  > = [];

  constructor(behavior: Behavior<TEvent, TEmitted>, public name: string) {
    this.guardian = new XActorRef(behavior, name, this);
    this.guardian.start();
  }

  public send(message: TEvent) {
    this.guardian.send(message);
  }

  public subscribe(listener?: Listener<TEmitted> | Observer<TEmitted> | null) {
    return this.guardian.subscribe(listener);
  }

  public [symbolObservable]() {
    return this;
  }

  public getSnapshot(): TEmitted {
    return this.guardian.getSnapshot();
  }
}

export function createSystem<TEvent extends EventObject, TEmitted = any>(
  behavior: Behavior<TEvent, TEmitted>,
  name: string
) {
  return new ActorSystem<TEvent, TEmitted>(behavior, name);
}
