import { ActorRef } from './ActorRef';
import { Behavior } from './Behavior';

export class ActorSystem<T> {
  public settings: any;
  private root: ActorRef<any>;

  constructor(behavior: Behavior<T>, public name: string) {
    this.root = new ActorRef(behavior, this);
  }

  send(message: T) {
    this.root.send(message);
  }
}
