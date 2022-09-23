declare module "@woofjs/client" {
  import { History } from "history";

  /**
   * Creates a new woof app.
   *
   * @param options - Configuration options.
   */
  export function woof<Globals = any>(options?: AppOptions): App<Globals>;

  export default woof;

  /*==================================*\
  ||               App                ||
  \*==================================*/

  interface AppOptions {
    /**
     * Options for debug system.
     */
    debug?: {
      /**
       * Determines which debug channels are printed. Supports multiple filters with commas,
       * a prepended `-` to exclude a channel and wildcards to match partial channels.
       *
       * @example "service:*,-service:test" // matches everything starting with "service" except "service:test"
       */
      filter?: string | RegExp;

      /**
       * Print log messages when true. Default: true for development builds, false for production builds.
       */
      log?: boolean;

      /**
       * Print warn messages when true. Default: true for development builds, false for production builds.
       */
      warn?: boolean;

      /**
       * Print error messages when true. Default: true.
       */
      error?: boolean;
    };

    /**
     * Options to configure how routing works.
     */
    router?: {
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
    };
  }

  /**
   * An app is the central object of a Woof app. It handles mounting and unmounting of routes
   * based on the current URL and providing globals to views rendered under those routes.
   */
  interface App<G> extends RouterContext<G> {
    /**
     * Registers a service on this app. Services have only one instance created per app.
     * Any component rendered under one of this app's routes, as well as any other globals
     * registered on this app will be able to access this new service.
     *
     * @param name - Name the service is accessed by.
     * @param fn - The global constructor. Must be a function that returns an object.
     */
    global<Name extends keyof G>(name: Name, fn: G[Name]): this;

    /**
     * Runs a callback function after globals are created but before any views have been connected.
     *
     * @param callback - Setup function.
     */
    beforeConnect(callback: AppLifecycleCallback<G>): this;

    /**
     * Runs a callback function just after the initial route is connected.
     *
     * @param callback - Setup function.
     */
    afterConnect(callback: AppLifecycleCallback<G>): this;

    /**
     * Connects the app and starts routing. Routes are rendered as children of the `root` element.
     *
     * @param root - DOM node or a selector string.
     */
    connect(root: string | Node): Promise<void>;
  }

  export interface AppContext<G> extends DebugChannel {
    /**
     * Returns the global registered under `name` or throws an error if the global isn't registered.
     */
    global<K extends keyof AppGlobals<G>>(name: K): AppGlobals<G>[K];
  }

  export type AppLifecycleCallback<G> = (ctx: AppContext<G>) => void | Promise<void>;

  export type DefaultGlobals = {
    router: ReturnType<GlobalRouter>;
    http: ReturnType<GlobalHTTP>;
    page: ReturnType<GlobalPage>;
  };

  export type AppGlobals<T> = DefaultGlobals & { [K in keyof T]: ReturnType<T[K]> };

  /*==================================*\
  ||             Routing              ||
  \*==================================*/

  type PreloadContext<S, G> = {
    /**
     * Returns the global registered under `name` or throws an error if the global isn't registered.
     */
    global<K extends keyof AppGlobals<G>>(name: K): AppGlobals<G>[K];

    /**
     * Show content while this route is preloading.
     */
    show(element: WoofElement): void;
  } & Pick<StateContext<Unwrapped<S>>, "get" | "set" | "unset">;

  // These two options objects need to be defined separately or the context
  // type can't be inferred when you pass a window function directly.
  interface RouteViewFnOptions<G, S = any> {
    /**
     * Resolves before `window` is displayed. Useful for fetching data and preparing state prior to navigating to the page.
     */
    preload?: (ctx: PreloadContext<S, G>) => Promise<void> | void;
    /**
     * The window to display when this route matches.
     */
    view?: ViewFunction<S, G>;
    /**
     * Function to define subroutes that will be displayed as children of `window` when their routes match.
     */
    subroutes?: SubroutesFunction<G>;
  }

  interface RouteViewOptions<G, S = any> {
    /**
     * Resolves before `window` is displayed. Useful for fetching data and preparing state prior to navigating to the page.
     */
    preload?: (ctx: PreloadContext<S, G>) => Promise<void> | void;
    /**
     * The window to display when this route matches.
     */
    view?: View<S, G>;
    /**
     * Function to define subroutes that will be displayed as children of `window` when their routes match.
     */
    subroutes?: SubroutesFunction<G>;
  }

  interface RouterContext<G> {
    route<S = {}>(path: string, options: RouteViewFnOptions<G, S>): this;
    route<S = {}>(path: string, options: RouteViewOptions<G, S>): this;

    /**
     * Registers a new route that will render `window` when `path` matches the current URL.
     * Register nested routes by passing a function as the third argument. Nested route views
     * will be rendered as this `window`'s children.
     *
     * @param path - Path to match.
     * @param view - View to render when path matches URL.
     * @param subroutes - Optional function to define nested routes.
     */
    route<S = {}>(path: string, view: ViewFunction<S, G>, subroutes?: SubroutesFunction<G>): this;

    /**
     * Display `window` when `path` matches the current URL. Nested routes defined in `defineRoutes` are
     * passed as children to `window` when `path` + nested `path` matches the current URL.
     *
     * @param path - Path to match.
     * @param view - View to render when path matches URL.
     * @param subroutes - Optional function to define nested routes.
     */
    route<S = {}>(path: string, view: View<S, G>, subroutes?: SubroutesFunction<G>): this;

    route(path: string, view: Template, subroutes?: SubroutesFunction<G>): this;

    /**
     * Register a route that will redirect to another when the `path` matches the current URL.
     *
     * @param path - Path to match.
     * @param to - Path to redirect location.
     */
    redirect: (path: string, to: string) => RouterContext<G>;
  }

  type SubroutesFunction<G> = (ctx: RouterContext<G>) => void;

  /*==================================*\
  ||            Templating            ||
  \*==================================*/

  export type WoofElement = Template | ToStringable | Readable<ToStringable>;

  interface ToStringable {
    toString(): string;
  }

  export interface Template {
    readonly isTemplate: true;
    init(appContext: AppContext<any>): View<unknown, unknown>;
  }

  export function h<Tag extends keyof JSX.IntrinsicElements>(
    tag: Tag,
    attributes: JSX.IntrinsicElements[Tag],
    ...children: WoofElement[]
  ): Template;
  export function h(tag: string, attributes: Record<string, any>, ...children: WoofElement[]): Template;
  export function h(tag: string, ...children: WoofElement[]): Template;

  export function h(view: View<any, any>, ...children: WoofElement[]): Template;
  export function h<State>(view: View<State, any>, state: State, ...children: WoofElement[]): Template;

  /*==================================*\
  ||           Debug Context          ||
  \*==================================*/

  type DebugChannel = {
    name: string;

    /**
     * Log the arguments to the console.
     */
    log(...args: any): void;

    /**
     * Log the arguments to the console as a warning.
     */
    warn(...args: any): void;

    /**
     * Log the arguments to the console as an error.
     */
    error(...args: any): void;
  };

  /*==================================*\
  ||           State Context          ||
  \*==================================*/

  /**
   * State types wrapped in `Private` cannot be passed as attributes.
   *
   * @example
   * type ExampleState = {
   *   publicString: string;
   *   privateString: Private<string>;
   * }
   */
  export type Private<Value> = Value;

  /**
   * State types wrapped in `Bindable` may be a plain value or either type of binding.
   *
   * @example
   * type ExampleState = {
   *   plainNumber: number;
   *   bindableNumber: Bindable<number>;
   * }
   */
  export type Bindable<Value> = Value | Readable<Value> | Writable<Value>;

  /**
   * Unwrap state binding into its plain value.
   */
  type Unwrap<Bound> = Bound extends Readable<infer Value>
    ? Value
    : Bound extends Bindable<infer Value>
    ? Value
    : Bound extends Private<infer Value>
    ? Value
    : Bound;

  type Unwrapped<State> = {
    [Key in keyof State]: Unwrap<State[Key]>;
  };

  // A type consisting of all properties that can be deleted.
  type DeletableKeys<State> = Required<ExcludeRequiredProps<State>>;
  type KeysOfType<T, U> = { [K in keyof T]: T[K] extends U ? K : never }[keyof T];
  type RequiredKeys<T> = Exclude<KeysOfType<T, Exclude<T[keyof T], undefined>>, undefined>;
  type ExcludeRequiredProps<T> = Omit<T, RequiredKeys<T>>;

  /**
   * Context for stateful objects like views and globals.
   */
  interface StateContext<State> {
    defaultState?: Omit<State, "children">;

    /**
     * Returns the whole state.
     */
    get(): State;

    /**
     * Returns the current value of `key`.
     *
     * @param key - State key.
     */
    get<Key extends keyof State>(key: Key): State[Key];

    set<Key extends keyof State>(key: Key, value: State[Key]): void;
    set<Key extends keyof State>(key: Key, value: Readable<State[Key]>): void;
    set<Key extends keyof State>(key: Key, callback: (value: State[Key]) => void | State[Key]): void;

    set(values: { [Key in keyof State]: State[Key] }): void;

    /**
     * Resets value of `key` to `undefined`, deleting it.
     */
    unset<Key extends keyof DeletableKeys<State>>(key: Key): void;

    // TODO: Type annotations
    merge<V>(merge: (value: State) => V): Readable<V>;
    merge<T1, V>(source1: T1, merge: (value1: T1 extends keyof State ? State[T1] : Unwrap<T1>) => V): Readable<V>;
    merge<T1, T2, V>(
      source1: T1,
      source2: T2,
      merge: (
        value1: T1 extends keyof State ? State[T1] : Unwrap<T1>,
        value2: T2 extends keyof State ? State[T2] : Unwrap<T2>
      ) => V
    ): Readable<V>;
    merge<T1, T2, T3, V>(
      source1: T1,
      source2: T2,
      source3: T3,
      merge: (
        value1: T1 extends keyof State ? State[T1] : Unwrap<T1>,
        value2: T2 extends keyof State ? State[T2] : Unwrap<T2>,
        value3: T3 extends keyof State ? State[T3] : Unwrap<T3>
      ) => V
    ): Readable<V>;

    /**
     * Subscribes to an observable while this window is connected.
     *
     * @param observable - An Observable object compatible with the TC39 Observables spec. This can be a `State` from `@woofjs/client` or an observable from another library like RxJS.
     * @param observer - An observer object with `next`, `error` and `complete` methods.
     *
     * @see https://github.com/tc39/proposal-observable
     */
    observe<Value>(observable: Observable<Value>, observer: Observer<Value>): void;

    /**
     * Subscribes to an observable while this window is connected.
     *
     * @param observable - An Observable object compatible with the TC39 Observables spec. This can be a state binding or an observable from another library like RxJS.
     * @param next - Callback to receive `next` values from the observable.
     * @param error - Callback to receive `error` values from the observable.
     * @param complete - Callback to receive the `complete` signal from the observable.
     *
     * @see https://github.com/tc39/proposal-observable
     */
    observe<Value>(
      observable: Observable<Value>,
      next?: (value: Value) => void,
      error?: (err: Error) => void,
      complete?: () => void
    ): void;

    observe<Value>(observer: Observer<Value>): void;
    observe<Value>(next?: (value: Value) => void, error?: (err: Error) => void, complete?: () => void): void;

    observe<Key extends keyof State>(key: Key, observer: Observer<State[Key]>): void;
    observe<Key extends keyof State>(
      key: Key,
      next?: (value: State[Key]) => void,
      error?: (err: Error) => void,
      complete?: () => void
    ): void;

    readable(): Readable<State>;
    readable<Key extends keyof State>(key: Key): Readable<State[Key]>;

    writable(): Writable<State>;
    writable<Key extends keyof State>(key: Key): Writable<State[Key]>;
  }

  /*==================================*\
  ||            Observables            ||
  \*==================================*/

  export interface Observable<T> {
    subscribe(observer: Observer<T>): Subscription;
    subscribe(next?: (value: T) => void, error?: (err: Error) => void, complete?: () => void): Subscription;
  }

  export interface Observer<T> {
    next(value: T): void;
  }

  export interface Subscription {
    unsubscribe(): void;
  }

  /*==================================*\
  ||             Bindings             ||
  \*==================================*/

  export interface Readable<Value> extends Observable<Value> {
    /**
     * Returns the current value.
     */
    get(): Value;

    /**
     * Returns a new state that takes the return value of `callbackFn` when called with the value of this state.
     *
     * @param callback - Function to map the current state's value to the new state's value.
     */
    to<NewValue>(callback: (value: Value) => NewValue): Readable<NewValue>;
  }

  export interface Writable<Value> extends Readable<Value> {
    /**
     * Assigns a new value to the bound state.
     *
     * @param value - New value.
     */
    set(value: Value | Readable<Value>): void;

    /**
     * Assigns a new value to the bound state through a callback function that takes the current value and returns a new one.
     */
    set(callback: (value: Value) => Value): void;

    /**
     * Assigns a new value to the bound state through a callback function that takes the current value and mutates it to the desired value.
     */
    set(callback: (value: Value) => void): void;

    /**
     * Deletes this key from its bound state, returning the value to `undefined`.
     */
    unset(): void;

    /**
     * Creates a new read-only binding to this value.
     */
    readable(): Readable<Value>;
  }

  /*==================================*\
  ||               View               ||
  \*==================================*/

  /**
   * Stores a value when called with one and returns the most recent when called with none.
   */
  export interface Ref<T> {
    /**
     * Returns the most recent value this ref was called with.
     */
    (): T;

    /**
     * Saves a new value into this ref.
     */
    (value: T): void;
  }

  export function makeView<S = any, G = any>(fn: ViewFunction<S, G>): View<S, G>;

  export type ViewFunction<S = any, G = any> = (ctx: ViewContext<S, G>) => Template | null;

  export type View<S, G> = (props: FakeJSXProps<Partial<S>>) => {
    create(): Template;
  };

  // TODO: Figure out how to filter out keys wrapped in Private.
  type FakeJSXProps<State> = {
    [Key in keyof State]: State[Key];
  };

  export interface ViewContext<S = any, G = any> extends StateContext<Unwrapped<S>>, DebugChannel {
    /**
     * True while this window is connected to the DOM.
     */
    readonly isConnected: boolean;

    // observe<>()

    /**
     * Returns the global registered under `name` or throws an error if the global isn't registered.
     */
    global<Name extends keyof AppGlobals<G>>(name: Name): AppGlobals<G>[Name];

    /**
     * Registers a callback to run before the component is connected to the DOM.
     */
    beforeConnect(callback: () => void): void;

    /**
     * Registers a callback to run after the component is connected to the DOM.
     */
    afterConnect(callback: () => void): void;

    /**
     * Registers a callback to run before the component is removed from the DOM.
     */
    beforeDisconnect(callback: () => void): void;

    /**
     * Registers a callback to run after the component is removed from the DOM.
     */
    afterDisconnect(callback: () => void): void;

    /**
     * Returns a function that, when called with no arguments, returns the most recent value it was called with.
     * Useful for retrieving references to DOM nodes when passed to elements as `ref`.
     */
    ref<T>(initialValue?: T): Ref<T>;

    /**
     * Displays the result of `children` each time its value changes.
     */
    outlet(): WoofElement;

    /**
     * Displays the result of `key` each time its value changes. Value should be an Element.
     */
    outlet<Key extends keyof S>(key: Key): WoofElement;

    /**
     * Displays the result of `key` each time its value changes. The `callback` function converts `key` into an Element. TODO: Define these.
     */
    outlet<Key extends keyof S>(key: Key, callback: (value: S[Key]) => WoofElement): WoofElement;

    /**
     * Displays the value of `binding` each time its value changes. Value should be an element.
     */
    outlet(binding: Readable<WoofElement>): WoofElement;

    /**
     * Displays the value of `binding` each time its value changes. The `callback` function converts the value into an Element.
     */
    outlet<T>(binding: Readable<T>, callback: (value: T) => WoofElement): WoofElement;

    /**
     * Displays `element` when `value` is truthy.
     */
    when(value: Observable<any>, element: WoofElement): Template;
    when<Key extends keyof S>(key: Key, element: WoofElement): Template;

    /**
     * Displays `element` when `value` is falsy.
     */
    unless(value: Observable<any>, element: WoofElement): Template;
    unless<Key extends keyof S>(key: Key, element: WoofElement): Template;

    /**
     * Repeats an element for each item in `value`. Value must be iterable.
     * The `render` function takes bindings to the item and index and returns an element to render.
     */
    repeat<T>(
      value: T[] | Observable<T[]>,
      render: ($value: Readable<T>, $index: Readable<number>) => WoofElement,
      getKey?: (value: T) => any
    ): Template;

    /**
     * Repeats an element for each item in `value`. Value must be iterable.
     * The `render` function takes bindings to the item and index and returns an element to render.
     */
    repeat<Key extends keyof S>(
      key: Key,
      render: (
        $value: Readable<Unwrapped<S>[Key] extends Iterable<infer T> ? T : never>,
        $index: Readable<number>
      ) => WoofElement,
      getKey?: (value: S[Key]) => any
    ): Template;
  }

  /*==================================*\
  ||             Global              ||
  \*==================================*/

  // TODO: Find out how to infer return type of `fn` while S and G are passed.
  export function makeGlobal<S, G>(fn: GlobalFunction<S, G>): Global<any>;

  export type GlobalFunction<S, G> = (ctx: GlobalContext<S, G>) => any;

  export type Global<E> = (this: GlobalContext<any, any>) => E;

  export interface GlobalContext<S, G> extends StateContext<Unwrapped<S>>, DebugChannel {
    /**
     * Returns the global registered under `name` or throws an error if the global isn't registered.
     */
    global<Name extends keyof AppGlobals<G>>(name: Name): AppGlobals<G>[Name];

    /**
     * Registers a callback to run before the app is connected.
     */
    beforeConnect: (callback: () => void) => void;

    /**
     * Registers a callback to run after the app is connected and the first route match has taken place.
     */
    afterConnect: (callback: () => void) => void;

    /**
     * Returns a function that, when called with no arguments, returns the most recent value it was called with.
     * Useful for retrieving references to DOM nodes when passed to elements as `ref`.
     */
    ref<T>(initialValue?: T): Ref<T>;
  }

  /*==================================*\
  ||         Built-in Globals         ||
  \*==================================*/

  export type GlobalRouter = Global<{
    $route: Readable<string>;
    $path: Readable<string>;
    $params: Readable<{ [name: string]: unknown }>;
    $$query: Writable<{ [name: string]: unknown }>;

    back: (steps?: number) => void;
    forward: (steps?: number) => void;
    navigate: (path: string, options?: { replace?: boolean }) => void;
  }>;

  export type GlobalPage = Global<{
    $$title: Writable<string>;
  }>;

  export type GlobalHTTP = Global<{
    /**
     * Add middleware to the HTTP service for all requests.
     * Middleware can intercept outgoing requests and modify incoming responses.
     *
     * @param middleware - Async middleware function.
     */
    use(middleware: HTTPMiddleware): GlobalHTTP;

    /**
     * Make an HTTP request to `url` with any `method`.
     *
     * @param method - HTTP method.
     * @param url - Request endpoint.
     */
    request<T>(method: string, url: string): HTTPRequest<T>;

    /**
     * Make an HTTP `GET` request to `url`.
     *
     * @param url - Request endpoint.
     */
    get<T = any>(url: string): HTTPRequest<T>;

    /**
     * Make an HTTP `PUT` request to `url`.
     *
     * @param url - Request endpoint.
     */
    put<T = any>(url: string): HTTPRequest<T>;

    /**
     * Make an HTTP `PATCH` request to `url`.
     *
     * @param url - Request endpoint.
     */
    patch<T = any>(url: string): HTTPRequest<T>;

    /**
     * Make an HTTP `POST` request to `url`.
     *
     * @param url - Request endpoint.
     */
    post<T = any>(url: string): HTTPRequest<T>;

    /**
     * Make an HTTP `DELETE` request to `url`.
     *
     * @param url - Request endpoint.
     */
    delete<T = any>(url: string): HTTPRequest<T>;

    /**
     * Make an HTTP `HEAD` request to `url`.
     *
     * @param url - Request endpoint.
     */
    head(url: string): HTTPRequest<void>;
  }>;

  type HTTPResponse<BodyType> = {
    status: number;
    statusText: string;
    headers: {
      [name: string]: string;
    };
    body: BodyType;
  };

  type HTTPMiddleware = <T>(req: HTTPRequest<T>, next: () => Promise<void>) => Promise<void>;

  interface HTTPRequest<T> extends Promise<HTTPResponse<T>> {
    /**
     * True if this request is to a URL relative to the current page.
     */
    readonly isRelative: boolean;

    /**
     * Gets the current request URL.
     */
    url(): string;

    /**
     * Sets the request URL.
     */
    url(value: string): void;

    /**
     * Gets the current header value by name.
     */
    header(name: string): string | undefined;

    /**
     * Sets the value of the header with name `name` to `value`.
     * If `value` is null the header is removed.
     */
    header(name: string, value: ToStringable | null): this;

    /**
     * Clears the value of the header with name `name`.
     */
    header(name: string, value: null): this;

    /**
     * Sets multiple headers at once using an object.
     * Merge values with existing headers.
     */
    header(headers: { [name: string]: string }): this;

    /**
     * Returns the current value of the header with name `name`.
     */
    headers(name: string): string | undefined;

    /**
     * Sets the value of the header with name `name` to `value`.
     * If `value` is null the header is removed.
     */
    headers(name: string, value: ToStringable | null): this;

    /**
     * Sets multiple headers at once using an object.
     * New values are merged with existing headers.
     */
    headers(headers: { [name: string]: ToStringable | null }): this;

    /**
     * Returns the value of the query param with name `name`.
     */
    query(name: string): string | undefined;

    /**
     * Sets the value of the query param with name `name` to `value`.
     * If `value` is null the query param is removed.
     */
    query(name: string, value: ToStringable | null): this;

    /**
     * Sets multiple query params at once using an object.
     * New values are merged with existing params.
     */
    query(params: { [name: string]: ToStringable | null }): this;

    /**
     * Sets the request body to `value`.
     */
    body(value: any): this;

    /**
     * Defines a check for whether the response code indicates an error or success.
     * If this function returns false for a status code, it will be thrown as an error.
     */
    ok(check: (status: number) => boolean): this;

    /**
     * Returns the response object (if there is one).
     */
    response(): HTTPResponse<T> | undefined;
  }
}

