import queryString from "query-string";
import { createHashHistory, createBrowserHistory, type History, type Listener } from "history";
import { Router } from "@borf/bedrock";
import { View } from "../classes/View.js";
import { Store } from "../classes/Store.js";
import { Markup } from "../classes/Markup.js";
import { Writable } from "../classes/Writable.js";
import { catchLinks } from "../helpers/catchLinks.js";
import { APP_CONTEXT, ELEMENT_CONTEXT } from "../keys.js";

// ----- Types ----- //

export interface RouterOptions {
  /**
   * Use hash-based routing if true.
   */
  hash?: boolean;

  /**
   * A history object from the `history` package.
   *
   * @see https://www.npmjs.com/package/history
   */
  history?: History;
}

interface RouterInputs {
  options: RouterOptions;
  router: Router;
}

interface RouterLayer<I = any> {
  id: number;
  view: View<I>;
}

interface ParsedParams {
  [key: string]: string | number | boolean | (string | number | boolean | null)[] | null;
}

interface ParsedQuery extends ParsedParams {}

// ----- Code ----- //

export const RouterStore = Store.define<RouterInputs>({
  label: "router",
  inputs: {
    options: {
      about: "Router options passed through the 'router' field in the app config.",
    },
    router: {
      about: "An instance of Router with the app's routes preloaded.",
    },
  },

  setup(ctx) {
    const appContext = ctx[APP_CONTEXT];
    const elementContext = ctx[ELEMENT_CONTEXT];

    const { options, router } = ctx.inputs.get();

    let history: History;

    if (options.history) {
      history = options.history;
    } else if (options.hash) {
      history = createHashHistory();
    } else {
      history = createBrowserHistory();
    }

    // Test redirects to make sure all possible redirect targets actually exist.
    // for (const route of routes) {
    //   if (route.meta.redirect) {
    //     const match = appContext.router.match(route.meta.redirect, {
    //       willMatch(r) {
    //         return r !== route;
    //       },
    //     });

    //     if (!match) {
    //       throw new Error(`Found a redirect to an undefined URL. From '${route.pattern}' to '${route.meta.redirect}'`);
    //     }
    //   }
    // }

    const $$pattern = new Writable<string | null>(null);
    const $$path = new Writable("");
    const $$params = new Writable<ParsedParams>({});
    const $$query = new Writable<ParsedQuery>({});

    // Track and skip updating the URL when the change came from URL navigation
    let isRouteChange = false;

    // Update URL when query changes
    ctx.observe($$query, (current) => {
      // No-op if this is triggered by a route change.
      if (isRouteChange) {
        isRouteChange = false;
        return;
      }

      const params = new URLSearchParams();

      for (const key in current) {
        params.set(key, String(current[key]));
      }

      history.replace({
        pathname: history.location.pathname,
        search: "?" + params.toString(),
      });
    });

    ctx.onConnect(() => {
      history.listen(onRouteChange);
      onRouteChange(history);

      catchLinks(appContext.rootElement!, (anchor) => {
        let href = anchor.getAttribute("href")!;

        ctx.log("caught link click to:", href);

        if (!/^https?:\/\/|^\//.test(href)) {
          href = Router.joinPath([history.location.pathname, href]);
        }

        history.push(href);
      });
    });

    let activeLayers: RouterLayer[] = [];
    let lastQuery: string;

    /**
     * Run when the location changes. Diffs and mounts new routes and updates
     * the $path, $route, $params and $query states accordingly.
     */
    const onRouteChange: Listener = async ({ location }) => {
      // Update query params if they've changed.
      if (location.search !== lastQuery) {
        lastQuery = location.search;

        isRouteChange = true;
        $$query.value = queryString.parse(location.search, {
          parseBooleans: true,
          parseNumbers: true,
        });
      }

      const matched = router.match(location.pathname);

      ctx.log({ location, matched });

      if (!matched) {
        $$pattern.value = null;
        $$path.value = location.pathname;
        $$params.value = {
          wildcard: location.pathname,
        };
        return;
      }

      if (matched.meta.redirect != null) {
        let path = matched.meta.redirect;

        for (const key in matched.params) {
          path = path.replace(":" + key, matched.params[key]);
        }

        history.replace(path);
      } else {
        $$path.value = matched.path;
        $$params.value = matched.params;

        if (matched.pattern !== $$pattern.value) {
          $$pattern.value = matched.pattern;

          const { layers } = matched.meta;

          // Diff and update route layers.
          for (let i = 0; i < layers.length; i++) {
            const matchedLayer = layers[i];
            const activeLayer = activeLayers[i];

            if (activeLayer?.id !== matchedLayer.id) {
              activeLayers = activeLayers.slice(0, i);

              const parentLayer = activeLayers[activeLayers.length - 1];

              const view = matchedLayer.view.init({
                appContext,
                elementContext,
                // inputs: preloadResult.inputs || {},
              });

              requestAnimationFrame(() => {
                if (activeLayer && activeLayer.view.isConnected) {
                  // Disconnect first mismatched active and remove remaining layers.
                  activeLayer.view.disconnect();
                }

                const markup = new Markup(() => view);

                if (parentLayer) {
                  parentLayer.view.setChildren([markup]);
                } else {
                  appContext.rootView!.setChildren([markup]);
                }
              });

              // Push and connect new active layer.
              activeLayers.push({ id: matchedLayer.id, view });
            }
          }
        }
      }
    };

    interface NavigateOptions {
      /**
       * Replace the current item in the history stack instead of adding a new one.
       * The back button will send the user to the page they visited before this.
       */
      replace?: boolean;
    }

    function navigate(path: Stringable, options?: NavigateOptions): void;
    function navigate(fragments: Stringable[], options?: NavigateOptions): void;

    function navigate(path: Stringable | Stringable[], options: NavigateOptions = {}) {
      let joined: string;

      if (Array.isArray(path)) {
        joined = Router.joinPath(path);
      } else {
        joined = path.toString();
      }

      joined = Router.resolvePath(history.location.pathname, joined);

      if (options.replace) {
        history.replace(joined);
      } else {
        history.push(joined);
      }
    }

    return {
      $pattern: $$pattern.toReadable(),
      $path: $$path.toReadable(),
      $params: $$params.toReadable(),
      $$query,

      back(steps = 1) {
        history.go(-steps);
      },

      forward(steps = 1) {
        history.go(steps);
      },

      /**
       * Navigates to another route.
       *
       * @example
       * navigate(["/users", 215], { replace: true }); // replace current history entry with `/users/215`
       *
       * @param args - One or more path segments optionally followed by an options object.
       */
      navigate,
    };
  },
});
