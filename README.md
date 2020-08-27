# XActor

**🚧 Work in progress! 🚧**

XActor is an [actor model](https://en.wikipedia.org/wiki/Actor_model) implementation for JavaScript and TypeScript, heavily inspired by Akka. It represents the "actor model" parts of [XState](https://github.com/davidkpiano/xstate) and can be used with or without XState.

## Installation

- With [npm](https://www.npmjs.com/package/xactor): `npm install xactor --save`
- With Yarn: `yarn add xactor`

## Quick Start

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