declare module "@woofjs/client/jsx-runtime" {
  import { Template, View } from "@woofjs/client";

  export function jsx(
    element: string | View<any, any>,
    props: { [name: string]: any; children: Template },
    key: any
  ): Template;

  export function jsxs(
    element: string | View<any, any>,
    props: { [name: string]: any; children: Template[] },
    key: any
  ): Template;
}

declare module "@woofjs/client/jsx-dev-runtime" {
  import { Template, View } from "@woofjs/client";

  export function jsxDEV(
    element: string | View<any, any>,
    props: { [name: string]: any; children: Template | Template[] },
    key: any,
    isStaticChildren: boolean,
    source: any,
    self: any
  ): Template;
}

// TODO: Define all elements and the attributes they support.
declare namespace JSX {
  import { Observable, Ref, ToStringable } from "@woofjs/client";
  import * as CSS from "csstype";

  interface ElementChildrenAttribute {
    children: {}; // specify children name to use
  }

  type MaybeObservable<T> = T | Observable<T>;

  /**
   * The set of HTML attributes supported by all HTML elements.
   */
  interface HTMLGlobalAttributes {
    /**
     * The accesskey global attribute provides a hint for generating a keyboard shortcut
     * for the current element. The attribute value must consist of a single printable character
     * (which includes accented and other characters that can be generated by the keyboard).
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/accesskey
     */
    accesskey: string;

