import { makeState, makeView } from "woofe";
import logLifecycle from "../utils/logLifecycle.js";

export const TwoWayBindExample = makeView({
  name: "TwoWayBindExample",
  setup: (ctx) => {
    const $$text = makeState("edit me");
    const $$size = makeState(18);

    logLifecycle(ctx);

    return (
      <div class="example">
        <h3>
          Two way data binding with <code>.writable()</code>
        </h3>
        <div>
          <input value={$$text} />
          <input value={$$size} type="number" />{" "}
          {/* number value gets converted back to number */}
          <p
            style={{
              fontSize: $$size.as((s) => s + "px"),
            }}
          >
            {$$text}
          </p>
        </div>
      </div>
    );
  },
});
