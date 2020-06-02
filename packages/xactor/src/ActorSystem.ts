import { ActorRef } from './ActorRef';
import { Behavior } from './Behavior';

export class ActorSystem<T> {
  public settings: any;
  private guardian: ActorRef<any>;
  public logger = (actorRef: ActorRef<any>) => (...args: any[]) => {
    const label =
      actorRef === this.guardian
        ? `[${this.name}]`
        : `[${this.name}/${actorRef.name}]`;
    console.log(label, ...args);
  };

  constructor(behavior: Behavior<T>, public name: string) {
    this.guardian = new ActorRef(behavior, name, this);
  }

  send(message: T) {
    this.guardian.send(message);
  }
}

export function createSystem<T>(behavior: Behavior<T>, name: string) {
  return new ActorSystem<T>(behavior, name);
}