    /**
     * The autocapitalize global attribute is an enumerated attribute that controls whether and
     * how text input is automatically capitalized as it is entered/edited by the user.
     *
     * The attribute must take one of the following values:
     *   - `off` or `none`: No autocapitalization is applied (all letters default to lowercase)
     *   - `on` or `sentences`: The first letter of each sentence defaults to a capital letter; all other letters default to lowercase
     *   - `words`: The first letter of each word defaults to a capital letter; all other letters default to lowercase
     *   - `characters`: All letters should default to uppercase
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/autocapitalize
     */
    autocapitalize: "off" | "on" | "none" | "sentences" | "words" | "characters";

    /**
     * The `autofocus` attribute allows the author to indicate that an element
     * is to be focused as soon as the page is loaded or as soon as the dialog within
     * which it finds itself is shown, allowing the user to just start typing without
     * having to manually focus the main element.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/autofocus
     */
    autofocus: boolean;

    /**
     * CSS classes to be applied to this element. In addition to the standard space-separated list of class names,
     * this attribute is expanded in Woof to also support a class map object with class names as keys and booleans as values.
     * Class names in a class map will be applied to the element while their values are true. Also supports an
     * array of strings and class maps.
     *
     * @example
     * <div class="standard usage" />
     *
     * @example
     * <div class={["array", "of", "classes"]} />
     *
     * @example
     * <div class={{
     *   applied: true,
     *   notApplied: false
     * }} />
     *
     * @example
     * <div class={["class", "class2", { "conditional": $value }]} />
     */
    class: string | ClassMap | Array<string | ClassMap | (string | ClassMap)[]>;

    /**
     * Specifies whether the element's content can be edited.
     *
     * @see https://html.spec.whatwg.org/multipage/interaction.html#attr-contenteditable
     */
    contenteditable: "" | "true" | "false";

    /**
     * Specifies the element's text directionality.
     *
     * @see https://html.spec.whatwg.org/multipage/dom.html#attr-dir
     */
    dir: "ltr" | "rtl" | "auto";

    /**
     * Specifies whether the element is draggable for use with the [HTML Drag and Drop API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API).
     *
     * @see https://html.spec.whatwg.org/multipage/dnd.html#attr-draggable
     */
    draggable: "true" | "false";

    /**
     * The `enterkeyhint` attribute defines what action label (or icon) to present for the enter key on virtual keyboards.
     * This allows authors to customize the presentation of the enter key in order to make it more helpful for users.
     *
     * @see https://html.spec.whatwg.org/multipage/interaction.html#attr-enterkeyhint
     */
    enterkeyhint: "enter" | "done" | "go" | "next" | "previous" | "search" | "send";

    /**
     * The `hidden` global attribute is a Boolean attribute indicating that the element is not yet,
     * or is no longer, relevant. For example, it can be used to hide elements of the page that can't
     * be used until the login process has been completed. Browsers won't render elements with the `hidden` attribute set.
     *
     * @see https://html.spec.whatwg.org/multipage/interaction.html#attr-hidden
     */
    hidden: boolean;

    /**
     * The `id` defines an identifier (ID) which must be unique in the whole document. Its purpose is
     * to identify the element when linking, scripting, or styling with CSS.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/id
     */
    id: ToStringable;

    /**
     * @see https://html.spec.whatwg.org/multipage/interaction.html#the-inert-attribute
     */
    inert;

    /**
     * The `inputmode` content attribute is an enumerated attribute that specifies what kind of input mechanism would be most helpful for users entering content.
     */
    inputmode: "none" | "text" | "tel" | "url" | "email" | "numeric" | "decimal" | "search";

    /**
     * @see https://html.spec.whatwg.org/multipage/custom-elements.html#attr-is
     */
    is: string;

    /**
     * @see https://html.spec.whatwg.org/multipage/microdata.html#encoding-microdata
     */
    itemid: string;

    /**
     * @see https://html.spec.whatwg.org/multipage/microdata.html#encoding-microdata
     */
    itemprop: string;

    /**
     * @see https://html.spec.whatwg.org/multipage/microdata.html#encoding-microdata
     */
    itemref: string;

    /**
     * @see https://html.spec.whatwg.org/multipage/microdata.html#encoding-microdata
     */
    itemscope: boolean;

    /**
     * @see https://html.spec.whatwg.org/multipage/microdata.html#encoding-microdata
     */
    itemtype: string;

    /**
     * The `lang` global attribute helps define the language of an element: the language that non-editable elements are written in,
     * or the language that the editable elements should be written in by the user. The attribute contains a single "language tag"
     * in the format defined in [RFC 5646: Tags for Identifying Languages (also known as BCP 47)](https://datatracker.ietf.org/doc/html/rfc5646).
     *
     * @example
     * ```html
     * <span lang="ja">おはようございます</span>
     * ```
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/lang
     */
    lang: string;

    /**
     * @see https://html.spec.whatwg.org/multipage/urls-and-fetching.html#attr-nonce
     */
    nonce: string;

