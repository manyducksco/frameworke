import { makeState } from "../../core/makeState.js";
import { Store } from "../../core/classes/Store.js";

export class MockRouterStore extends Store {
  static label = "mock:router";

  setup(ctx) {
    const $$path = makeState("/test");
    const $$route = makeState("/test");
    const $$params = makeState({});
    const $$query = makeState({});

    return {
      $path: $$path.readable(),
      $route: $$route.readable(),
      $params: $$params.readable(),
      $$query: $$query,

      back() {},
      forward() {},
      navigate() {},
    };
  }
}
