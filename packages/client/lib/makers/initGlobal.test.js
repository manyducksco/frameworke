import { initGlobal } from "./initGlobal.js";

/*========================*\
||         Utils          ||
\*======================== */

const appContext = {
  globals: {
    debug: {
      exports: {
        channel() {
          return {
            log: () => {},
            warn: () => {},
            error: () => {}
          }
        }
      }
    },
  },
  debug: {
    makeChannel() {
      return {
        log: console.log.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console),
      };
    },
  },
};

/*========================*\
||         Tests          ||
\*========================*/

test("lifecycle hooks", () => {
  const beforeConnect = jest.fn();
  const afterConnect = jest.fn();

  const fn = function (ctx) {
    ctx.beforeConnect(beforeConnect);
    ctx.afterConnect(afterConnect);

    return { works: true };
  };

  const instance = initGlobal(fn, { appContext, name: "test" });

  expect(instance.exports).toStrictEqual({ works: true });
  expect(typeof instance.beforeConnect).toBe("function");
  expect(typeof instance.afterConnect).toBe("function");

  expect(beforeConnect).toHaveBeenCalledTimes(0);
  expect(afterConnect).toHaveBeenCalledTimes(0);

  instance.beforeConnect();

  expect(beforeConnect).toHaveBeenCalledTimes(1);
  expect(afterConnect).toHaveBeenCalledTimes(0);

  instance.afterConnect();

  expect(beforeConnect).toHaveBeenCalledTimes(1);
  expect(afterConnect).toHaveBeenCalledTimes(1);
});

test("throws if bootstrap doesn't return an object", () => {
  const nullFn = function () {
    return null;
  };

  const stringFn = function () {
    return "nope";
  };

  const fnFn = function () {
    return function () {
      return {};
    };
  };

  const regularFn = function () {
    return { thisIsNormal: true };
  };

  expect(() => initGlobal(nullFn, { appContext, name: "test" })).toThrow();
  expect(() => initGlobal(stringFn, { appContext, name: "test" })).toThrow();
  expect(() => initGlobal(fnFn, { appContext, name: "test" })).toThrow();

  expect(() => initGlobal(regularFn, { appContext, name: "test" })).not.toThrow();
});
