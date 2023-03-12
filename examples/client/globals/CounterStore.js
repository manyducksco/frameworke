import { Store, State } from "@frameworke/fronte";

export const CounterStore = Store.define({
  about: "Keeps a counter that increments by one each second.",
  setup: (ctx) => {
    const $$current = new State(0);

    ctx.onConnect(() => {
      setInterval(() => {
        $$current.update((x) => x + 1);
      }, 1000);
    });

    return {
      $current: $$current.readable(),
      reset() {
        $$current.set(0);
      },
    };
  },
});
