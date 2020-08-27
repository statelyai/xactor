<p align="center">
  <br />
  <img src="https://s3.amazonaws.com/media-p.slid.es/uploads/174419/images/7647776/xactor-logo.svg" alt="XState" width="100"/>
  <br />
    <sub><strong>The Actor Model for JavaScript</strong></sub>
  <br />
  <br />
</p>

**🚧 Work in progress! 🚧**

XActor is an [actor model](https://en.wikipedia.org/wiki/Actor_model) implementation for JavaScript and TypeScript, heavily inspired by [Akka](https://akka.io/). It represents the "actor model" parts of [XState](https://github.com/davidkpiano/xstate) and can be used with or without XState.

## Resources

Learn more about the Actor Model:

- [The Actor Model in 10 Minutes](https://www.brianstorti.com/the-actor-model/)
- [🎥 The Actor Model Explained](https://www.youtube.com/watch?v=ELwEdb_pD0k)
- [What is the Actor Model and When Should You Use It?](https://mattferderer.com/what-is-the-actor-model-and-when-should-you-use-it)
- [📄 ACTORS: A Model of Concurrent Computation in Distributed Systems (Gul Agha)](https://dspace.mit.edu/handle/1721.1/6952)
- [📄 A Universal Modular ACTOR Formalism for Artificial Intelligence (Carl Hewitt et. al.](https://www.semanticscholar.org/paper/A-Universal-Modular-ACTOR-Formalism-for-Artificial-Hewitt-Bishop/acb2f7040e21cbe456030c8535bc3f2aafe83b02)


## Installation

- With [npm](https://www.npmjs.com/package/xactor): `npm install xactor --save`
- With Yarn: `yarn add xactor`

## Quick Start

[Simple Example](https://codesandbox.io/s/simple-xactor-example-7iyck?file=/src/index.js):
```js
import { createSystem, createBehavior } from 'xactor';

// Yes, I know, another trivial counter example
const counter = createBehavior(
  (state, message, context) => {
    if (message.type === 'add') {
      context.log(`adding ${message.value}`);

      return {
        ...state,
        count: state.count + message.value,
      };
    }

    return state;
  },
  { count: 0 }
);

const counterSystem = createSystem(counter, 'counter');

counterSystem.subscribe(state => {
  console.log(state);
});

counterSystem.send({ type: 'add', value: 3 });
// => [counter] adding 3
// => { count: 3 }
counterSystem.send({ type: 'add', value: 1 });
// => [counter] adding 1
// => { count: 4 }
```

## API

### `createBehavior(reducer, initialState)`

Creates a **behavior** that is represented by the `reducer` and starts at the `initialState`.

**Arguments**

- `reducer` - a reducer that takes 3 arguments (`state`, `message`, `actorContext`) and should return the next state (tagged or not).
- `initialState` - the initial state of the behavior.

**Reducer Arguments**

- `state` - the current _untagged_ state.
- `message` - the current message to be processed by the reducer.
- `actorContext` - the [actor context](#actor-context) of the actor instance using this behavior.

## Actor Context

The actor context is an object that includes contextual information about the current actor instance:

- `self` - the `ActorRef` reference to the own actor
- `system` - the reference to the actor system that owns this actor
- `log` - function for logging messages that reference the actor
- `spawn` - function to [spawn an actor](#spawning-actors)
- `stop` - function to stop a spawned actor
- `watch` - function to watch an actor

## Spawning Actors

Actors can be spawned via `actorContext.spawn(behavior, name)` within a behavior reducer:

```js
const createTodo = (content = "") => createBehavior((state, msg, ctx) => {
  // ...
  
  return state;
}, { content });

const todos = createBehavior((state, msg, ctx) => {
  if (msg.type === 'todo.create') {
    return {
      ...state,
      todos: [
        ...state.todos,
        ctx.spawn(createTodo(), 'some-unique-todo-id')
      ]
    }
  }
  
  // ...
  
  return state;
}, { todos: [] });

const todoSystem = createSystem(todos, 'todos');

todoSystem.send({ type: 'todo.create' });
```

_Documentation still a work-in-progress!_
