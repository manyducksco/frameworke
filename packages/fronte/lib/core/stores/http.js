import { HTTPClient } from "@frameworke/bedrocke";
import { Store } from "../classes/Store.js";

export class HTTPStore extends Store {
  static about = "A nice HTTP client that auto-parses responses and supports middleware.";
  static inputs = {
    fetch: {
      about: "The fetch function to use for requests. Pass this to mock for testing.",
      type: "function",
      default: (window ?? global).fetch?.bind(window ?? global),
    },
  };

  setup(ctx) {
    const { fetch } = ctx.inputs.get();
    return new HTTPClient({ fetch });
  }
}