    /**
     * Specifies if the element is to have its spelling and grammar checked.
     *
     * @see https://html.spec.whatwg.org/multipage/interaction.html#attr-spellcheck
     */
    spellcheck: "" | "true" | "false";

    /**
     * Inline CSS styles.
     */
    style: Styles;

    /**
     * @see https://html.spec.whatwg.org/multipage/interaction.html#attr-tabindex
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/tabindex
     */
    tabindex: number;

    /**
     * The `title` attribute represents advisory information for the element, such as would be appropriate for a tooltip.
     * On a link, this could be the title or a description of the target resource; on an image, it could be the image credit
     * or a description of the image; on a paragraph, it could be a footnote or commentary on the text; on a citation,
     * it could be further information about the source; on interactive content, it could be a label for, or instructions for,
     * use of the element; and so forth.
     *
     * @see https://html.spec.whatwg.org/multipage/dom.html#attr-title
     */
    title: string;

    /**
     * The `translate` global attribute is an enumerated attribute that is used to specify whether an element's _translatable attribute_
     *  values and its `Text` node children should be translated when the page is localized, or whether to leave them unchanged.
     *
     * @see https://html.spec.whatwg.org/multipage/dom.html#attr-translate
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/translate
     */
    translate: "" | "yes" | "no";
  }

  interface Styles extends CSS.Properties, CSS.PropertiesHyphen {}

  interface ClassMap {
    [className: string]: boolean | Observable<boolean>;
  }

  type EventHandler<E> = (event: E) => void;

  interface HTMLGlobalEvents {
    /**
     * The `auxclick` event is fired at an Element when a non-primary pointing device button
     * (any mouse button other than the primary—usually leftmost—button) has been pressed
     * and released both within the same element.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/auxclick_event
     */
    onauxclick: EventHandler<PointerEvent>;
    /**
     * The `beforeinput` event fires when the value of an `<input>` or `<textarea>` element is about to be modified.
     * The event also applies to elements with `contenteditable` enabled, and to any element when `designMode` is turned on.
     *
     * This allows web apps to override text edit behavior before the browser modifies the DOM tree, and provides more control
     * over input events to improve performance.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/beforeinput_event
     */
    onbeforeinput: EventHandler<InputEvent>;

    onbeforematch: EventHandler<Event>;
    /**
     * The `blur` event fires when an element has lost focus.
     *
     * This event is not cancelable and does not bubble.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/blur_event
     */
    onblur: EventHandler<Event>;
    /**
     * The `cancel` event fires on a `<dialog>` when the user instructs the browser that they wish to dismiss the current open dialog.
     * For example, the browser might fire this event when the user presses the `Esc` key or clicks a "Close dialog" button which is part of the browser's UI.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/cancel_event
     */
    oncancel: EventHandler<Event>;

    /**
     * The `change` event is fired for `<input>`, `<select>`, and `<textarea>` elements when the user modifies the element's value.
     * Unlike the `input` event, the change event is not necessarily fired for each alteration to an element's value.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/change_event
     */
    onchange: EventHandler<Event>;
    /**
     * An element receives a `click` event when a pointing device button (such as a mouse's primary mouse button) is both pressed
     * and released while the pointer is located inside the element.
     *
     * `click` fires after both the `mousedown` and `mouseup` events have fired, in that order.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/click_event
     */
    onclick: EventHandler<PointerEvent>;
    /**
     * The `close` event is fired on an `HTMLDialogElement` object when the dialog it represents has been closed.
     *
     * This event is not cancelable and does not bubble.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/close_event
     */
    onclose: EventHandler<Event>;

    oncontextlost: EventHandler<Event>;
    /**
     * The `contextmenu` event fires when the user attempts to open a context menu.
     * This event is typically triggered by clicking the right mouse button, or by pressing the context menu key.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/contextmenu_event
     */
    oncontextmenu: EventHandler<PointerEvent>;

    oncontextrestored: EventHandler<Event>;
    /**
     * The `cuechange` event fires when a `TextTrack` has changed the currently displaying cues.
     * The event is fired on both the `TextTrack` and the `HTMLTrackElement` in which it's being presented, if any.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLTrackElement/cuechange_event
     */
    oncuechange: EventHandler<Event>;
    /**
     * The `dblclick` event fires when a pointing device button (such as a mouse's primary button) is double-clicked;
     * that is, when it's rapidly clicked twice on a single element within a very short span of time.
     *
     * `dblclick` fires after two `click` events (and by extension, after two pairs of `mousedown` and `mouseup` events).
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/dblclick_event
     */
    ondblclick: EventHandler<MouseEvent>;
    /**
     * The `drag` event is fired every few hundred milliseconds as an element or text selection is being dragged by the user.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/drag_event
     */
    ondrag: EventHandler<DragEvent>;
    /**
     * The `dragend` event is fired when a drag operation is being ended (by releasing a mouse button or hitting the escape key).
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dragend_event
     */
    ondragend: EventHandler<DragEvent>;
    /**
     * The `dragenter` event is fired when a dragged element or text selection enters a valid drop target.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dragenter_event
     */
    ondragenter: EventHandler<DragEvent>;
    /**
     * The `dragleave` event is fired when a dragged element or text selection leaves a valid drop target.
     *
     * This event is not cancelable.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dragleave_event
     */
    ondragleave: EventHandler<DragEvent>;
    /**
     * The `dragover` event is fired when an element or text selection is being dragged over a valid drop target (every few hundred milliseconds).
     *
     * The event is fired on the drop target(s).
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dragover_event
     */
    ondragover: EventHandler<Event>;
    /**
     * The `dragstart` event is fired when the user starts dragging an element or text selection.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dragstart_event
     */
    ondragstart: EventHandler<Event>;
    /**
     * The drop event is fired when an element or text selection is dropped on a valid drop target.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/drop_event
     */
    ondrop: EventHandler<PointerEvent>;
    /**
     * The `durationchange` event is fired when the `duration` attribute of a media element (`<audio>`, `<video>`) has been updated.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/durationchange_event
     */
    ondurationchange: EventHandler<Event>;
    /**
     * The `error` event is fired on an `Element` object when a resource failed to load, or can't be used.
     * For example, if a script has an execution error or an image can't be found or is invalid.
     *
     * This event is not cancelable and does not bubble.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/error_event
     */
    onerror: EventHandler<ErrorEvent>;
    /**
     * The `focus` event fires when an element has received focus.
     *
     * This event is not cancelable and does not bubble.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/focus_event
     */
    onfocus: EventHandler<Event>;
    /**
     * The `formdata` event fires after the entry list representing the form's data is constructed.
     * This happens when the form is submitted, but can also be triggered by the invocation of a `FormData()` constructor.
     *
     * This event is not cancelable and does not bubble.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/formdata_event
     */
    onformdata: EventHandler<FormDataEvent>;
    /**
     * The `input` event fires when the value of an `<input>`, `<select>`, or `<textarea>` element has been changed.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/input_event
     */
    oninput: EventHandler<InputEvent>;
    /**
     * The `invalid` event fires when a submittable element has been checked for validity and doesn't satisfy its constraints.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/invalid_event
     */
    oninvalid: EventHandler<Event>;
    /**
     * The` keydown` event is fired when a key is pressed.
     *
     * Unlike the `keypress` event, the `keydown` event is fired for all keys, regardless of whether they produce a character value.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/keydown_event
     */
    onkeydown: EventHandler<KeyboardEvent>;
    /**
     * The `keypress` event is fired when a key that produces a character value is pressed down.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/keypress_event
     * @deprecated
     */
    onkeypress: EventHandler<KeyboardEvent>;
    /**
     * The `keyup` event is fired when a key is released.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/keyup_event
     */
    onkeyup: EventHandler<KeyboardEvent>;

