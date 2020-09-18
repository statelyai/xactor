export const symbolObservable = (() =>
  (typeof Symbol === 'function' && (Symbol as any).observable) ||
  '@@observable')();
