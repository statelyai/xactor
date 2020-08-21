import { Listener } from './Actor';
import { ActorRef } from './ActorRef';
import { Behavior } from './Behavior';
import { Subscribable } from './types';

export class ActorSystem<T> implements Subscribable<any> {
  public settings: any;
  private guardian: ActorRef<any>;
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

  constructor(behavior: Behavior<T>, public name: string) {
    this.guardian = new ActorRef(behavior, name, this);
  }

  send(message: T) {
    this.guardian.send(message);
  }

  subscribe(listener: Listener<any>) {
    return this.guardian.subscribe(listener);
  }
}

export function createSystem<T>(behavior: Behavior<T>, name: string) {
  return new ActorSystem<T>(behavior, name);
}
