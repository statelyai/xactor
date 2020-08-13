import {
  ActorContext,
  ActorSignal,
  ActorSignalType,
  Misbehavior,
  MisbehaviorTag,
} from './Behavior';
import { ActorRef } from './ActorRef';
import { ActorSystem } from '.';

enum ActorRefStatus {
  Idle = 0,
  Processing = 1,
}

export class Actor<T> {
  private actorContext: ActorContext<T>;
  private children = new Set<ActorRef<any>>();
  private mailbox: T[] = [];
  private status: ActorRefStatus = ActorRefStatus.Idle;
  private reducer: Misbehavior<T>[0];
  private state: any;

  // same as `watching` in Scala ActorRef
  private topics = {
    watchers: new Set<ActorRef<any>>(),
  };

  constructor(
    behavior: Misbehavior<T>,
    public name: string,
    ref: ActorRef<T>,
    private system: ActorSystem<any>
  ) {
    [this.reducer, this.state] = behavior;
    const logger = this.system.logger(ref);

    this.actorContext = {
      self: ref,
      system: this.system,
      log: (logMessage: string) => {
        this.system.logs.push({
          ref,
          log: logMessage,
        });

        logger(logMessage);
      },
      children: this.children,
      spawn: this.spawn.bind(this),
      send: (actorRef, message) => {
        this.system.logs.push({
          from: ref,
          to: actorRef,
          message,
        });

        actorRef.send(message);
      },
      stop: (child: ActorRef<any>): void => {
        child.signal({ type: ActorSignalType.PostStop });
        this.children.delete(child);
      },
      subscribeTo: (topic: 'watchers', subscriberRef: ActorRef<any>) => {
        this.topics[topic].add(subscriberRef);
      },
      watch: actorRef => {
        actorRef.signal({
          type: ActorSignalType.Watch,
          ref,
        });
      },
    };

    // start immediately?
    [this.state] = this.reducer(
      this.state,
      { type: ActorSignalType.Start },
      this.actorContext
    );
    // this.behavior = this.resolveBehavior(
    //   this.behavior.receiveSignal?.(this.actorContext, {
    //     type: ActorSignalType.Start,
    //   }) || this.behavior
    // );
  }

  // private resolveBehavior(
  //   behaviorOrTag: Behavior<T> | BehaviorTag
  // ): Behavior<T> {
  //   const behaviorTag = isBehavior(behaviorOrTag)
  //     ? behaviorOrTag._tag
  //     : behaviorOrTag;

  //   switch (behaviorTag) {
  //     case BehaviorTag.Stopped:
  //       this.actorContext.children.forEach((child) => {
  //         this.actorContext.stop(child);
  //       });

  //       this.topics.watchers.forEach((watcher) => {
  //         watcher.signal({
  //           type: ActorSignalType.Terminated,
  //           ref: this.actorContext.self,
  //         });
  //       });

  //       const stoppedBehavior =
  //         (this.behavior.receiveSignal?.(this.actorContext, {
  //           type: ActorSignalType.PostStop,
  //         }) as Behavior<T>) || this.behavior;

  //       return stoppedBehavior;
  //     case BehaviorTag.Default:
  //       return behaviorOrTag as Behavior<T>;
  //     case BehaviorTag.Same:
  //     default:
  //       return this.behavior;
  //   }
  // }

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

    const [state] = this.reducer(this.state, signal, this.actorContext);

    this.state = state;
  }
  private process(message: T): void {
    console.log('processing message', message);
    this.status = ActorRefStatus.Processing;

    const [state, tag] = this.reducer(this.state, message, this.actorContext);

    this.state = state;

    if (tag === MisbehaviorTag.Stopped) {
      this.stop();
    }

    // const nextBehavior = this.behavior.receive(this.actorContext, message);

    // this.behavior = this.resolveBehavior(nextBehavior);

    this.status = ActorRefStatus.Idle;
  }

  private stop() {
    this.actorContext.children.forEach(child => {
      this.actorContext.stop(child);
    });
    this.receiveSignal({ type: ActorSignalType.PostStop });
  }

  private flush() {
    while (this.mailbox.length) {
      const message = this.mailbox.shift()!;
      this.process(message);
    }
  }

  private spawn<U>(behavior: Misbehavior<U>, name: string): ActorRef<U> {
    const child = new ActorRef<U>(behavior, name, this.system);
    this.children.add(child);
    return child;
  }
}
