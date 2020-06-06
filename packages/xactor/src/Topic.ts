import { ActorContext, Behavior, BehaviorTag } from './Behavior';
import { ActorRef } from './ActorRef';

type TopicCommand<T> =
  | {
      type: 'publish';
      message: T;
    }
  | {
      type: 'messagePublished';
      message: T;
    }
  | {
      type: 'subscribe';
      subscriber: ActorRef<T>;
    };

export class Topic<T> implements Behavior<TopicCommand<T>> {
  public _tag = BehaviorTag.Topic;
  private subscribers = new Set<ActorRef<T>>();

  constructor(public topicName: string) {}

  public receive(ctx: ActorContext<TopicCommand<T>>, msg: TopicCommand<T>) {
    switch (msg.type) {
      case 'publish':
        ctx.log(`Publishing message of type [${msg.type}]`);
        this.subscribers.forEach((subscriber) => {
          subscriber.send(msg.message);
        });
        return this;
      case 'subscribe':
        ctx.log(`Local subscriber [${msg.subscriber.name}] added`);
        this.subscribers.add(msg.subscriber);
        return this;
      default:
        return this;
    }
  }
}
