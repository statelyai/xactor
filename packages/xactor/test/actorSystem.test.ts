import { ActorSystem, Behavior } from '../src';
import * as behaviors from '../src/BehaviorImpl';
import { ActorRef } from '../src/ActorRef';
import { Behaviors } from '../src/Behavior';

describe('ActorSystem', () => {
  it('simple test', (done) => {
    const rootBehavior: Behavior<any> = {
      receive(_, event: any) {
        expect(event).toEqual({ type: 'hey' });
        done();
        return rootBehavior;
      },
    };

    const system = new ActorSystem(rootBehavior, 'hello');

    system.send({ type: 'hey' });
  });

  it('First example', (done) => {
    interface Greet {
      whom: string;
      replyTo: ActorRef<Greeted>;
    }
    interface Greeted {
      whom: string;
      from: ActorRef<Greet>;
    }

    interface SayHello {
      name: string;
    }

    const HelloWorld = behaviors.receive<Greet>((ctx, message) => {
      ctx.log(`Hello ${message.whom}!`);

      message.replyTo.send({
        whom: message.whom,
        from: ctx.self,
      });
      return Behaviors.Same;
    });

    const HelloWorldBot = (max: number) => {
      const bot = (greetingCounter: number, max: number): Behavior<Greeted> => {
        return behaviors.receive((ctx, message) => {
          const n = greetingCounter + 1;
          ctx.log(`Greeting ${n} for ${message.whom}`);
          if (n === max) {
            return {
              receive: () => {
                /* do nothing */
              },
            } as any;
          } else {
            message.from.send({
              whom: message.whom,
              replyTo: ctx.self,
            });
            return bot(n, max);
          }
        });
      };

      return bot(0, max);
    };

    const HelloWorldMain = behaviors.setup<SayHello>((ctx) => {
      const greeter = ctx.spawn(HelloWorld, 'greeter');

      return behaviors.receive((_, message) => {
        const replyTo = ctx.spawn(HelloWorldBot(3), message.name);
        greeter.send({
          whom: message.name,
          replyTo,
        });

        return Behaviors.Same;
      });
    });

    const system = new ActorSystem(HelloWorldMain, 'hello');

    system.send({ name: 'World' });
    system.send({ name: 'Akka' });

    setTimeout(() => {
      done();
    }, 1000);
  });
});
