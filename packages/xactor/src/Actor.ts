import { ActorContext, Behavior, ActorSignal, BehaviorTag } from './Behavior';
import { ActorRef } from './ActorRef';
import { ActorSystem } from '.';

enum ActorRefStatus {
  Idle,
  Processing,
}

export class Actor<T> {
  private actorContext: ActorContext<T>;
  private children = new Set<ActorRef<any>>();
  private mailbox: T[] = [];
  private status: ActorRefStatus = ActorRefStatus.Idle;

  constructor(
    private behavior: Behavior<T>,
    public name: string,
    ref: ActorRef<T>,
    private system: ActorSystem<any>
  ) {
    this.actorContext = {
      self: ref,
      system: this.system,
      log: this.system.logger(ref),
      children: this.children,
      spawn: this.spawn.bind(this),
      stop: (child: ActorRef<any>): void => {
        child.signal(ActorSignal.PostStop);
        this.children.delete(child);
      },
    };

    // start immediately?
    this.behavior =
      this.behavior.receiveSignal?.(this.actorContext, ActorSignal.Start) ||
      this.behavior;
  }

  public receive(message: T): void {
    this.mailbox.push(message);
    if (this.status === ActorRefStatus.Idle) {
      this.flush();
    }
  }
  public receiveSignal(signal: ActorSignal): void {
    this.behavior =
      this.behavior.receiveSignal?.(this.actorContext, signal) || this.behavior;
  }
  private process(message: T): void {
    this.status = ActorRefStatus.Processing;

    const nextBehavior = this.behavior.receive(this.actorContext, message);

    this.behavior = nextBehavior;

    this.status = ActorRefStatus.Idle;
  }
  private flush() {
    while (this.mailbox.length) {
      const message = this.mailbox.shift()!;
      this.process(message);
    }
  }

  private spawn<U>(behavior: Behavior<U>, name: string): ActorRef<U> {
    const child = new ActorRef<U>(behavior, name, this.system);
    this.children.add(child);
    return child;
  }
}
