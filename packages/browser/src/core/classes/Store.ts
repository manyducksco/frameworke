import { Type } from "@borf/bedrock";
import { APP_CONTEXT, ELEMENT_CONTEXT } from "../keys.js";
import { isMarkup } from "../helpers/typeChecking.js";
import { Connectable } from "./Connectable.js";
import { Inputs, type InputValues, type InputDefinitions, type InputsAPI } from "./Inputs.js";
import { Outlet } from "./Outlet.js";
import { type Renderable } from "./Markup.js";
import { type AppContext, type ElementContext, type BuiltInStores } from "./App.js";
import { Readable, Writable, type StopFunction } from "./Writable.js";

type StoreOptions<I, O> = {
  appContext: AppContext;
  elementContext: ElementContext;
  channelPrefix?: string;
  label?: string;
  about?: string;
  inputs?: InputValues<I>;
  inputDefs?: InputDefinitions<I>;
  children?: unknown[];
  setup?: StoreSetupFunction<I, O>; // This is passed in directly to `new Store()` to turn a standalone setup function into a store.
};

export interface ComponentContext<I> {
  log(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
  crash(error: Error): void;

  inputs: InputsAPI<I>;

  observe<T>(readable: Readable<T>, callback: (value: T) => void): void;
  observe<T extends Readable<any>[], V = { [K in keyof T]: T[K] extends Readable<infer U> ? U : never }>(
    readables: [...T],
    callback: (...value: V) => void
  ): void;

  useStore<N extends keyof BuiltInStores>(name: N): BuiltInStores[N];
  useStore<S extends StoreConstructor<any, any>>(store: S): S extends StoreConstructor<any, infer U> ? U : never;

  /**
   * Registers a callback to run after the component is connected to the DOM.
   */
  onConnect(callback: () => void): void;

  /**
   * Registers a callback to run after the component is removed from the DOM.
   */
  onDisconnect(callback: () => void): void;
}

export interface StoreContext<I, O> extends ComponentContext<I> {
  [APP_CONTEXT]: AppContext;
  [ELEMENT_CONTEXT]: ElementContext;
}

export type StoreConstructor<I, O extends Record<string, any>> = {
  new (options: StoreOptions<I, O>): Store<I, O>;

  label?: string;
  about?: string;
  inputs?: InputDefinitions<I>;
};

export type StoreSetupFunction<I, O> = (ctx: StoreContext<I, O>) => O;

export type Storable<I, O extends Record<string, any>> = StoreConstructor<I, O> | StoreSetupFunction<I, O>;

type StoreDefinition<I, O> = {
  /**
   * Name to identify this store in the console and dev tools.
   */
  label?: string;

  /**
   * Explanation of this store.
   */
  about?: string;

  /**
   * Values passed into this store, usually as HTML attributes.
   */
  inputs?: InputDefinitions<I>;

  /**
   * Configures the store and returns object to export.
   */
  setup: StoreSetupFunction<I, O>;
};

export class Store<Inputs = {}, Outputs extends Record<string, any> = any> extends Connectable {
  static define<
    T extends StoreDefinition<any, any>,
    I = { [K in keyof T["inputs"]]: T["inputs"][K] },
    O extends Record<string, any> = ReturnType<T["setup"]>
  >(config: StoreDefinition<I, O>): StoreConstructor<I, O> {
    // TODO: Disable this when built for production.
    if (!config.label) {
      console.trace(
        `Store is defined without a label. Setting a label is recommended for easier debugging and error tracing.`
      );
    }

    return class extends Store<I, O> {
      static about = config.about;
      static label = config.label;
      static inputs = config.inputs;

      setup = config.setup;
    };
  }

  static isStore<I, O extends Record<string, any>>(value: any): value is Store<I, O> {
    return value?.prototype instanceof Store;
  }

  static isInstance<I, O extends Record<string, any>>(value: any): value is Store<I, O> {
    return value instanceof Store;
  }

  label;
  about;
  outputs!: Outputs;

