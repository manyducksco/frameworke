import { $Node } from "./$Node";
import { createRouter } from "../routing/utils";
import { makeDolla } from "./Dolla";
import { isFunction } from "../_helpers/typeChecking";

/**
 * Creates a router outlet for a nested route. Multiple routes
 * are attached and the best match is displayed at this element's position.
 */
export class $Route extends $Node {
  static get isComponent() {
    return true;
  }

  #outlet;
  #mounted;
  #cancellers = [];
  #path;
  #getInjectables;
  #router = createRouter();

  mounted;
  index = -1;

  get isConnected() {
    return this.#outlet && this.#outlet.isConnected;
  }

  constructor(element, path, getInjectables) {
    super();

    this.#path = path;
    this.#getInjectables = getInjectables;
    this.createElement = () => {
      return element();
    };
  }

  when(route, component) {
    this.#router.on(route, { component });

    return this;
  }

  connect(parent, after = null) {
    const wasConnected = this.isConnected;

    // Run lifecycle callback only if connecting.
    // Connecting a node that is already connected moves it without unmounting.
    if (!wasConnected) {
      this.#outlet = this.createElement();
    }

    const matched = this.#router.match(this.#path);

    if (matched) {
      if (this.mounted == null || matched.path !== this.mounted.path) {
        this.mounted = matched;

        const { component } = matched.attributes;
        const { app, http } = this.#getInjectables();
        const $ = makeDolla({ app, http, route: matched });

        if (this.#mounted) {
          this.#mounted.disconnect();
        }
        this.#mounted = $(component)();
        this.#mounted.connect(this.#outlet);
      }
    } else {
      console.warn(
        `No route was matched. Consider adding a wildcard ("*") route to catch this.`
      );
    }

    this.#outlet.connect(parent, after);

    if (!wasConnected) {
      this.connected();
    }
  }

  disconnect() {
    if (this.isConnected) {
      this.#outlet.disconnect();

      for (const cancel of this.#cancellers) {
        cancel();
      }
    }
  }
}
