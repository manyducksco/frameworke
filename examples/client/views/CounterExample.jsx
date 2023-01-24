import { View } from "woofe";
import logLifecycle from "../utils/logLifecycle.js";

/**
 * Component with controls and a mapped label based on the state inside the service.
 */
export class CounterExample extends View {
  setup(ctx) {
    logLifecycle(ctx);

    const counter = ctx.global("counter");
    const $label = counter.$current.as((n) => `the number is: ${n}`);

    return (
      <div class="example">
        <h3>Shared state with services</h3>
        <div>
          <p>{$label}</p>
          <button onclick={counter.reset}>Reset</button>
          <CounterViewLabel />
        </div>
      </div>
    );
  }
}

/**
 * Second component with a view only. Displays the same information from the same service.
 */
class CounterViewLabel extends View {
  setup(ctx) {
    const { $current } = ctx.global("counter");

    return <h1>{$current}</h1>;
  }
}
