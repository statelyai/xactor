import { Listener } from './Actor';
import { ActorRef } from './ActorRef';
import { Behavior, Subscribable } from './types';

export class ActorSystem<T, TEmitted = any> implements Subscribable<TEmitted> {
  public settings: any;
  private guardian: ActorRef<T>;
  public logger = (actorRef: ActorRef<any>) => (...args: any[]) => {
    const label =
      actorRef === this.guardian
        ? `[${this.name}]`
        : `[${this.name}/${actorRef.name}]`;
    console.log(label, ...args);
  };

  // TODO: structured logging
  public logs: Array<
    | {
        from: ActorRef<any>;
        to: ActorRef<any>;
        message: any;
      }
    | {
        ref: ActorRef<any>;
        log: string;
      }
  > = [];

  constructor(behavior: Behavior<T, TEmitted>, public name: string) {
    this.guardian = new ActorRef(behavior, name, this);
  }

  send(message: T) {
    this.guardian.send(message);
  }

  subscribe(listener: Listener<TEmitted>) {
    return this.guardian.subscribe(listener);
  }
}

export function createSystem<T, TEmitted = any>(
  behavior: Behavior<T, TEmitted>,
  name: string
) {
  return new ActorSystem<T, TEmitted>(behavior, name);
}
