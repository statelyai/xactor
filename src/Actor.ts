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
  EventObject,
} from './types';
import { XActorRef } from './ActorRef';
import { ActorSystem } from './ActorSystem';
import { fromEntity } from './Behavior';

enum ActorRefStatus {
  Deferred = -1,
  Idle = 0,
  Processing = 1,
}

export type Listener<T> = (emitted: T) => void;

export class Actor<TEvent extends EventObject, TEmitted = any>
  implements SubscribableByObserver<TEmitted> {
  private actorContext: ActorContext<TEvent>;
  private children = new Set<XActorRef<any>>();
  private mailbox: TEvent[] = [];
  private status: ActorRefStatus = ActorRefStatus.Deferred;
  private reducer: Behavior<TEvent>[0];
  private taggedState: TaggedState<any>;

  // same as `watching` in Scala ActorRef
  private topics = {
    watchers: new Set<XActorRef<any>>(),
    listeners: new Set<Listener<any>>(),
    errorListeners: new Set<Listener<any>>(),
  };

  constructor(
    behavior: Behavior<TEvent, TEmitted>,
    public name: string,
    ref: XActorRef<TEvent>,
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
      spawnFrom: <U extends TEvent>(
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
      stop: (child: XActorRef<any>): void => {
        child.signal({ type: ActorSignalType.PostStop });
        this.children.delete(child);
      },
      subscribeTo: (topic: 'watchers', subscriberRef: XActorRef<any>) => {
        this.topics[topic].add(subscriberRef);
      },
      watch: actorRef => {
        actorRef.signal({
          type: ActorSignalType.Watch,
          ref,
        });
      },
    };

    // Don't start immediately
    // TODO: add as config option to start immediately?
    // this.start();
  }

  public start(): void {
    this.status = ActorRefStatus.Idle;
    const initialTaggedState = this.reducer(
      this.taggedState,
      { type: ActorSignalType.Start },
      this.actorContext
    );
    this.update(initialTaggedState);
    this.flush();
  }

  public receive(message: TEvent): void {
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
  private process(message: TEvent): void {
    if (this.taggedState.$$tag === BehaviorTag.Stopped) {
      console.warn(
        `Attempting to send message to stopped actor ${this.name}`,
        message
      );
      return;
    }

    this.status = ActorRefStatus.Processing;

    const nextTaggedState = this.reducer(
      this.taggedState,
      message,
      this.actorContext
    );

    this.update(nextTaggedState);

    this.status = ActorRefStatus.Idle;
  }

  private update(taggedState: TaggedState<any>) {
    this.taggedState = taggedState;

    const { effects } = taggedState;
    effects.forEach(effect => {
      if ('actor' in effect) {
        (effect.actor as any).start();
      }
    });

    this.topics.listeners.forEach(listener => {
      listener(taggedState.state);
    });

    if (taggedState.$$tag === BehaviorTag.Stopped) {
      this.stop();
    }
  }
  private stop() {
    this.actorContext.children.forEach(child => {
      this.actorContext.stop(child);
    });
    this.receiveSignal({ type: ActorSignalType.PostStop });
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

  private spawn<UEvent extends EventObject>(
    behavior: Behavior<UEvent>,
    name: string
  ): XActorRef<UEvent> {
    const child = new XActorRef<UEvent>(behavior, name, this.system);
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
