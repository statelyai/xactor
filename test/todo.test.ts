import { ActorRef, behaviors } from '../src';
import { createSystem } from '../src/ActorSystem';

describe('todo example', () => {
  it('works', done => {
    const Todos = () =>
      behaviors.createBehavior<
        | {
            type: 'add';
            message: string;
          }
        | { type: 'update'; index: number; message: string }
        | { type: 'toggle'; index: number },
        {
          todos: ActorRef<any>[];
        }
      >(
        (state, msg, ctx) => {
          console.log(state, msg);
          switch (msg.type) {
            case 'add':
              return {
                ...state,
                todos: state.todos.concat(
                  ctx.spawn(Todo(msg.message), `todo-${state.todos.length}`)
                ),
              };
            case 'update': {
              const todo = state.todos[msg.index];

              if (todo) {
                todo.send(msg);
              }
              return state;
            }
            case 'toggle': {
              const todo = state.todos[msg.index];

              if (todo) {
                todo.send(msg);
              }
              return state;
            }
            default:
              return state;
          }
        },
        {
          todos: [],
        }
      );

    const Todo = (message: string) =>
      behaviors.createBehavior<
        { type: 'update'; message: string } | { type: 'toggle' },
        {
          message: string;
          status: 'pending' | 'complete';
        }
      >(
        (state, msg) => {
          switch (msg.type) {
            case 'update':
              if (state.status === 'complete') {
                return state;
              }
              return { ...state, message: msg.message };
            case 'toggle':
              if (state.message === 'mission accomplished') {
                done();
              }
              return {
                ...state,
                status: state.status === 'pending' ? 'complete' : 'pending',
              };
            default:
              return state;
          }
        },
        {
          message,
          status: 'pending',
        }
      );

    const todoSystem = createSystem(Todos(), 'todos');

    todoSystem.subscribe(state => {
      console.log(state);
    });

    todoSystem.send({ type: 'add', message: 'hello' });

    setTimeout(() => {
      todoSystem.send({
        type: 'update',
        index: 0,
        message: 'mission accomplished',
      });

      todoSystem.send({
        type: 'toggle',
        index: 0,
      });
    }, 10);
  });
});