    onload: EventHandler<Event>;
    /**
     * The `loadeddata` event is fired when the frame at the current playback position of the media has finished loading; often the first frame.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/loadeddata_event
     */
    onloadeddata: EventHandler<Event>;
    /**
     * The `loadedmetadata` event is fired when the metadata has been loaded.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/loadedmetadata_event
     */
    onloadedmetadata: EventHandler<Event>;
    /**
     * The `loadstart` event is fired when the browser has started to load a resource.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/loadstart_event
     */
    onloadstart: EventHandler<Event>;
    /**
     * The `mousedown` event is fired at an element when a pointing device button is pressed while the pointer is inside the element.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/mousedown_event
     */
    onmousedown: EventHandler<MouseEvent>;
    /**
     * The `mouseenter` event is fired at an element when a pointing device (usually a mouse) is initially moved
     * so that its hotspot is within the element at which the event was fired.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/mouseenter_event
     */
    onmouseenter: EventHandler<MouseEvent>;
    /**
     * The `mouseleave` event is fired at an element when the cursor of a pointing device (usually a mouse) is moved out of it.
     *
     * `mouseleave` and `mouseout` are similar but differ in that `mouseleave` does not bubble and `mouseout` does.
     * This means that `mouseleave` is fired when the pointer has exited the element and all of its descendants,
     * whereas `mouseout` is fired when the pointer leaves the element or leaves one of the element's descendants
     * (even if the pointer is still within the element).
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/mouseleave_event
     */
    onmouseleave: EventHandler<MouseEvent>;
    /**
     * The `mousemove` event is fired at an element when a pointing device (usually a mouse) is moved while the cursor's hotspot is inside it.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/mousemove_event
     */
    onmousemove: EventHandler<MouseEvent>;
    /**
     * The `mouseout` event is fired at an element when a pointing device (usually a mouse) is used to move the cursor
     * so that it is no longer contained within the element or one of its children.
     *
     * `mouseout` is also delivered to an element if the cursor enters a child element, because the child element obscures the visible area of the element.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/mouseout_event
     */
    onmouseout: EventHandler<MouseEvent>;
    /**
     * The `mouseover` event is fired at an element when a pointing device (such as a mouse or trackpad) is used
     * to move the cursor onto the element or one of its child elements.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/mouseover_event
     */
    onmouseover: EventHandler<MouseEvent>;
    /**
     * The `mouseup` event is fired at an element when a button on a pointing device (such as a mouse or trackpad) is released while the pointer is located inside it.
     *
     * `mouseup` events are the counterpoint to `mousedown` events.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/mouseup_event
     */
    onmouseup: EventHandler<MouseEvent>;
    /**
     * The `reset` event fires when a `<form>` is reset.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/reset_event
     */
    onreset: EventHandler<Event>;
    /**
     * The `scroll` event fires when an element has been scrolled.
     *
     * **Note:** In iOS UIWebViews, scroll events are not fired while scrolling is taking place; they are only fired after the scrolling has completed.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/scroll_event
     */
    onscroll: EventHandler<Event>;
    /**
     * The `select` event fires when some text has been selected.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/select_event
     */
    onselect: EventHandler<Event>;
    /**
     * The `slotchange` event is fired on a `<slot>` element when the node(s) contained in that slot change.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLSlotElement/slotchange_event
     */
    onslotchange: EventHandler<Event>;
    /**
     * The `submit` event fires when a `<form>` is submitted.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/submit_event
     */
    onsubmit: EventHandler<SubmitEvent>;
    /**
     * The `toggle` event fires when the open/closed state of a `<details>` element is toggled.
     *
     * This event is not cancelable and does not bubble.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLDetailsElement/toggle_event
     */
    ontoggle: EventHandler<Event>;
    /**
     * The `animationend` event is fired when a CSS Animation has completed. If the animation aborts before reaching completion,
     * such as if the element is removed from the DOM or the animation is removed from the element, the `animationend` event is not fired.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/animationend_event
     */
    onanimationend: EventHandler<Event>;
    /**
     * The `animationiteration` event is fired when an iteration of a CSS Animation ends, and another one begins.
     * This event does not occur at the same time as the `animationend` event, and therefore does not occur for animations
     * with an `animation-iteration-count` of one.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/animationiteration_event
     */
    onanimationiteration: EventHandler<Event>;
    /**
     * The `animationstart` event is fired when a CSS Animation has started. If there is an `animation-delay`, this event will fire
     * once the delay period has expired. A negative delay will cause the event to fire with an `elapsedTime` equal to the absolute value
     * of the delay (and, correspondingly, the animation will begin playing at that time index into the sequence).
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/animationstart_event
     */
    onanimationstart: EventHandler<Event>;
    /**
     * The `transitionend` event is fired when a CSS transition has completed. In the case where a transition is removed before completion,
     * such as if the `transition-property` is removed or `display` is set to `none`, then the event will not be generated.
     *
     * The `transitionend` event is fired in both directions - as it finishes transitioning to the transitioned state,
     * and when it fully reverts to the default or non-transitioned state. If there is no transition delay or duration,
     * if both are 0s or neither is declared, there is no transition, and none of the transition events are fired.
     * If the `transitioncancel` event is fired, the `transitionend` event will not fire.
     *
     * This event is not cancelable.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/transitionend_event
     */
    ontransitionend: EventHandler<Event>;
    /**
     * The `wheel` event fires when the user rotates a wheel button on a pointing device (typically a mouse).
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event
     */
    onwheel: EventHandler<WheelEvent>;
  }

  // TODO: Move media events that don't bubble into this interface
  interface HTMLMediaElementEvents {
    /**
     * The `abort` event is fired when the resource was not fully loaded, but not as the result of an error.
     *
     * This event is not cancelable and does not bubble.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/abort_event
     */
    onabort: EventHandler<Event>;
    /**
     * The `canplay` event is fired when the user agent can play the media, but estimates that not enough data has been loaded
     * to play the media up to its end without having to stop for further buffering of content.
     *
     * This event is not cancelable and does not bubble.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/canplay_event
     */
    oncanplay: EventHandler<Event>;
    /**
     * The `canplaythrough` event is fired when the user agent can play the media, and estimates that enough data has been loaded
     * to play the media up to its end without having to stop for further buffering of content.
     *
     * This event is not cancelable and does not bubble.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/canplaythrough_event
     */
    oncanplaythrough: EventHandler<Event>;
    /**
     * The `emptied` event is fired when the media has become empty; for example, this event is sent if the media has already been loaded
     * (or partially loaded), and the `load()` method is called to reload it.
     *
     * This event is not cancelable and does not bubble.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/emptied_event
     */
    onemptied: EventHandler<Event>;
    /**
     * The `ended` event is fired when playback or streaming has stopped because the end of the media was reached or because no further data is available.
     *
     * This event is not cancelable and does not bubble.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/ended_event
     */
    onended: EventHandler<Event>;
    /**
     * The `pause` event is sent when a request to pause an activity is handled and the activity has entered its paused state,
     * most commonly after the media has been paused through a call to the element's `pause()` method.
     *
     * The event is sent once the `pause()` method returns and after the media element's `paused` property has been changed to `true`.
     *
     * This event is not cancelable and does not bubble.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/pause_event
     */
    onpause: EventHandler<Event>;
    /**
     * The `play` event is fired when the `paused` property is changed from `true` to `false`, as a result of the `play` method, or the `autoplay` attribute.
     *
     * This event is not cancelable and does not bubble.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play_event
     */
    onplay: EventHandler<Event>;
    /**
     * The `playing` event is fired after playback is first started, and whenever it is restarted.
     * For example, it is fired when playback resumes after having been paused or delayed due to lack of data.
     *
     * This event is not cancelable and does not bubble.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/playing_event
     */
    onplaying: EventHandler<Event>;
    /**
     * The `progress` event is fired periodically as the browser loads a resource.
     *
     * This event is not cancelable and does not bubble.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/progress_event
     */
    onprogress: EventHandler<Event>;
    /**
     * The `ratechange` event is fired when the playback rate has changed.
     *
     * This event is not cancelable and does not bubble.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/ratechange_event
     */
    onratechange: EventHandler<Event>;
    /**
     * The `seeked` event is fired when a seek operation completed, the current playback position has changed, and the Boolean `seeking` attribute is changed to `false`.
     *
     * This event is not cancelable and does not bubble.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/seeked_event
     */
    onseeked: EventHandler<Event>;
    /**
     * The `seeking` event is fired when a seek operation starts, meaning the Boolean `seeking` attribute has changed to `true` and the media is seeking a new position.
     *
     * This event is not cancelable and does not bubble.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/seeking_event
     */
    onseeking: EventHandler<Event>;
    /**
     * The `stalled` event is fired when the user agent is trying to fetch media data, but data is unexpectedly not forthcoming.
     *
     * This event is not cancelable and does not bubble.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/stalled_event
     */
    onstalled: EventHandler<Event>;
    /**
     * The `suspend` event is fired when media data loading has been suspended.
     *
     * This event is not cancelable and does not bubble.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/suspend_event
     */
    onsuspend: EventHandler<Event>;
    /**
     * The `timeupdate` event is fired when the time indicated by the `currentTime` attribute has been updated.
     *
     * The event frequency is dependent on the system load, but will be thrown between about 4Hz and 66Hz(assuming the event handlers don't take longer than 250ms to run).
     * User agents are encouraged to vary the frequency of the event based on the system load and the average cost of processing the event each time,
     * so that the UI updates are not any more frequent than the user agent can comfortably handle while decoding the video.
     *
     * This event is not cancelable and does not bubble.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/timeupdate_event
     */
    ontimeupdate: EventHandler<Event>;
    /**
     * The `volumechange` event is fired when the volume has changed.
     *
     * This event is not cancelable and does not bubble.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/volumechange_event
     */
    onvolumechange: EventHandler<Event>;
    /**
     * The `waiting` event is fired when playback has stopped because of a temporary lack of data.
     *
     * This event is not cancelable and does not bubble.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/waiting_event
     */
    onwaiting: EventHandler<Event>;
  }

  interface HTMLDocumentAndElementEvents {
    /**
     * The `copy` event fires when the user initiates a copy action through the browser's user interface.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/copy_event
     */
    oncopy: EventHandler<ClipboardEvent>;
    /**
     * The `cut` event is fired when the user has initiated a "cut" action through the browser's user interface.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/cut_event
     */
    oncut: EventHandler<Event>;
    /**
     * The `paste` event is fired when the user has initiated a "paste" action through the browser's user interface.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/paste_event
     */
    onpaste: EventHandler<Event>;
  }

  type PartialGlobals = Partial<HTMLGlobalAttributes>;

  type GlobalAttributes = {
    [K in keyof PartialGlobals]: MaybeObservable<PartialGlobals[K]>;
  };

  type PartialEvents = Partial<HTMLGlobalEvents> & Partial<HTMLDocumentAndElementEvents>;

  type GlobalEvents = {
    [K in keyof PartialEvents]: MaybeObservable<PartialEvents[K]>;
  };

  interface ElementAttributes<T extends HTMLElement> extends GlobalAttributes, GlobalEvents {
    /**
     * For TypeScript support; child elements passed through JSX.
     */
    children?: any;

    /**
     * A binding that receives a reference to the DOM element.
     */
    ref?: Ref<T> | Ref<HTMLElement> | Ref<Element>;
  }

  /**
   * The following elements are defined based on the WHATWG HTML spec:
   * https://html.spec.whatwg.org/multipage/#toc-semantics
   **/

  /*====================================*\
  || 4.3                       Sections ||
  \*====================================*/

