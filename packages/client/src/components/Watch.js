import { isFunction, isTemplate } from "../helpers/typeChecking.js";

import { appContextKey } from "../helpers/initComponent.js";

/**
 * Recreates its contents each time its value changes.
 */
export function Watch(self) {
  const { $attrs, debug } = self;
  const appContext = self[appContextKey];

  debug.name = "woof:template:watch";

  const node = document.createTextNode("");

  const $value = $attrs.map("value");
  const render = $attrs.get("render");

  let current;

  function update(value) {
    let newItem = render(value);

    // Allow functions that return an element
    if (newItem && isFunction(newItem)) {
      newItem = newItem();
    }

    if (newItem != null && !isTemplate(newItem)) {
      throw new TypeError(`Watch: render function should return a view or null. Got: ${newItem}`);
    }

    if (current) {
      current.disconnect();
      current = null;
    }

    if (newItem) {
      current = newItem.init(appContext);
      current.connect(node.parentNode, node);
    }
  }

  self.watchState($value, update);

  self.afterDisconnect(() => {
    if (current) {
      current.disconnect();
      current = null;
    }
  });

  return node;
}
