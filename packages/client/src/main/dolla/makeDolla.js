import { isComponent, isFunction, isNode, isObject, isString } from "../../_helpers/typeChecking";
import { $Element } from "./$Element";
import { $Fragment } from "./$Fragment";
import { $If } from "./$If";
import { $Each } from "./$Each";
import { $Outlet } from "./$Outlet";
import { $Text } from "./$Text";
import { $Watch } from "./$Watch";
import { makeRender } from "./makeRender";
import htmlTags from "html-tags";
import htmlVoidTags from "html-tags/void";

/**
 * Creates a $ function with bound injectables.
 */
export function makeDolla({ getService, $route }) {
  function $(element, ...args) {
    let defaultAttrs = {};

    if (args[0] && !isNode(args[0]) && isObject(args[0])) {
      defaultAttrs = args.shift();
    }

    let defaultChildren = args;
    let elementType = null;

    console.log(element);

    if (isString(element)) {
      if (element === "" || element === ":fragment:") {
        elementType = "fragment";
      } else {
        elementType = "element";
      }
    } else if (isComponent(element)) {
      elementType = "component";
    } else if (element.isComponentInstance) {
      console.log(element);
    } else {
      throw new TypeError(`Expected a tag name or a Component. Received: ${element}`);
    }

    /**
     * @param args - Attributes object (optional) followed by any number of children
     */
    function Dolla(...args) {
      let attributes = { ...defaultAttrs };
      let children = args.length === 0 ? defaultChildren : args;

      if (args[0] && !isNode(args[0]) && isObject(args[0])) {
        attributes = children.shift();
      }

      children = children
        .filter((x) => x != null && x !== false) // ignore null, undefined and false
        .map((child) => makeRender(child)());

      switch (elementType) {
        case "component":
          return element.create(getService, $, attributes, children, $route);
        case "element":
          return new $Element(element, attributes, children);
        case "fragment":
          return new $Fragment(children);
      }
    }

    Object.defineProperty(Dolla, "isDolla", {
      get: () => true,
    });

    return Dolla;
  }

  $.if = function (value, then, otherwise) {
    return new $If(value, then, otherwise);
  };

  $.each = function (list, makeKey, makeItem) {
    return new $Each(list, makeKey, makeItem);
  };

  $.watch = function (source, create) {
    return new $Watch(source, create);
  };

  $.text = function (value) {
    return new $Text(value);
  };

  $.outlet = function (element = "div", attributes = {}) {
    if ($route.get("wildcard") == null) {
      throw new Error(
        `$.outlet() can only be used on routes that end with a wildcard. Current route: ${$route.get("route")}`
      );
    }

    const node = $(element, attributes);

    return new $Outlet(getService, node, $route);
  };

  /**
   * Creates a two way binding for input elements. Pass this as an $element's `value` attribute.
   *
   * @param state
   * @param event
   */
  $.bind = function (state, event = "input") {
    return {
      isBinding: true,
      event,
      state,
    };
  };

  Object.defineProperty($, "elements", {
    get() {
      const elements = {};

      for (const tag of [...htmlTags, ...htmlVoidTags]) {
        elements[tag] = function (...args) {
          return $(tag, ...args);
        };
      }

      return elements;
    },
  });

  Object.freeze($);

  return $;
}
