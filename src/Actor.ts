import {
  ActorContext,
  ActorSignal,
  ActorSignalType,
  Behavior,
  BehaviorTag,
  TaggedState,
  Observer,
  SubscribableByObserver,
  Subscribable,
} from './types';
import { ActorRef } from './ActorRef';
import { ActorSystem } from './ActorSystem';
import { fromEntity } from './Behavior';

enum ActorRefStatus {
  Idle = 0,
  Processing = 1,
}

export type Listener<T> = (emitted: T) => void;

export class Actor<T, TEmitted = any>
  implements SubscribableByObserver<TEmitted> {
  private actorContext: ActorContext<T>;
  private children = new Set<ActorRef<any>>();
  private mailbox: T[] = [];
  private status: ActorRefStatus = ActorRefStatus.Idle;
  private reducer: Behavior<T>[0];
  private taggedState: TaggedState<any>;

  // same as `watching` in Scala ActorRef
  private topics = {
    watchers: new Set<ActorRef<any>>(),
    listeners: new Set<Listener<any>>(),
    errorListeners: new Set<Listener<any>>(),
  };

  constructor(
    behavior: Behavior<T, TEmitted>,
    public name: string,
    ref: ActorRef<T>,
    private system: ActorSystem<any>
  ) {
    [this.reducer, this.taggedState] = behavior;
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
      spawnFrom: <U extends T>(
        getPromise: () => Promise<U> | Subscribable<U>,
        name: string
      ) => {
        const sendToSelf = (value: U) => {
          ref.send(value);
        };

        return this.spawn(
          fromEntity(getPromise, {
            next: sendToSelf,
            error: sendToSelf,
            complete: undefined,
          }),
          name
        );
      },
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
    this.taggedState = this.reducer(
      this.taggedState,
      { type: ActorSignalType.Start },
      this.actorContext
    );
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

    const { state } = this.reducer(this.taggedState, signal, this.actorContext);

    this.taggedState = state;
  }
  private process(message: T): void {
    if (this.taggedState.$$tag === BehaviorTag.Stopped) {
      console.warn(
        `Attempting to send message to stopped actor ${this.name}`,
        message
      );
      return;
    }

    this.status = ActorRefStatus.Processing;

    const { state, $$tag: tag } = this.reducer(
      this.taggedState,
      message,
      this.actorContext
    );

    this.taggedState = { state, $$tag: tag, effects: [] };

    this.topics.listeners.forEach(listener => {
      listener(state);
    });

    if (tag === BehaviorTag.Stopped) {
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
    console.log('signaling stop to watchers', this.name);
    this.topics.watchers.forEach(watcher => {
      watcher.signal({
        type: ActorSignalType.Terminated,
        ref: this.actorContext.self,
      });
    });
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

  public subscribe(observer?: Observer<TEmitted> | null) {
    if (!observer) {
      return { unsubscribe: () => {} };
    }

    // TODO: file an RxJS issue (should not need to be bound)
    if (observer.next) this.topics.listeners.add(observer.next.bind(observer));
    if (observer.error)
      this.topics.errorListeners.add(observer.error.bind(observer));

    return {
      unsubscribe: () => {
        if (observer.next) this.topics.listeners.delete(observer.next);
        if (observer.error) this.topics.errorListeners.delete(observer.error);
      },
    };
  }

  public getSnapshot(): TEmitted {
    return this.taggedState.state;
  }
}
