import { isState } from "@woofjs/state";
import { isString, isNumber, isFunction, isNode } from "../helpers/typeChecking.js";
import { makeText } from "./makeText.js";

/**
 * Takes any valid child element and returns a render function that produces a node.
 */
export function makeRenderable(element) {
  if (isNode(element)) {
    return () => element;
  } else if (isString(element) || isNumber(element)) {
    return () => makeText(element);
  } else if (isState(element)) {
    return makeRenderable(element.get());
  } else if (isFunction(element)) {
    return makeRenderable(element());
  } else {
    console.warn(element);
    throw new Error(`Expected a string, function or element. Got: ${element}`);
  }
}