  #node = document.createComment("Store");
  #outlet;
  #lifecycleCallbacks: Record<"onConnect" | "onDisconnect", (() => void)[]> = {
    onConnect: [],
    onDisconnect: [],
  };
  #stopCallbacks: StopFunction[] = [];
  #isConnected = false;
  #channel;
  #inputs;
  #$$children;
  #appContext: AppContext;
  #elementContext: ElementContext;

  get node() {
    return this.#node;
  }

  constructor({
    appContext,
    elementContext,
    channelPrefix = "store",
    label = "<anonymous>",
    about,
    inputs,
    inputDefs,
    children = [],
    setup, // This is passed in directly to `new Store()` to turn a standalone setup function into a store.
  }: StoreOptions<Inputs, Outputs>) {
    super();

    this.label = label;
    this.about = about;

    if (setup) {
      this.setup = setup;
    }

    this.#appContext = appContext;
    this.#elementContext = {
      ...elementContext,
      stores: new Map([
        ...elementContext.stores.entries(),
        [this.constructor, { store: this.constructor, instance: this }],
      ]),
    };

    this.#channel = appContext.debugHub.channel(`${channelPrefix}:${label}`);
    this.#$$children = new Writable(children);
    this.#inputs = new Inputs({
      inputs,
      definitions: inputDefs,
      enableValidation: true,
    });
    this.#outlet = new Outlet({
      value: this.#$$children,
      appContext: this.#appContext,
      elementContext: this.#elementContext,
    });
  }

  async #initialize(parent: Node, after?: Node) {
    const appContext = this.#appContext;
    const elementContext = this.#elementContext;

    const ctx: StoreContext<Inputs, Outputs> = {
      [APP_CONTEXT]: appContext,
      [ELEMENT_CONTEXT]: elementContext,

      inputs: this.#inputs.api,

      observe: (readable: Readable<any> | Readable<any>[], callback: (...args: any[]) => void) => {
        const readables: Readable<any>[] = [];

        if (Type.isArrayOf(Type.isInstanceOf(Readable), readable)) {
          readables.push(...readable);
        } else {
          readables.push(readable);
        }

        if (readables.length === 0) {
          throw new TypeError(`Expected at least one readable.`);
        }

        const start = (): StopFunction => {
          if (readables.length > 1) {
            return Readable.merge(readables, callback).observe(() => {});
          } else {
            return readables[0].observe(callback);
          }
        };

        if (this.isConnected) {
          // If called when the view is connected, we assume this code is in a lifecycle hook
          // where it will be triggered at some point again after the view is reconnected.
          this.#stopCallbacks.push(start());
        } else {
          // This should only happen if called in the body of the view.
          // This code is not always re-run between when a view is disconnected and reconnected.
          this.#lifecycleCallbacks.onConnect.push(() => {
            this.#stopCallbacks.push(start());
          });
        }
      },

      useStore: (nameOrStore: BuiltInStores | StoreConstructor<any, any>) => {
        if (typeof nameOrStore === "string") {
          const name = nameOrStore;

          if (appContext.stores.has(name)) {
            const _store = appContext.stores.get(name)!;

            if (!_store.instance) {
              throw new Error(
                `Store '${name}' was accessed before it was set up. Make sure '${name}' is registered before components that access it.`
              );
            }

            return _store.instance.outputs;
          }
        } else {
          const store = nameOrStore;
          const name = store?.name || store;

          if (elementContext.stores.has(store)) {
            if (appContext.stores.has(store)) {
              // Warn if shadowing a global, just in case this isn't intended.
              this.#channel.warn(`Using local store '${name}' which shadows global store '${name}'.`);
            }

            return elementContext.stores.get(store)!.instance!.outputs;
          }

          if (appContext.stores.has(store)) {
            const _store = appContext.stores.get(store)!;

            if (!_store.instance) {
              throw new Error(
                `Store '${name}' was accessed before it was set up. Make sure '${name}' is registered before components that access it.`
              );
            }

            return _store.instance.outputs;
          }

          throw new Error(`Store '${name}' is not registered on this app.`);
        }
      },

      onConnect: (callback: () => void) => {
        this.#lifecycleCallbacks.onConnect.push(callback);
      },

      onDisconnect: (callback: () => void) => {
        this.#lifecycleCallbacks.onDisconnect.push(callback);
      },

      crash: (error: Error) => {
        appContext.crashCollector.crash({ error, component: this });
      },
    };

    // Add debug channel methods.
    Object.defineProperties(ctx, Object.getOwnPropertyDescriptors(this.#channel));

    let outputs: unknown;

    try {
      outputs = this.setup(ctx);
    } catch (error) {
      if (error instanceof Error) {
        appContext.crashCollector.crash({ error, component: this });
      }
    }

    // Display loading content while setup promise pends.
    if (Type.isPromise(outputs)) {
      let cleanup;

      if (Type.isFunction(this.loading)) {
        // Render contents from loading() while waiting for setup to resolve.
        const content = this.loading(m);

        if (content === undefined) {
          throw new TypeError(`loading() must return a markup element, or null to render nothing. Returned undefined.`);
        }

        if (content !== null) {
          // m() returns a Markup with something in it. Either an HTML tag, a view setup function or a connectable class.
          // Markup.init(config) is called, which passes config stuff to the connectable's constructor.
          if (!isMarkup(content)) {
            throw new TypeError(
              `loading() must return a markup element, or null to render nothing. Returned ${content}.`
            );
          }
        }

        const component = content.init({ appContext, elementContext });
        component.connect(parent, after);

        cleanup = () => component.disconnect();
      }

      try {
        outputs = await outputs;
      } catch (error) {
        if (error instanceof Error) {
          appContext.crashCollector.crash({ error, component: this });
        }
      }

      if (cleanup) {
        cleanup();
      }
    }

    if (!(outputs != null && typeof outputs === "object" && !Array.isArray(outputs))) {
      throw new TypeError(`A store setup function must return an object. Got: ${outputs}`);
    }

    this.outputs = outputs as Outputs;
  }

  setup(ctx: StoreContext<Inputs, Outputs>): Outputs {
    throw new Error(`This store needs a setup function.`);
  }

  // loading(m: MarkupFunction): Markup {

  // }

  setChildren(children: Renderable[]) {
    this.#$$children.value = children;
  }

  async connect(parent: Node, after?: Node) {
    const wasConnected = this.isConnected;

    if (!wasConnected) {
      await this.#initialize(parent, after);
      await this.beforeConnect();
    }

    await super.connect(parent, after);
    await this.#outlet.connect(parent, after);

    if (!wasConnected) {
      this.afterConnect();
    }
  }

  async disconnect() {
    const wasConnected = this.isConnected;

    if (!wasConnected) {
      await this.beforeDisconnect();
    }

    await this.#outlet.disconnect();
    await super.disconnect();

    if (!wasConnected) {
      this.afterDisconnect();
    }
  }

  /**
   * Connects the store without running lifecycle callbacks.
   */
  async connectManual(parent: Node, after?: Node) {
    await this.#initialize(parent, after);
    await this.beforeConnect();

    await super.connect(parent, after);
    await this.#outlet.connect(parent, after);
  }

  /**
   * Disconnects the store without running lifecycle callbacks.
   */
  async disconnectManual() {
    await this.#outlet.disconnect();
    await super.disconnect();
  }

  async beforeConnect() {
    try {
      this.#inputs.connect();
    } catch (error) {
      if (error instanceof Error) {
        this.#appContext.crashCollector.crash({ error, component: this });
      }
    }
  }

  afterConnect() {
    this.#isConnected = true;

    for (const callback of this.#lifecycleCallbacks.onConnect) {
      callback();
    }
  }

  async beforeDisconnect() {
    for (const stop of this.#stopCallbacks) {
      stop();
    }
    this.#stopCallbacks = [];

    this.#inputs.disconnect();
  }

  afterDisconnect() {
    this.#isConnected = false;

    for (const callback of this.#lifecycleCallbacks.onDisconnect) {
      callback();
    }
  }
}
