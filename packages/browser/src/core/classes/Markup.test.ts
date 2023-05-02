import test from "ava";
import { m, Markup } from "./Markup.js";

test("a", (t) => {
  function SomeView(attrs: { value: string }) {
    return m("span", null, attrs.value);
  }

  const stringMarkup = m("div", { class: "test" }, "Hello");
  const viewMarkup = m(SomeView, { value: "Hello" });
  const fnMarkup = m(() => {
    return m("div");
  }, {});

  t.assert(stringMarkup instanceof Markup);
  t.assert(viewMarkup instanceof Markup);
  t.assert(fnMarkup instanceof Markup);
});
