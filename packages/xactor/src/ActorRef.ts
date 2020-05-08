import { ActorContext, Behavior, Behaviors, ActorSignal } from './Behavior';
import { ActorSystem } from './ActorSystem';

export interface ActorRef<T> {
  send(message: T): void;
}

enum ActorRefStatus {
  Idle,
  Processing,
}

export class ActorRef<T> {
  private actorContext: ActorContext<T>;
  private children = new Set<ActorRef<any>>();
  private mailbox: T[] = [];
  private status: ActorRefStatus = ActorRefStatus.Idle;

  constructor(
    private behavior: Behavior<T>,
    public name: string,
    private system: ActorSystem<any>
  ) {
    this.actorContext = {
      self: this,
      system: this.system,
      log: this.system.logger(this),
      children: this.children,
      spawn: this.spawn.bind(this),
      stop: (child) => {
        this.children.delete(child);
      },
    };

    // start immediately?
    this.behavior =
      this.behavior.receiveSignal?.(this.actorContext, ActorSignal.Start) ||
      this.behavior;
  }

  public send(message: T): void {
    this.mailbox.push(message);
    if (this.status === ActorRefStatus.Idle) {
      this.flush();
    }
  }
  private process(message: T): void {
    this.status = ActorRefStatus.Processing;

    const nextBehavior = this.behavior.receive(this.actorContext, message);

    if (nextBehavior !== Behaviors.Same) {
      this.behavior = nextBehavior;
    }

    this.status = ActorRefStatus.Idle;
  }
  private flush() {
    while (this.mailbox.length) {
      const message = this.mailbox.shift()!;
      this.process(message);
    }
  }

  private spawn<U>(behavior: Behavior<U>, name: string): ActorRef<U> {
    return new ActorRef<U>(behavior, name, this.system);
  }
}
