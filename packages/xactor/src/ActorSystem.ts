import { ActorRef } from './ActorRef';
import { Behavior } from './Behavior';

export class ActorSystem<T> {
  public settings: any;
  private guardian: ActorRef<any>;
  public logger = (actorRef: ActorRef<any>) => (...args: any[]) => {
    console.log(`[${this.name}/${actorRef.name}]`, ...args);
  };

  constructor(behavior: Behavior<T>, public name: string) {
    this.guardian = new ActorRef(behavior, name, this);
  }

  send(message: T) {
    this.guardian.send(message);
  }
}