  interface ArticleElementAttributes extends ElementAttributes<HTMLAnchorElement> {}
  interface SectionElementAttributes extends ElementAttributes<HTMLElement> {}
  interface NavElementAttributes extends ElementAttributes<HTMLElement> {}
  interface AsideElementAttributes extends ElementAttributes<HTMLElement> {}
  interface H1ElementAttributes extends ElementAttributes<HTMLHeadingElement> {}
  interface H2ElementAttributes extends ElementAttributes<HTMLHeadingElement> {}
  interface H3ElementAttributes extends ElementAttributes<HTMLHeadingElement> {}
  interface H4ElementAttributes extends ElementAttributes<HTMLHeadingElement> {}
  interface H5ElementAttributes extends ElementAttributes<HTMLHeadingElement> {}
  interface H6ElementAttributes extends ElementAttributes<HTMLHeadingElement> {}
  interface HgroupElementAttributes extends ElementAttributes<HTMLElement> {}
  interface HeaderElementAttributes extends ElementAttributes<HTMLElement> {}
  interface FooterElementAttributes extends ElementAttributes<HTMLElement> {}
  interface AddressElementAttributes extends ElementAttributes<HTMLElement> {}

  interface IntrinsicElements {
    /**
     * The `article` element represents a complete, or self-contained, composition in a document, page, application,
     * or site and that is, in principle, independently distributable or reusable, e.g. in syndication. This could be a forum post,
     * a magazine or newspaper article, a blog entry, a user-submitted comment, an interactive widget or gadget,
     * or any other independent item of content.
     *
     * When `article` elements are nested, the inner `article` elements represent articles that are in principle
     * related to the contents of the outer article. For instance, a blog entry on a site that accepts user-submitted
     * comments could represent the comments as `article` elements nested within the `article` element for the blog entry.
     *
     * @see https://html.spec.whatwg.org/multipage/sections.html#the-article-element
     */
    article: ArticleElementAttributes;

    /**
     * The `section` element represents a generic section of a document or application. A section, in this context,
     * is a thematic grouping of content, typically with a heading.
     *
     * @see https://html.spec.whatwg.org/multipage/sections.html#the-section-element
     */
    section: SectionElementAttributes;

    /**
     * The `nav` element represents a section of a page that links to other pages or to parts within the page: a section with navigation links.
     *
     * @see https://html.spec.whatwg.org/multipage/sections.html#the-nav-element
     */
    nav: NavElementAttributes;

    /**
     * The `aside` element represents a section of a page that consists of content that is tangentially related
     * to the content around the `aside` element, and which could be considered separate from that content.
     * Such sections are often represented as sidebars in printed typography.
     *
     * The element can be used for typographical effects like pull quotes or sidebars, for advertising,
     * for groups of nav elements, and for other content that is considered separate from the main content of the page.
     *
     * @see https://html.spec.whatwg.org/multipage/sections.html#the-aside-element
     */
    aside: AsideElementAttributes;

    /**
     * A heading for a top-level section.
     *
     * @see https://html.spec.whatwg.org/multipage/sections.html#the-h1,-h2,-h3,-h4,-h5,-and-h6-elements
     */
    h1: H1ElementAttributes;

    /**
     * A heading for a subsection.
     *
     * @see https://html.spec.whatwg.org/multipage/sections.html#the-h1,-h2,-h3,-h4,-h5,-and-h6-elements
     */
    h2: H2ElementAttributes;

    /**
     * A heading for a sub-subsection.
     *
     * @see https://html.spec.whatwg.org/multipage/sections.html#the-h1,-h2,-h3,-h4,-h5,-and-h6-elements
     */
    h3: H3ElementAttributes;

    /**
     * A heading for a sub-sub-subsection.
     *
     * @see https://html.spec.whatwg.org/multipage/sections.html#the-h1,-h2,-h3,-h4,-h5,-and-h6-elements
     */
    h4: H4ElementAttributes;

    /**
     * A heading for a sub-sub-sub-subsection.
     *
     * @see https://html.spec.whatwg.org/multipage/sections.html#the-h1,-h2,-h3,-h4,-h5,-and-h6-elements
     */
    h5: H5ElementAttributes;

    /**
     * A heading for a sub-sub-sub-subsection.
     *
     * @see https://html.spec.whatwg.org/multipage/sections.html#the-h1,-h2,-h3,-h4,-h5,-and-h6-elements
     */
    h6: H6ElementAttributes;

    /**
     * The `hgroup` element represents a heading and related content. The element may be used to group an
     * `h1`–`h6` element with one or more `p` elements containing content representing a subheading,
     * alternative title, or tagline.
     *
     * @example
     * ```html
     * <hgroup>
     *   <h1>Dr. Strangelove</h1>
     *   <p>Or: How I Learned to Stop Worrying and Love the Bomb</p>
     * </hgroup>
     * ```
     *
     * @see https://html.spec.whatwg.org/multipage/sections.html#the-hgroup-element
     */
    hgroup: HgroupElementAttributes;

    /**
     * The `header` element represents a group of introductory or navigational aids.
     *
     * @see https://html.spec.whatwg.org/multipage/sections.html#the-header-element
     */
    header: HeaderElementAttributes;

    /**
     * The `footer` element represents a footer for its nearest ancestor `article`, `aside`, `nav`, or `section`,
     * or for the `body` element if there is no such ancestor. A footer typically contains information about
     * its section such as who wrote it, links to related documents, copyright data, and the like.
     *
     * When the `footer` element contains entire sections, they represent appendices, indices, long colophons,
     * verbose license agreements, and other such content.
     *
     * @see https://html.spec.whatwg.org/multipage/sections.html#the-footer-element
     */
    footer: FooterElementAttributes;

    /**
     * The `address` element represents the contact information for its nearest `article` or `body` element ancestor.
     * If that is the `body` element, then the contact information applies to the document as a whole.
     *
     * @see https://html.spec.whatwg.org/multipage/sections.html#the-address-element
     */
    address: AddressElementAttributes;
  }

  /*====================================*\
  || 4.4               Grouping content ||
  \*====================================*/

  interface PElementAttributes extends ElementAttributes<HTMLParagraphElement> {}
  interface HrElementAttributes extends ElementAttributes<HTMLHRElement> {}
  interface PreElementAttributes extends ElementAttributes<HTMLPreElement> {}
  interface BlockquoteElementAttributes extends ElementAttributes<HTMLQuoteElement> {
    /**
     * Link to the source of the quotation. Must be a valid URL potentially surrounded by spaces.
     *
     * @see https://html.spec.whatwg.org/multipage/grouping-content.html#attr-blockquote-cite
     */
    cite?: MaybeObservable<string | undefined>;
  }
  interface OlElementAttributes extends ElementAttributes<HTMLOListElement> {
    /**
     * Indicates that the list is a descending list (..., 3, 2, 1).
     * If the attribute is omitted, the list is an ascending list (1, 2, 3, ...).
     *
     * @see https://html.spec.whatwg.org/multipage/grouping-content.html#attr-ol-reversed
     */
    reversed?: MaybeObservable<boolean | undefined>;

    /**
     * Starting value of the list.
     *
     * @see https://html.spec.whatwg.org/multipage/grouping-content.html#attr-ol-start
     */
    start?: MaybeObservable<number | undefined>;

    /**
     * The `type` attribute can be used to specify the kind of marker to use in the list,
     * in the cases where that matters (e.g. because items are to be referenced by their number/letter).
     *
     * @see https://html.spec.whatwg.org/multipage/grouping-content.html#attr-ol-type
     */
    type?: MaybeObservable<"l" | "a" | "A" | "i" | "I" | undefined>;
  }
  interface UlElementAttributes extends ElementAttributes<HTMLUListElement> {}
  interface MenuElementAttributes extends ElementAttributes<HTMLMenuElement> {}
  interface LiElementAttributes extends ElementAttributes<HTMLLIElement> {}
  interface DlElementAttributes extends ElementAttributes<HTMLDListElement> {}
  interface DtElementAttributes extends ElementAttributes<HTMLElement> {}
  interface DdElementAttributes extends ElementAttributes<HTMLElement> {}
  interface FigureElementAttributes extends ElementAttributes<HTMLElement> {}
  interface FigcaptionElementAttributes extends ElementAttributes<HTMLElement> {}
  interface MainElementAttributes extends ElementAttributes<HTMLElement> {}
  interface DivElementAttributes extends ElementAttributes<HTMLDivElement> {}

  interface IntrinsicElements {
    /**
     * The `p` element represents a paragraph.
     *
     * @see https://html.spec.whatwg.org/multipage/grouping-content.html#the-p-element
     */
    p: PElementAttributes;

    /**
     * The `hr` element represents a paragraph-level thematic break, e.g. a scene change in a story,
     * or a transition to another topic within a section of a reference book.
     *
     * @see https://html.spec.whatwg.org/multipage/grouping-content.html#the-hr-element
     */
    hr: HrElementAttributes;

    /**
     * The `pre` element represents a block of preformatted text, in which structure is represented
     * by typographic conventions rather than by elements.
     *
     * @see https://html.spec.whatwg.org/multipage/grouping-content.html#the-pre-element
     */
    pre: PreElementAttributes;

    /**
     * The `blockquote` element represents a section that is quoted from another source.
     *
     * @see https://html.spec.whatwg.org/multipage/grouping-content.html#the-blockquote-element
     */
    blockquote: BlockquoteElementAttributes;

    /**
     * The `ol` element represents a list of items, where the items have been intentionally ordered,
     * such that changing the order would change the meaning of the document.
     *
     * @see https://html.spec.whatwg.org/multipage/grouping-content.html#the-ol-element
     */
    ol: OlElementAttributes;

    /**
     * The `ul` element represents a list of items, where the order of the items is not important —
     * that is, where changing the order would not materially change the meaning of the document.
     *
     * @see https://html.spec.whatwg.org/multipage/grouping-content.html#the-ul-element
     */
    ul: UlElementAttributes;

