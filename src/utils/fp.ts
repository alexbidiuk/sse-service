const curry = (fn: Function) => {
  const arity = fn.length;
  return function $curry(...args: any[]) {
    if (args.length < arity) {
      return $curry.bind(null, ...args);
    }
    // eslint-disable-next-line no-restricted-syntax
    for (const arg of args) {
      if (arg instanceof Promise) {
        // eslint-disable-next-line no-shadow
        return Promise.all(args).then((args) => fn.call(null, ...args));
      }
    }
    return fn.call(null, ...args);
  };
};

const compose = (...fns: Function[]) => (...args: any[]) =>
  fns.reduceRight((res, fn) => [fn.call(null, ...res)], args)[0];


export { curry, compose };
