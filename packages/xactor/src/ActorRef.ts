import { ActorContext, Behavior, Behaviors, ActorSignal } from './Behavior';
import { ActorSystem } from './ActorSystem';
import { Actor } from './Actor';

export interface ActorRef<T> {
  send(message: T): void;
}

export class ActorRef<T> {
  private actor: Actor<T>;
  public name: string;

  constructor(behavior: Behavior<T>, name: string, system: ActorSystem<any>) {
    this.name = name;
    this.actor = new Actor(behavior, name, this, system);
  }

  public send(message: T): void {
    this.actor.receive(message);
  }
}