    /**
     * The `menu` element represents a toolbar consisting of its contents, in the form of
     * an unordered list of items (represented by `li` elements), each of which represents
     * a command that the user can perform or activate.
     *
     * @see https://html.spec.whatwg.org/multipage/grouping-content.html#the-menu-element
     */
    menu: MenuElementAttributes;

    /**
     * The `li` element represents a list item. If its parent element is an `ol`, `ul`, or `menu` element,
     * then the element is an item of the parent element's list.
     *
     * @see https://html.spec.whatwg.org/multipage/grouping-content.html#the-li-element
     */
    li: LiElementAttributes;

    /**
     * The `dl` element represents an association list consisting of zero or more name-value groups
     * (a description list). Name-value groups may be terms and definitions, metadata topics and values,
     * questions and answers, or any other groups of name-value data.
     *
     * @see https://html.spec.whatwg.org/multipage/grouping-content.html#the-dl-element
     */
    dl: DlElementAttributes;

    /**
     * The `dt` element represents the term, or name, part of a term-description group in a description list (`dl` element).
     *
     * @see https://html.spec.whatwg.org/multipage/grouping-content.html#the-dt-element
     */
    dt: DtElementAttributes;

    /**
     * The `dd` element represents the description, definition, or value, part of a term-description group in a description list (`dl` element).
     *
     * @see https://html.spec.whatwg.org/multipage/grouping-content.html#the-dd-element
     */
    dd: DdElementAttributes;

    /**
     * The `figure` element represents some [flow content](https://html.spec.whatwg.org/multipage/dom.html#flow-content-2),
     * optionally with a caption, that is self-contained (like a complete sentence) and is typically referenced as
     * a single unit from the main flow of the document.
     *
     * @see https://html.spec.whatwg.org/multipage/grouping-content.html#the-figure-element
     */
    figure: FigureElementAttributes;

    /**
     * The `figcaption` element represents a caption or legend for the rest of the contents of the
     * `figcaption` element's parent `figure` element, if any.
     *
     * @see https://html.spec.whatwg.org/multipage/grouping-content.html#the-figcaption-element
     */
    figcaption: FigcaptionElementAttributes;

    /**
     * The `main` element represents the dominant contents of the document. A document must not
     * have more than one `main` element that does not have the `hidden` attribute specified.
     *
     * @see https://html.spec.whatwg.org/multipage/grouping-content.html#the-main-element
     */
    main: MainElementAttributes;

    /**
     * The `div` element has no special meaning at all. It represents its children.
     *
     * Authors are strongly encouraged to window the `div` element as an element of last resort,
     * for when no other element is suitable. Use of more appropriate elements instead of the `div`
     * element leads to better accessibility for readers and easier maintainability for authors.
     *
     * @see https://html.spec.whatwg.org/multipage/grouping-content.html#the-div-element
     */
    div: DivElementAttributes;
  }

  /*====================================*\
  || 4.5           Text-level semantics ||
  \*====================================*/

  interface AnchorElementAttributes extends ElementAttributes<HTMLAnchorElement> {
    /**
     * A hyperlink address. Must be a valid URL potentially surrounded by spaces.
     *
     * @see https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-a-element
     */
    href?: MaybeObservable<string | undefined>;

    /**
     * Where to display the linked URL, as the name for a browsing context (a tab, window, or `<iframe>`)
     *
     * A common usage is `target: "_blank"` to cause a link to open in a new tab.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#attr-target
     */
    target?: MaybeObservable<"_self" | "_blank" | "parent" | "_top" | undefined>;

    /**
     * Causes the browser to treat the linked URL as a download. Can be used with or without a value.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#attr-download
     */
    download?: MaybeObservable<string | undefined>;

    /**
     * A space-separated list of URLs. When the link is followed, the browser will send `POST` requests with the body PING to the URLs.
     * Typically for tracking.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#attr-ping
     */
    ping?: MaybeObservable<string | undefined>;

    /**
     * The relationship of the linked URL as space-separated [link types](https://developer.mozilla.org/en-US/docs/Web/HTML/Link_types).
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#attr-hreflang
     */
    rel?: MaybeObservable<string | undefined>;

    /**
     * Hints at the human language of the linked URL. No built-in functionality.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#attr-hreflang
     */
    hreflang?: MaybeObservable<string | undefined>;

    /**
     * Hints at the linked URL's format with a [MIME type](https://developer.mozilla.org/en-US/docs/Glossary/MIME_type). No built-in functionality.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#attr-type
     */
    type?: MaybeObservable<string | undefined>;

    /**
     * How much of the [referrer](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referer)
     * to send when following the link.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#attr-referrerpolicy
     */
    referrerpolicy?: MaybeObservable<
      | "no-referrer"
      | "no-referrer-when-downgrade"
      | "origin"
      | "origin-when-cross-origin"
      | "same-origin"
      | "strict-origin"
      | "strict-origin-when-cross-origin"
      | "unsafe-url"
      | undefined
    >;
  }
  interface EmElementAttributes extends ElementAttributes<HTMLElement> {}
  interface StrongElementAttributes extends ElementAttributes<HTMLElement> {}
  interface SmallElementAttributes extends ElementAttributes<HTMLElement> {}
  interface SElementAttributes extends ElementAttributes<HTMLElement> {}
  interface CiteElementAttributes extends ElementAttributes<HTMLElement> {}
  interface QElementAttributes extends ElementAttributes<HTMLElement> {}
  interface DfnElementAttributes extends ElementAttributes<HTMLElement> {}
  interface AbbrElementAttributes extends ElementAttributes<HTMLElement> {
    /**
     * Provides an expansion for the abbreviation or acronym when a full expansion is not present.
     * This provides a hint to user agents on how to announce/display the content while informing all users what the abbreviation means.
     * If present, `title` must contain this full description and nothing else.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/abbr
     */
    title?: MaybeObservable<string | undefined>;
  }
  interface RubyElementAttributes extends ElementAttributes<HTMLElement> {}
  interface RtElementAttributes extends ElementAttributes<HTMLElement> {}
  interface RpElementAttributes extends ElementAttributes<HTMLElement> {}
  interface DataElementAttributes extends ElementAttributes<HTMLDataElement> {
    /**
     * Specifies the machine-readable translation of the content of the element.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/data
     */
    value?: MaybeObservable<any>;
  }
  interface TimeElementAttributes extends ElementAttributes<HTMLTimeElement> {
    /**
     * Indicates the time and/or date of the element. Must be in one of the formats below:
     *
     *
     * a valid year string
     * ```
     * 2011
     * ```
     *
     * a valid month string
     * ```
     * 2011-11
     * ```
     *
     * a valid date string
     * ```
     * 2011-11-18
     * ```
     *
     * a valid yearless date string
     * ```
     * 11-18
     * ```
     *
     * a valid week string
     * ```
     * 2011-W47
     * ```
     *
     * a valid time string
     * ```
     * 14:54
     * 14:54:39
     * 14:54:39.929
     * ```
     *
     * a valid local date and time string
     * ```
     * 2011-11-18T14:54:39.929
     * 2011-11-18 14:54:39.929
     * ```
     *
     * a valid global date and time string
     * ```
     * 2011-11-18T14:54:39.929Z
     * 2011-11-18T14:54:39.929-0400
     * 2011-11-18T14:54:39.929-04:00
     * 2011-11-18 14:54:39.929Z
     * 2011-11-18 14:54:39.929-0400
     * 2011-11-18 14:54:39.929-04:00
     * ```
     *
     * a valid duration string
     * ```
     * PT4H18M3S
     * ```
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/time
     */
    datetime?: MaybeObservable<string | undefined>;
  }
  interface CodeElementAttributes extends ElementAttributes<HTMLElement> {}
  interface VarElementAttributes extends ElementAttributes<HTMLElement> {}
  interface SampElementAttributes extends ElementAttributes<HTMLElement> {}
  interface KbdElementAttributes extends ElementAttributes<HTMLElement> {}
  interface SubElementAttributes extends ElementAttributes<HTMLElement> {}
  interface SupElementAttributes extends ElementAttributes<HTMLElement> {}
  interface IElementAttributes extends ElementAttributes<HTMLElement> {}
  interface BElementAttributes extends ElementAttributes<HTMLElement> {}
  interface UElementAttributes extends ElementAttributes<HTMLElement> {}
  interface MarkElementAttributes extends ElementAttributes<HTMLElement> {}
  interface BdiElementAttributes extends ElementAttributes<HTMLElement> {
    /**
     * Directionality of the text inside the `<bdi>` element. Can be `rtl` for languages read right-to-left and `ltr` for languages read left-to-right. Defaults to `auto`.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/bdi
     */
    dir?: MaybeObservable<"auto" | "rtl" | "ltr" | undefined>;
  }
  interface BdoElementAttributes extends ElementAttributes<HTMLElement> {
    /**
     * Directionality of the text inside the `<bdo>` element. Can be `rtl` for languages read right-to-left and `ltr` for languages read left-to-right. Defaults to `auto`.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/bdo
     */
    dir?: MaybeObservable<"auto" | "rtl" | "ltr" | undefined>;
  }
  interface SpanElementAttributes extends ElementAttributes<HTMLSpanElement> {}
  interface BrElementAttributes extends ElementAttributes<HTMLBRElement> {}
  interface WbrElementAttributes extends ElementAttributes<HTMLElement> {}

  interface IntrinsicElements {
    /**
     * Creates a hyperlink to web pages, files, email addresses, locations in the same page, or anything else a URL can address.
     *
     * Content within each `<a>` should indicate the link's destination.
     * If the `href` attribute is present, pressing the enter key while focused on the `<a>` element will activate it.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a
     */
    a: AnchorElementAttributes;

