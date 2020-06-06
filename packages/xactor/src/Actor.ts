import {
  ActorContext,
  Behavior,
  ActorSignal,
  BehaviorTag,
  ActorSignalType,
} from './Behavior';
import { ActorRef } from './ActorRef';
import { ActorSystem } from '.';
import { isBehavior, stopped } from './BehaviorImpl';

enum ActorRefStatus {
  Idle,
  Processing,
}

export class Actor<T> {
  private actorContext: ActorContext<T>;
  private children = new Set<ActorRef<any>>();
  private mailbox: T[] = [];
  private status: ActorRefStatus = ActorRefStatus.Idle;

  // same as `watching` in Scala ActorRef
  private topics = {
    watchers: new Set<ActorRef<any>>(),
  };

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
        child.signal({ type: ActorSignalType.PostStop });
        this.children.delete(child);
      },
      subscribeTo: (topic: 'watchers', subscriberRef: ActorRef<any>) => {
        this.topics[topic].add(subscriberRef);
      },
      watch: (actorRef) => {
        actorRef.signal({
          type: ActorSignalType.Watch,
          ref,
        });
      },
    };

    // start immediately?
    this.behavior = this.resolveBehavior(
      this.behavior.receiveSignal?.(this.actorContext, {
        type: ActorSignalType.Start,
      }) || this.behavior
    );
  }

  private resolveBehavior(
    behaviorOrTag: Behavior<T> | BehaviorTag
  ): Behavior<T> {
    const behaviorTag = isBehavior(behaviorOrTag)
      ? behaviorOrTag._tag
      : behaviorOrTag;

    switch (behaviorTag) {
      case BehaviorTag.Stopped:
        this.actorContext.children.forEach((child) => {
          this.actorContext.stop(child);
        });

        this.topics.watchers.forEach((watcher) => {
          watcher.signal({
            type: ActorSignalType.Terminated,
            ref: this.actorContext.self,
          });
        });

        const stoppedBehavior =
          (this.behavior.receiveSignal?.(this.actorContext, {
            type: ActorSignalType.PostStop,
          }) as Behavior<T>) || this.behavior;

        return stoppedBehavior;
      case BehaviorTag.Default:
        return behaviorOrTag as Behavior<T>;
      case BehaviorTag.Same:
      default:
        return this.behavior;
    }
  }

  public receive(message: T): void {
    this.mailbox.push(message);
    if (this.status === ActorRefStatus.Idle) {
      this.flush();
    }
  }
  public receiveSignal(signal: ActorSignal): void {
    if (signal.type === ActorSignalType.Watch) {
      this.topics.watchers.add(signal.ref);
      return;
    }

    this.behavior = this.resolveBehavior(
      this.behavior.receiveSignal?.(this.actorContext, signal) || this.behavior
    );
  }
  private process(message: T): void {
    this.status = ActorRefStatus.Processing;

    const nextBehavior = this.behavior.receive(this.actorContext, message);

    this.behavior = this.resolveBehavior(nextBehavior);

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
