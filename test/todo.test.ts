import { ActorRef, behaviors } from '../src';
import { createSystem } from '../src/ActorSystem';

describe('todo example', () => {
  it('works', done => {
    interface TodoState {
      message: string;
      status: 'pending' | 'complete';
    }

    type TodoEvent = { type: 'update'; message: string } | { type: 'toggle' };

    const Todos = () =>
      behaviors.createBehavior<
        | {
            type: 'add';
            message: string;
          }
        | { type: 'update'; index: number; message: string }
        | { type: 'toggle'; index: number },
        {
          todos: ActorRef<TodoEvent, TodoState>[];
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
      behaviors.createBehavior<TodoEvent, TodoState>(
        (state, msg) => {
          switch (msg.type) {
            case 'update':
              if (state.status === 'complete') {
                return state;
              }
              return { ...state, message: msg.message };
            case 'toggle':
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

    let todo: ActorRef<TodoEvent, TodoState>;

    todoSystem.subscribe(state => {
      if (state.todos.length && !todo) {
        todo = state.todos[0];
        todo.subscribe(state => {
          if (
            state.message === 'mission accomplished' &&
            state.status === 'complete'
          ) {
            done();
          }
        });
        todo.send({
          type: 'update',
          message: 'mission accomplished',
        });

        todo.send({
          type: 'toggle',
        });
      }
    });

    todoSystem.send({ type: 'add', message: 'hello' });
  });
});