    /**
     * Marks text that has stress emphasis. The `<em>` element can be nested, each level of nesting indicating a greater degree of emphasis.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/em
     */
    em: EmElementAttributes;

    /**
     * Indicates that its contents have strong importance, seriousness, or urgency. Browsers typically render the contents in bold type.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/strong
     */
    strong: StrongElementAttributes;

    /**
     * Represents side-comments and small print, like copyright and legal text.
     * Renders text within it one font-size smaller, such as from `small` to `x-small`.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/small
     */
    small: SmallElementAttributes;

    /**
     * Renders text with a strikethrough, or a line through it. Use the `<s>` element to represent things that are no longer relevant or no longer accurate.
     * However, `<s>` is not appropriate when indicating document edits; for that, use the `<del>` and `<ins>` elements.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/s
     */
    s: SElementAttributes;

    /**
     * Used to describe a reference to a cited creative work, and must include the title of that work.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/cite
     */
    cite: CiteElementAttributes;

    /**
     * indicates that the enclosed text is a short inline quotation. Most modern browsers implement this by surrounding the text in quotation marks.
     * For long quotations with paragraph breaks use the `<blockquote>` element.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/q
     */
    q: QElementAttributes;

    /**
     * Used to indicate the term being defined within the context of a definition phrase or sentence.
     * The `<p>` element, the `<dt>`/`<dd>` pairing, or the `<section>` element which is the nearest ancestor of the `<dfn>` is considered to be the definition of the term.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dfn
     */
    dfn: DfnElementAttributes;

    /**
     * Indicates an abbreviation or acronym. Provide a full expansion of the term in plain text on first use, along with the `<abbr>` to mark up the abbreviation.
     * This informs the user what the abbreviation or acronym means.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/abbr
     */
    abbr: AbbrElementAttributes;

    /**
     * Represents small annotations that are rendered above, below, or next to base text, usually used for showing the pronunciation of East Asian characters.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/ruby
     */
    ruby: RubyElementAttributes;

    /**
     * Specifies the ruby text component of a ruby annotation, which is used to provide pronunciation, translation,
     * or transliteration information for East Asian typography. The `<rt>` element must always be contained within a `<ruby>` element.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/rt
     */
    rt: RtElementAttributes;

    /**
     * Provide a fall-back parentheses for browsers that do not support display of ruby annotations using the `<ruby>` element.
     * One `<rp>` element should contain the `<rt>` element that contains the annotation's text.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/rp
     */
    rp: RpElementAttributes;

    /**
     * Wraps a piece of content, providing an additional machine-readable version in a `value` attribute.
     * For date or time related data, a `<time>` element is preferred.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/data
     */
    data: DataElementAttributes;

    /**
     * Represents a specific period in time. It may include the `datetime` attribute to translate dates into machine-readable format,
     * allowing for better search engine results or custom features such as reminders.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/time
     */
    time: TimeElementAttributes;

    /**
     * Displays its contents styled in a fashion intended to indicate that the text is a short fragment of computer code.
     * By default, the content text is displayed using a monospace font.
     *
     * You can display larger, multi-line `<code>` snippets by wrapping them with `<pre>` tags to keep the original line breaks.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/code
     */
    code: CodeElementAttributes;

    /**
     * Represents the name of a variable in a mathematical expression or a programming context.
     * Represented in italics by default in most browsers.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/var
     */
    var: VarElementAttributes;

    /**
     * Represents `<samp>`le output from a computer program. Displayed with a monospace font by default.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/samp
     */
    samp: SampElementAttributes;

    /**
     * Represents text a user would input with keyboard, voice, or another text entry device.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/kbd
     */
    kbd: KbdElementAttributes;

    /**
     * Represents a superscript (like the 2 in E=mc2).
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/sup
     */
    sup: SupElementAttributes;

    /**
     * Represents a subscript (like the 2 in H2O).
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/sub
     */
    sub: SubElementAttributes;

    /**
     * The _idiomatic text_ element.
     *
     * Represents a range of text that is set off from the normal text for some reason, such as idiomatic text,
     * technical terms, taxonomical designations, among others. Historically, these have been presented using italicized type,
     * which is the original source of the `<i>` naming of this element.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/i
     */
    i: IElementAttributes;

    /**
     * The _Bring Attention To_ element.
     *
     * Draws the reader's attention to the element's contents, which are not otherwise granted special importance.
     * This was formerly known as the Boldface element, and most browsers still draw the text in boldface.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/b
     */
    b: BElementAttributes;

    /**
     * The _Unarticulated Annotation_ (Underline) element.
     *
     * Represents a span of inline text which should be rendered in a way that indicates that it has a non-textual annotation.
     * This is rendered by default as a simple solid underline.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/u
     */
    u: UElementAttributes;

    /**
     * The _Mark Text_ element.
     *
     * Represents text which is marked or highlighted for reference or notation purposes,
     * due to the marked passage's relevance or importance in the enclosing context.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/mark
     */
    mark: MarkElementAttributes;

    /**
     * The _Bidirectional Isolate__ element.
     *
     * Tells the browser's bidirectional algorithm to treat the text it contains in isolation from its surrounding text.
     * It's particularly useful when a website dynamically inserts some text and doesn't know the directionality of the text being inserted.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/bdi
     */
    bdi: BdiElementAttributes;

    /**
     * The _Bidirectional Text Override_ element.
     *
     * Overrides the current directionality of text, so that the text within is rendered in a different direction.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/bdo
     */
    bdo: BdoElementAttributes;

    /**
     * The _Content Span_ element.
     *
     * A generic inline container for phrasing content, which does not inherently represent anything.
     * It can be used to group elements for styling purposes (using the `class` or `id` attributes),
     * or because they share attribute values, such as `lang`. It should be used only when no other semantic element
     * is appropriate. `<span>` is very much like a `<div>` element, but `<div>` is a block-level element
     * whereas `<span>` is an inline element.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/span
     */
    span: SpanElementAttributes;

    /**
     * The _Line Break_ element.
     *
     * Produces a line break (carriage-return) in text. HTML does not preserve line breaks outside a `<pre>` or element
     * with similar CSS, but they can be explicitly represented with a `<br>` element.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/br
     */
    br: BrElementAttributes;

    /**
     * The _Line Break Opportunity_ element.
     *
     * Represents a word break opportunity—a position within text where the browser may optionally break a line,
     * though its line-breaking rules would not otherwise create a break at that location.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/wbr
     */
    wbr: WbrElementAttributes;
  }

  /*====================================*\
  || 4.6                          Links ||
  \*====================================*/

  // --- This is just about <a> and <area> attributes in the spec.

  /*====================================*\
  || 4.7                          Edits ||
  \*====================================*/

  interface ModElementAttributes extends ElementAttributes<ModElementAttributes>, TimeElementAttributes {
    /**
     * A URL pointing to content that explains this change.
     * User agents may allow users to follow such citation links, but they are primarily intended for private use
     * (e.g., by server-side scripts collecting statistics about a site's edits), not for readers.
     */
    cite?: MaybeObservable<string | undefined>;
  }
  interface InsElementAttributes extends ModElementAttributes {}
  interface DelElementAttributes extends ModElementAttributes {}

  interface IntrinsicElements {
    /**
     * The _Inserted Text_ element.
     *
     * Represents a range of text that has been added to a document. You can use the `<del>` element to similarly
     * represent a range of text that has been deleted from the document.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/ins
     */
    ins: InsElementAttributes;

    /**
     * The _Deleted Text_ element.
     *
     * Represents a range of text that has been deleted from a document. This can be used when rendering "track changes"
     * or source code diff information, for example. The `<ins>` element can be used for the opposite purpose: to indicate
     * text that has been added to the document.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/del
     */
    del: DelElementAttributes;
  }

  /*====================================*\
  || 4.8               Embedded Content ||
  \*====================================*/

  // picture
  // source
  // img
  // iframe
  // embed
  // object
  // video
  // audio
  // track
  // map
  // area

  /*====================================*\
  || 4.9                   Tabular Data ||
  \*====================================*/

  // table
  // caption
  // colgroup
  // col
  // tbody
  // thead
  // tfoot
  // tr
  // td
  // th

  /*====================================*\
  || 4.10                         Forms ||
  \*====================================*/

  // form
  // label
  // input
  // button
  // select
  // datalist
  // optgroup
  // option
  // textarea
  // output
  // progress
  // meter
  // fieldset
  // legend

  /*====================================*\
  || 4.11          Interactive elements ||
  \*====================================*/

  // details
  // summary
  // dialog

  /*====================================*\
  || 4.12                     Scripting ||
  \*====================================*/

  // UNSUPPORTED script
  // UNSUPPORTED noscript
  // UNSUPPORTED template
  // UNSUPPORTED slot

  interface CanvasElementAttributes extends ElementAttributes<HTMLCanvasElement> {
    /**
     * The width of the coordinate space in CSS pixels. Defaults to 300.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/canvas#attributes
     */
    width?: MaybeObservable<string | number | undefined>;

    /**
     * The height of the coordinate space in CSS pixels. Defaults to 150.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/canvas#attributes
     */
    height?: MaybeObservable<string | number | undefined>;
  }

  interface IntrinsicElements {
    /**
     * The _Graphics Canvas_ element.
     *
     * Use it with either the [canvas scripting API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
     * or the [WebGL API](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) to draw graphics and animations.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/canvas
     */
    canvas: CanvasElementAttributes;
  }

  /*====================================*\
  ||                           Catchall ||
  \*====================================*/

  // Catchall allows any other tag. Useful for custom elements or future additions to HTML.
  interface IntrinsicElements {
    [tag: string]: any;
  }
}
