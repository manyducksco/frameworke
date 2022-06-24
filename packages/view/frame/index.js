/**
 * This file runs inside the view iframe. It exposes methods on the window so the main runner app can control it.
 */
// views-index.js is generated from the views in the project
import views from "./views-index.js";
import { h, makeState, mergeStates } from "@woofjs/client";
import { makeDebug, initService } from "@woofjs/client/helpers";

const root = document.querySelector("#app");

function makeMockRouter() {
  return {
    $path: makeState("/test").map(),
    $route: makeState("/test").map(),
    $params: makeState({}).map(),
    $query: makeState({}),

    back() {},
    forward() {},
    navigate() {},
  };
}

function makeMockPage() {
  return {
    $title: makeState("Page Title"),
  };
}

const collections = [];

let nextId = 0;

function formatCollection(data) {
  const collection = {
    path: "/" + data.relativePath.replace(/\.view\.[jt]sx?$/, ""),
    views: [],
  };

  const fns = [];

  if (typeof data.exports === "object" && !Array.isArray(data.exports)) {
    for (const key in data.exports) {
      fns.push({ fn: data.exports[key], name: sentenceCase(key) });
    }
  } else if (typeof data.exports === "function") {
    fns.push({ fn: data.exports, name: "@default" });
  } else {
    throw new Error(
      `View files must export a function or object. Got: ${typeof data.exports}`
    );
  }

  for (const { fn, name } of fns) {
    const attributes = [];
    const services = {};
    const actions = [];
    let template;

    const helpers = {
      name: sentenceCase(name),
      description: null,
      service(name, service, config = {}) {
        if (typeof service === "function") {
          services[name] = {
            fn: service,
            options: config.options || {},
          };
        } else if (typeof service === "object" && !Array.isArray(service)) {
          services[name] = {
            fn: () => service,
            options: {},
          };
        } else {
          throw new TypeError(
            `Expected service '${name}' to be a function or object. Got: ${typeof service}`
          );
        }
      },
      attribute(name, options) {
        // attributes.push([{
        //   name,
        //   options
        // }])
      },
      action(name) {},
      render(component, attrs, children) {
        template = h(component, attrs, children);
      },
    };

    const result = fn.call(helpers, helpers);

    if (result && result.isTemplate) {
      template = result;
    }

    if (!template) {
      throw new Error(`View must return a template.`);
    }

    collection.views.push({
      id: nextId++,
      path:
        helpers.name === "@default"
          ? collection.path
          : joinPath(collection.path, slugCase(helpers.name)),
      name: helpers.name,
      description: helpers.description,
      attributes,
      services,
      actions,
      template,
    });
  }

  return collection;
}

for (const view of views) {
  collections.push(formatCollection(view));
}

let mounted;

const api = {
  getCollections() {
    return collections;
  },
  setActiveView(id) {
    if (mounted) {
      mounted.disconnect();
      mounted = null;
    }

    if (id != null) {
      let found;

      outer: for (const collection of collections) {
        for (const view of collection.views) {
          if (view.id === id) {
            found = view;
            break outer;
          }
        }
      }

      if (!found) {
        throw new Error(`View not found.`);
      }

      const debug = makeDebug();
      const appContext = { makeGetService };

      const services = {
        "@app": { exports: appContext },
        "@debug": { exports: debug },
        "@router": { exports: makeMockRouter() },
        "@page": { exports: makeMockPage() },
      };

      for (const name in found.services) {
        const service = found.services[name];

        services[name] = initService(
          { makeGetService },
          service.fn,
          debug.makeChannel(`service:${name}`),
          { options: service.options }
        );
      }

      function makeGetService() {
        return (name) => {
          console.log("requesting service", name);

          if (services[name]) {
            return services[name].exports;
          }

          throw new Error(
            `Service '${name}' was requested but hasn't been defined in this view.`
          );
        };
      }

      mounted = found.template.init({ makeGetService });

      for (const name in services) {
        if (services[name].beforeConnect) {
          services[name].beforeConnect();
        }
      }

      mounted.connect(root);

      for (const name in services) {
        if (services[name].afterConnect) {
          services[name].afterConnect();
        }
      }
    }
  },
};

console.log(collections);

window.WOOF_VIEW = api;

// Support camel case ("camelCase" -> "camel Case" and "CAMELCase" -> "CAMEL Case").
const SPLIT_REGEXP = [/([a-z0-9])([A-Z])/g, /([A-Z])([A-Z][a-z])/g];

// Remove all non-word characters.
const STRIP_REGEXP = /[^A-Z0-9]+/gi;

function sentenceCase(input) {
  let result = input
    .replace(SPLIT_REGEXP, "$1\0$2")
    .replace(STRIP_REGEXP, "\0");

  let start = 0;
  let end = result.length;

  // Trim the delimiter from around the output string.
  while (result.charAt(start) === "\0") {
    start++;
  }
  while (result.charAt(end - 1) === "\0") {
    end--;
  }

  // Transform each token independently.
  result = result
    .slice(start, end)
    .split("\0")
    .map((word) => word.toLowerCase())
    .join(" ");

  result = result[0].toUpperCase() + result.slice(1);

  return result;
}

function slugCase(input) {
  let result = input
    .replace(SPLIT_REGEXP, "$1\0$2")
    .replace(STRIP_REGEXP, "\0");

  let start = 0;
  let end = result.length;

  // Trim the delimiter from around the output string.
  while (result.charAt(start) === "\0") {
    start++;
  }
  while (result.charAt(end - 1) === "\0") {
    end--;
  }

  // Transform each token independently.
  result = result
    .slice(start, end)
    .split("\0")
    .map((word) => word.toLowerCase())
    .join("-");

  return result;
}

function joinPath(...parts) {
  let url = "";

  for (let part of parts) {
    if (!part.startsWith("/")) {
      part = "/" + part;
    }

    if (part.endsWith("/")) {
      part = part.slice(0, part.length - 1);
    }

    url += part;
  }

  return url;
}
