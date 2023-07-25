import { isArray, isFunction, isNumber, isObject, isString } from "@borf/bedrock";
import { AppContext, ElementContext } from "../App";
import { Dynamic } from "./Dynamic";
import { HTML } from "./HTML.js";
import { Text } from "./Text";
import { makeView, type View } from "../view.js";
import { Readable } from "../state";
import type { Renderable, Stringable } from "../types";
import { Repeat } from "./repeat.js";

export { observe } from "./observe.js";
export { repeat } from "./repeat.js";
export { unless } from "./unless.js";
export { when } from "./when.js";

const MARKUP = Symbol("Markup");

export interface Markup {
  type: string | View<any>;
  attributes?: Record<string, any>;
  children?: Markup[];
}

export interface DOMHandle {
  readonly node?: Node;
  readonly connected: boolean;
  connect(parent: Node, after?: Node): Promise<void>;
  disconnect(): Promise<void>;
  setChildren(markup: Markup[]): Promise<void>;
}

export interface DOMMarkup extends Markup {
  children?: DOMMarkup[];
  handle: DOMHandle;
}

export interface MarkupAttributes {
  $text: { value: Stringable | Readable<Stringable> };
  $dynamic: { value: Readable<any>; render?: (value: any) => Renderable };
  $repeat: { value: Readable<any[]>; render: any; key?: (value: any, index: number) => string | number };
  [tag: string]: Record<string, any>;
}

export function isMarkup(value: unknown): value is Markup {
  return isObject(value) && value[MARKUP] === true;
}

export function toMarkup(renderables: Renderable | Renderable[]): Markup[] {
  if (!isArray(renderables)) {
    renderables = [renderables];
  }

  return renderables
    .flat(Infinity)
    .filter((x) => x !== null && x !== undefined && x !== false)
    .map((x) => {
      if (isMarkup(x)) {
        return x;
      }

      if (isString(x) || isNumber(x) || Readable.isReadable(x)) {
        return makeMarkup("$text", { value: x });
      }

      console.error(x);
      throw new TypeError(`Unexpected child type. Got: ${x}`);
    });
}

export function makeMarkup<T extends keyof MarkupAttributes>(
  type: T,
  attributes: MarkupAttributes[T],
  ...children: Renderable[]
): Markup;

export function makeMarkup<I>(type: View<I>, attributes?: I, ...children: Renderable[]): Markup;

export function makeMarkup<I>(type: string | View<I>, attributes?: I, ...children: Renderable[]) {
  return {
    [MARKUP]: true,
    type,
    attributes,
    children: toMarkup(children),
  };
}

interface RenderContext {
  appContext: AppContext;
  elementContext: ElementContext;
}

export function renderMarkupToDOM(markup: Markup | Markup[], ctx: RenderContext): DOMMarkup[] {
  const items = isArray(markup) ? markup : [markup];

  return items.map((item) => {
    let handle!: DOMHandle;

    if (isFunction(item.type)) {
      handle = makeView({
        view: item.type as View<any>,
        attributes: item.attributes,
        children: item.children,
        appContext: ctx.appContext,
        elementContext: ctx.elementContext,
      });
    } else if (isString(item.type)) {
      switch (item.type) {
        case "$text":
          handle = new Text({
            value: item.attributes!.value,
          });
          break;
        case "$dynamic":
          handle = new Dynamic({
            readable: item.attributes!.value,
            render: item.attributes!.render,
            appContext: ctx.appContext,
            elementContext: ctx.elementContext,
          });
          break;
        case "$repeat":
          handle = new Repeat({
            readable: item.attributes!.value,
            render: item.attributes!.render,
            key: item.attributes!.key,
            appContext: ctx.appContext,
            elementContext: ctx.elementContext,
          });
          break;
        default:
          handle = new HTML({
            tag: item.type,
            attributes: item.attributes,
            children: item.children,
            appContext: ctx.appContext,
            elementContext: ctx.elementContext,
          });
          break;
      }
    } else {
      throw new TypeError(`Expected a string or component function. Got: ${item.type}`);
    }

    return {
      ...item,
      handle,
      children: item.children ? renderMarkupToDOM(item.children, ctx) : undefined,
    };
  });
}

/**
 * Gets a single handle that controls one or more RenderedMarkups as one.
 */
export function getRenderHandle(rendered: DOMMarkup[]): DOMHandle {
  if (rendered.length === 1) {
    return rendered[0].handle;
  }

  const node = document.createComment("renderHandle");

  let isConnected = false;

  return {
    get node() {
      return node;
    },
    get connected() {
      return isConnected;
    },
    async connect(parent: Node, after?: Node) {
      parent.insertBefore(node, after ? after : null);

      for (const item of rendered) {
        const previous = rendered[rendered.length - 1]?.handle.node ?? node;
        await item.handle.connect(parent, previous);
      }

      isConnected = true;
    },
    async disconnect() {
      if (isConnected) {
        for (const item of rendered) {
          item.handle.disconnect();
        }

        node.remove();
      }

      isConnected = false;
    },
    async setChildren() {},
  };
}
