import { ActorContext, Behavior, Behaviors } from './Behavior';
import { ActorSystem } from './ActorSystem';

export interface ActorRef<T> {
  send(message: T): void;
}

export class ActorRef<T> {
  private actorContext: ActorContext<T>;
  private children = new Set<ActorRef<any>>();

  constructor(private behavior: Behavior<T>, private system: ActorSystem) {
    this.actorContext = {
      self: this,
      system: this.system,
      log: () => {},
      children: this.children,
      spawn: this.spawn.bind(this),
      stop: (child) => {
        this.children.delete(child);
      },
    };
  }

  public send(message: T): void {
    const nextBehavior = this.behavior.receive(this.actorContext, message);

    if (nextBehavior !== Behaviors.Same) {
      this.behavior = nextBehavior;
    }
  }

  private spawn<U>(behavior: Behavior<U>, name: string): ActorRef<U> {
    console.log('spawned', name);
    return new ActorRef<U>(behavior, this.system);
  }
}
