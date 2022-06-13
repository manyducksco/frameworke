import { isComponent, isFunction, isView } from "../helpers/typeChecking.js";

/**
 * Recreates its contents each time its value changes.
 */
export function Watch($attrs, self) {
  self.debug.name = "woof:v:watch";

  const node = document.createTextNode("");

  const $value = $attrs.map("value");
  const render = $attrs.get("render");

  let current;

  function update(value) {
    let newItem = render(value);

    // Allow functions that return an element
    if (newItem && isFunction(newItem) && !isComponent(newItem)) {
      newItem = newItem();
    }

    if (newItem != null && !isView(newItem)) {
      throw new TypeError(`Watch: render function should return a view or null. Got: ${newItem}`);
    }

    if (current) {
      current.disconnect();
      current = null;
    }

    if (newItem) {
      current = newItem;
      current.init({ getService: self.getService });
      current.connect(node.parentNode, node);
    }
  }

  self.watchState($value, update, { immediate: true });

  self.afterDisconnect(() => {
    if (current) {
      current.disconnect();
      current = null;
    }
  });

  return node;
}
