import {
  isArray,
  isObject,
  isString,
  isNumber,
  isFunction,
  isObservable,
  isWritable,
  isReadable,
} from "../helpers/typeChecking.js";
import { omit } from "../helpers/omit.js";
import { Connectable } from "./Connectable.js";

export class HTML extends Connectable {
  #node;
  #attributes;
  #children;
  #appContext;
  #elementContext;
  #activeSubscriptions = [];

  get node() {
    return this.#node;
  }

  constructor({ tag, attributes, children, appContext, elementContext = {} }) {
    elementContext = Object.create(elementContext);

    // This and all nested views will be created as SVG elements.
    if (tag.toLowerCase() === "svg") {
      elementContext.isSVG = true;
    }

    // Create node.
    if (elementContext.isSVG) {
      this.#node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    } else {
      this.#node = document.createElement(tag);
    }

    const attributes = {};

    for (const key in attrs) {
      const normalized = key.toLowerCase();

      switch (normalized) {
        case "classname":
          attributes["class"] = attrs[key];
          break;
        default:
          attributes[key] = attrs[key];
          break;
      }
    }

    // Call ref function, if present.
    if (attributes.ref) {
      if (isFunction(attributes.ref)) {
        attributes.ref(this.#node);
      } else {
        throw new Error("Ref is not a function. Got: " + attrs.ref);
      }
    }

    this.#attributes = omit(["ref"], attributes);
    this.#children = children.map((c) => c.init({ appContext, elementContext }));
    this.#appContext = appContext;
    this.#elementContext = elementContext;
  }

  setChildren(children) {
    if (this.isConnected) {
      for (const child of this.#children) {
        child.disconnect();
      }
    }

    this.#children = children.map((c) =>
      c.init({ appContext: this.#appContext, elementContext: this.#elementContext })
    );

    if (this.isConnected) {
      for (const child of this.#children) {
        child.connect(this.#node);
      }
    }

    applyAttrs(this.#node, this.#attributes, this.#activeSubscriptions);
    if (this.#attributes.style) applyStyles(this.#node, this.#attributes.style, this.#activeSubscriptions);
    if (this.#attributes.class) applyClasses(this.#node, this.#attributes.class, this.#activeSubscriptions);
  }

  connect(parent, after = null) {
    if (!this.isConnected) {
      for (const child of this.#children) {
        child.connect(this.#node);
      }

      applyAttrs(this.#node, this.#attributes, this.#activeSubscriptions);
      if (this.#attributes.style) applyStyles(this.#node, this.#attributes.style, this.#activeSubscriptions);
      if (this.#attributes.class) applyClasses(this.#node, this.#attributes.class, this.#activeSubscriptions);
    }

    parent.insertBefore(this.#node, after?.nextSibling);
  }

  disconnect() {
    if (this.isConnected) {
      for (const child of this.#children) {
        child.disconnect();
      }

      this.#node.parentNode.removeChild(this.#node);

      while (this.#activeSubscriptions.length > 0) {
        this.#activeSubscriptions.shift().unsubscribe();
      }
    }
  }
}

function applyAttrs(element, attrs, subscriptions) {
  for (const key in attrs) {
    const value = attrs[key];

    // Bind or set value depending on its type.
    if (key === "value") {
      if (isReadable(value)) {
        subscriptions.push(
          value.subscribe((current) => {
            element.value = String(current);
          })
        );

        if (isWritable(value)) {
          const listener = (e) => {
            const updated = toTypeOf(value.get(), e.target.value);
            value.set(updated);
          };

          element.addEventListener("input", listener);

          subscriptions.push({
            unsubscribe: () => {
              element.removeEventListener("input", listener);
            },
          });
        }
      } else if (isObservable(value)) {
        subscriptions.push(
          value.subscribe((current) => {
            element.value = String(current);
          })
        );
      } else {
        element.value = String(value);
      }
    } else if (eventAttrs.includes(key.toLowerCase())) {
      const eventName = key.slice(2).toLowerCase();
      const listener = isObservable(attrs[key]) ? (e) => attrs[key].get()(e) : attrs[key];

      element.addEventListener(eventName, listener);

      subscriptions.push({
        unsubscribe: () => {
          element.removeEventListener(eventName, listener);
        },
      });
    } else if (!privateAttrs.includes(key)) {
      const isBoolean = booleanAttrs.includes(key);

      if (isObservable(value)) {
        subscriptions.push(
          value.subscribe((current) => {
            if (current) {
              element.setAttribute(key, isBoolean ? "" : current.toString());
            } else {
              element.removeAttribute(key);
            }
          })
        );
      } else if (value) {
        element.setAttribute(key, isBoolean ? "" : String(value));
      }
    }
  }
}

function applyStyles(element, styles, subscriptions) {
  const propSubscriptions = [];

  if (isObservable(styles)) {
    let unapply;

    const subscription = styles.subscribe((current) => {
      requestAnimationFrame(() => {
        if (isFunction(unapply)) {
          unapply();
        }
        element.style = null;
        unapply = applyStyles(element, current, subscriptions);
      });
    });

    subscriptions.push(subscription);
    propSubscriptions.push(subscription);
  } else if (isString(styles)) {
    element.style = styles;
  } else if (isObject(styles)) {
    for (const key in styles) {
      const value = styles[key];
      const setProperty = key.startsWith("--")
        ? (key, value) => element.style.setProperty(key, value)
        : (key, value) => (element.style[key] = value);

      if (isObservable(value)) {
        const subscription = value.subscribe((current) => {
          if (current) {
            setProperty(key, current);
          } else {
            element.style.removeProperty(key);
          }
        });

        subscriptions.push(subscription);
        propSubscriptions.push(subscription);
      } else if (isString(value)) {
        setProperty(key, value);
      } else if (isNumber(value)) {
        setProperty(key, value + "px");
      } else {
        throw new TypeError(`Style properties should be strings, $states or numbers. Got (${key}: ${value})`);
      }
    }
  } else {
    throw new TypeError(`Expected style property to be a string, $state, or object. Got: ${styles}`);
  }

  return function unapply() {
    for (const subscription of propSubscriptions) {
      subscription.unsubscribe();
      subscriptions.splice(subscriptions.indexOf(subscription), 1);
    }
  };
}

function applyClasses(element, classes, subscriptions) {
  const classSubscriptions = [];

  if (isObservable(classes)) {
    let unapply;

    const subscription = classes.subscribe((current) => {
      requestAnimationFrame(() => {
        if (isFunction(unapply)) {
          unapply();
        }
        element.removeAttribute("class");
        unapply = applyClasses(element, current, subscriptions);
      });
    });

    subscriptions.push(subscription);
    classSubscriptions.push(subscription);
  } else {
    const mapped = getClassMap(classes);

    for (const name in mapped) {
      const value = mapped[name];

      if (isObservable(value)) {
        const subscription = value.subscribe((current) => {
          if (current) {
            element.classList.add(name);
          } else {
            element.classList.remove(name);
          }
        });

        subscriptions.push(subscription);
        classSubscriptions.push(subscription);
      } else if (value) {
        element.classList.add(name);
      }
    }
  }

  return function unapply() {
    for (const subscription of classSubscriptions) {
      subscription.unsubscribe();
      subscriptions.splice(subscriptions.indexOf(subscription), 1);
    }
  };
}

function getClassMap(classes) {
  let mapped = {};

  if (isString(classes)) {
    // Support multiple classes in one string like HTML.
    const names = classes.split(" ");
    for (const name of names) {
      mapped[name] = true;
    }
  } else if (isObject(classes)) {
    Object.assign(mapped, classes);
  } else if (isArray(classes)) {
    Array.from(classes)
      .filter((item) => item != null)
      .forEach((item) => {
        Object.assign(mapped, getClassMap(item));
      });
  }

  return mapped;
}

/**
 * Attempts to convert `source` to the same type as `target`.
 * Returns `source` as-is if conversion is not possible.
 */
function toTypeOf(target, source) {
  const type = typeof target;

  if (type === "string") {
    return String(source);
  }

  if (type === "number") {
    return Number(source);
  }

  if (type === "boolean") {
    return Boolean(source);
  }

  return source;
}

// Attributes in this list will not be forwarded to the DOM node.
const privateAttrs = ["$ref", "children", "class", "value", "style", "data"];

const booleanAttrs = [
  "allowfullscreen",
  "async",
  "autocomplete",
  "autofocus",
  "autoplay",
  "checked",
  "contenteditable",
  "controls",
  "default",
  "defer",
  "disabled",
  "draggable",
  "formnovalidate",
  "hidden",
  "ismap",
  "itemscope",
  "loop",
  "multiple",
  "muted",
  "nomodule",
  "open",
  "playsinline",
  "readonly",
  "required",
  "reversed",
  "selected",
  "spellcheck",
  "translate",
  "truespeed",
];

const selfClosingTags = [
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
];

const eventAttrs = [
  "onclick",
  "ondblclick",
  "onmousedown",
  "onmouseup",
  "onmouseover",
  "onmousemove",
  "onmouseout",
  "onmouseenter",
  "onmouseleave",
  "ontouchcancel",
  "ontouchend",
  "ontouchmove",
  "ontouchstart",
  "ondragstart",
  "ondrag",
  "ondragenter",
  "ondragleave",
  "ondragover",
  "ondrop",
  "ondragend",
  "onkeydown",
  "onkeypress",
  "onkeyup",
  "onunload",
  "onabort",
  "onerror",
  "onresize",
  "onscroll",
  "onselect",
  "onchange",
  "onsubmit",
  "onreset",
  "onfocus",
  "onblur",
  "oninput",
  "onanimationend",
  "onanimationiteration",
  "onanimationstart",
];
