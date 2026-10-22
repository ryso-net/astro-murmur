import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

class Events {
  // Test doubles intentionally expose only the browser fields used by each fixture.
  [key: string]: any;
  listeners = new Map<string, ((event: any) => unknown)[]>();
  addEventListener(type: string, listener: (event: any) => unknown) {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }
  async emit(type: string, values: Record<string, unknown> = {}) {
    const event = { type, target: this, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, ...values };
    await Promise.all((this.listeners.get(type) ?? []).map((listener) => listener(event)));
    return event;
  }
}

class Element extends Events {
  isConnected = true;
  dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  classes = new Set<string>();
  classList = {
    add: (name: string) => this.classes.add(name),
    remove: (name: string) => this.classes.delete(name),
  };
  children: Element[] = [];
  captured = new Set<number>();
  scrollTop = 0;
  clientTop = 0;
  clientHeight = 60;
  scrollHeight = 220;
  textContent = "";
  style = {
    values: new Map<string, string>(),
    setProperty(name: string, value: string) { this.values.set(name, value); },
    removeProperty(name: string) { this.values.delete(name); },
  };
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  removeAttribute(name: string) { this.attributes.delete(name); }
  hasAttribute(name: string) { return this.attributes.has(name); }
  toggleAttribute(name: string, force = !this.hasAttribute(name)) {
    if (force) this.setAttribute(name, "");
    else this.removeAttribute(name);
    return force;
  }
  append(...nodes: Element[]) { this.children.push(...nodes); }
  replaceChildren(...nodes: Element[]) { this.children = nodes; }
  focus() { this.focused = true; }
  getBoundingClientRect(): Partial<DOMRect> { return { top: 0, bottom: this.clientHeight, height: this.clientHeight }; }
  getClientRects() { return [this.getBoundingClientRect()]; }
  querySelector(_selector: string): Element | null { return null; }
  contains(target: Element): boolean { return this === target || this.children.some((node) => node.contains?.(target)); }
  setPointerCapture(id: number) { this.captured.add(id); }
  hasPointerCapture(id: number) { return this.captured.has(id); }
  releasePointerCapture(id: number) {
    this.captured.delete(id);
    void this.emit("lostpointercapture", { pointerId: id });
  }
}
class Popover extends Element {
  open = false;
  constructor() { super(); this.setAttribute("popover", "auto"); }
  matches(selector: string) { return selector === ":popover-open" && this.open; }
  hidePopover() { this.open = false; void this.emit("toggle"); }
}

function lifecycleDocument<T extends object>(document: T) {
  return document as T & { emitLifecycle(type: string, values?: Record<string, unknown>): Promise<unknown> };
}

function run(name: string, globals: Record<string, unknown>) {
  const source = readFileSync(new URL(`../src/scripts/${name}.ts`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  } });
  const document = globals.document as Record<string, any> | undefined;
  const lifecycleListeners = new Map<string, ((event: { type: string; target: unknown }) => unknown)[]>();
  if (document && typeof document.addEventListener !== "function") {
    document.addEventListener = (type: string, listener: (event: { type: string; target: unknown }) => unknown) => {
      const listeners = lifecycleListeners.get(type) ?? [];
      listeners.push(listener);
      lifecycleListeners.set(type, listeners);
    };
  }
  if (document) {
    document.emitLifecycle = async (type: string, values: Record<string, unknown> = {}) => {
      const event = { type, target: document, defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, ...values };
      await Promise.all((lifecycleListeners.get(type) ?? []).map((listener) => listener(event)));
      return event;
    };
  }
  const exports: Record<string, any> = {};
  vm.runInNewContext(outputText, { exports, Element, HTMLElement: Element, AbortController, URL,
    require: () => ({}), ...globals });
  for (const listener of lifecycleListeners.get("astro:page-load") ?? []) {
    listener({ type: "astro:page-load", target: document });
  }
  return exports;
}

test("full-page loads enable enhancement controls and restore the theme after root swaps", () => {
  const layout = readFileSync(new URL("../src/layouts/BaseLayout.astro", import.meta.url), "utf8");
  const inlineScript = layout.match(/<script is:inline>\s*([\s\S]*?)\s*<\/script>/)?.[1];
  assert.ok(inlineScript);

  const root = new Element(), colorScheme = new Element();
  const afterSwap: (() => void)[] = [];
  const document = {
    documentElement: root,
    querySelector: () => colorScheme,
    addEventListener(type: string, listener: () => void) {
      if (type === "astro:after-swap") afterSwap.push(listener);
    },
  };
  vm.runInNewContext(inlineScript, {
    document,
    localStorage: { getItem: () => "dark" },
    performance: { getEntriesByType: () => [{ type: "reload" }] },
    window: {},
  });

  assert.equal(root.dataset.hasJs, "");
  assert.equal(root.dataset.theme, "dark");
  assert.equal(colorScheme.attributes.get("content"), "dark");
  assert.equal(root.dataset.pageEnter, undefined);

  delete root.dataset.hasJs;
  delete root.dataset.theme;
  afterSwap.forEach((listener) => listener());
  assert.equal(root.dataset.hasJs, "");
  assert.equal(root.dataset.theme, "dark");
  assert.equal(colorScheme.attributes.get("content"), "dark");
});

test("chapter navigations use the regular entrance sequence without a layout expansion delay", async () => {
  const root = new Element();
  const document = lifecycleDocument({ documentElement: root });
  const desktop = new Events();
  desktop.matches = true;
  run("layout-interactions", { document, window: { matchMedia: () => desktop } });

  root.dataset.layout = "single";
  await document.emitLifecycle("astro:before-preparation", {
    to: new URL("https://murmur.test/posts/example/#chapter"),
  });
  root.dataset.layout = "double";
  await document.emitLifecycle("astro:after-swap");
  assert.equal(root.dataset.pageEnter, "double");
  assert.equal(root.dataset.layoutTransition, undefined);

  root.dataset.layout = "single";
  await document.emitLifecycle("astro:before-preparation", {
    to: new URL("https://murmur.test/posts/example/"),
  });
  root.dataset.layout = "double";
  await document.emitLifecycle("astro:after-swap");
  assert.equal(root.dataset.layoutTransition, "single-to-double");
  assert.equal(root.dataset.pageEnter, undefined);

  await document.emitLifecycle("astro:before-preparation", {
    to: new URL("https://murmur.test/posts/another/"),
  });
  await document.emitLifecycle("astro:after-swap");
  assert.equal(root.dataset.pageEnter, "double");
  assert.equal(root.dataset.layoutTransition, undefined);
});

test("Pagefind search loads on demand, opens the native dialog, and closes on Escape or route swaps", async () => {
  const dialog = new Element(), input = new Element(), closeButton = new Element();
  const root = new Element(), trigger = new Element();
  let loads = 0;
  let shouldFail = true;
  trigger.setAttribute("aria-label", "Search");
  trigger.dataset.pagefindFailed = "Search failed";
  dialog.open = false;
  closeButton.getAttribute = () => "Close search";
  dialog.querySelector = (selector) => selector === "[data-search-close]" ? closeButton
    : selector === "pagefind-input input" ? input : null;
  dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; void dialog.emit("close"); };
  const document = lifecycleDocument({ documentElement: root, querySelector: (selector: string) => ({
    "[data-search-open]": trigger, "[data-search-modal]": dialog,
  } as Record<string, Element>)[selector] ?? null });
  run("site-header", {
    document,
    // Search prewarming is idle work; this fixture keeps it queued so the test
    // can exercise the explicit open and retry paths deterministically.
    window: { matchMedia: () => new Events(), requestIdleCallback: () => 0 },
    require: () => ({ loadPagefindComponents: async () => {
      loads++;
      if (shouldFail) throw new Error("offline");
    } }),
  });

  await trigger.emit("click");
  await settle();
  assert.equal(loads, 1);
  assert.equal(dialog.open, false);
  assert.equal(trigger.attributes.get("aria-label"), "Search");
  assert.equal(trigger.attributes.get("title"), "Search failed");

  shouldFail = false;
  await trigger.emit("click");
  await settle();
  assert.equal(loads, 2);
  assert.equal(dialog.open, true);
  assert.equal(trigger.attributes.get("aria-expanded"), "true");
  assert.equal(trigger.attributes.has("title"), false);
  assert.equal(input.focused, true);

  const escape = await dialog.emit("keydown", { key: "Escape" });
  await settle();
  assert.equal(escape.defaultPrevented, true);
  assert.equal(dialog.open, false);
  assert.equal(trigger.attributes.get("aria-expanded"), "false");

  await trigger.emit("click");
  await settle();
  assert.equal(dialog.open, true);
  await document.emitLifecycle("astro:before-swap");
  assert.equal(dialog.open, false);
  assert.equal(trigger.attributes.get("aria-expanded"), "false");
  await document.emitLifecycle("astro:page-load");
  await settle();
  assert.equal(loads, 2);
  await trigger.emit("click");
  await settle();
  assert.equal(dialog.open, true);
  assert.equal(loads, 2);
});

test("mobile header follows scroll direction and stays visible for overlays, focus, and desktop", async () => {
  const header = new Element(), root = new Element(), viewport = new Events();
  const mobile = new Events(), nav = new Popover(), dialog = new Element();
  header.offsetHeight = 60;
  root.scrollHeight = 3000;
  mobile.matches = true;
  viewport.scrollY = 100;
  viewport.innerHeight = 800;
  viewport.matchMedia = () => mobile;
  const document = lifecycleDocument({ documentElement: root, querySelector: (selector: string) => ({
    ".site-header": header, "#site-nav-mobile-panel": nav, "[data-search-modal]": dialog,
  } as Record<string, Element>)[selector] ?? null });
  run("site-header", {
    document,
    window: viewport,
  });
  const scroll = async (y: number) => { viewport.scrollY = y; await viewport.emit("scroll"); };
  const hidden = () => header.hasAttribute("data-scroll-hidden");
  assert.equal(hidden(), false);
  await scroll(200);
  assert.equal(hidden(), true);
  await scroll(180);
  assert.equal(hidden(), false);
  await scroll(184);
  assert.equal(hidden(), false);
  await scroll(188);
  assert.equal(hidden(), true);
  await header.emit("focusin");
  assert.equal(hidden(), false);
  nav.open = true;
  await scroll(240);
  assert.equal(hidden(), false);
  nav.open = false;
  dialog.open = true;
  await scroll(0);
  await scroll(300);
  assert.equal(hidden(), false);
  dialog.open = false;
  await dialog.emit("close");
  await scroll(340);
  assert.equal(hidden(), true);
  await scroll(0);
  assert.equal(hidden(), false);
  await scroll(2200);
  assert.equal(hidden(), true);
  await scroll(2300);
  await scroll(2250);
  assert.equal(hidden(), true);
  await scroll(2180);
  assert.equal(hidden(), false);
  mobile.matches = false;
  await mobile.emit("change");
  await scroll(2200);
  assert.equal(hidden(), false);
  await scroll(1000);
  mobile.matches = true;
  await mobile.emit("change");
  await scroll(1100);
  assert.equal(hidden(), true);
  await document.emitLifecycle("astro:before-swap");
  assert.equal(hidden(), false);
});

function tocFixture() {
  const desktop = new Element(), mobile = new Popover(), panel = new Element(), handle = new Element();
  const summary = new Element(), content = new Element(), narrow = new Events(), window = new Events();
  narrow.matches = true;
  panel.clientHeight = 300;
  panel.scrollHeight = 500;
  const headings = [-500, -20, 800].map((top) => {
    const heading = new Element();
    heading.getBoundingClientRect = () => ({ top });
    return heading;
  });
  const makeLinks = (scroller: Element) => headings.map((_, index) => {
    const link = new Element();
    link.getAttribute = () => `#h${index}`;
    link.getBoundingClientRect = () => ({ top: index * 80 - scroller.scrollTop,
      bottom: index * 80 + 20 - scroller.scrollTop, height: 20 });
    return link;
  });
  const links = makeLinks(desktop), mobileLinks = makeLinks(panel);
  desktop.querySelectorAll = () => links;
  mobile.querySelectorAll = () => mobileLinks;
  desktop.closest = mobile.closest = () => ({ querySelector: () => content });
  panel.children = mobileLinks;
  panel.querySelector = (selector) => selector.includes("aria-current")
    ? mobileLinks.find((link) => link.hasAttribute("aria-current")) ?? null : mobileLinks[0];
  mobile.querySelector = (selector) => ({ ".mobile-toc-panel": panel,
    ".mobile-toc-scroll": panel, ".mobile-toc-handle": handle, summary } as Record<string, Element>)[selector] ?? null;
  window.innerHeight = 800;
  window.matchMedia = () => narrow;
  const frames = new Map<number, () => void>();
  let nextFrame = 0;
  window.requestAnimationFrame = (callback: () => void) => { frames.set(++nextFrame, callback); return nextFrame; };
  const flush = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach((fn) => fn()); };
  content.getBoundingClientRect = () => ({ bottom: 1600 });
  run("table-of-contents", { window, document: {
    activeElement: null, querySelectorAll: () => [desktop, mobile],
    querySelector: (selector: string) => selector === ".mobile-toc-toggle" ? summary : mobile,
    getElementById: (id: string) => headings[Number(id.slice(1))],
  }, requestAnimationFrame: window.requestAnimationFrame });
  const pointer = (type: string, id: number, y: number, extra = {}) => handle.emit(type, {
    pointerId: id, clientY: y, isPrimary: true, button: 0, ...extra,
  });
  return { desktop, mobile, panel, narrow, window, links, flush, pointer };
}

test("ToC follows the current section within its own scroller without fighting manual scrolling", async () => {
  const fixture = tocFixture();
  assert.equal(fixture.desktop.scrollTop, 40);
  assert.equal(fixture.links.filter((link) => link.hasAttribute("aria-current")).length, 1);
  fixture.desktop.scrollTop = 0;
  await fixture.window.emit("scroll");
  fixture.flush();
  assert.equal(fixture.desktop.scrollTop, 0);
});

test("ToC ignores other pointers and cancels lost capture, resize, and breakpoint changes", async () => {
  const f = tocFixture();
  f.mobile.open = true;
  await f.pointer("pointerdown", 1, 10);
  await f.pointer("pointerdown", 2, 200, { isPrimary: false });
  await f.pointer("pointermove", 2, 400);
  assert.equal(f.panel.style.values.has("--mobile-toc-drag-y"), false);
  await f.pointer("pointermove", 1, 60);
  assert.equal(f.panel.style.values.get("--mobile-toc-drag-y"), "50px");
  await f.pointer("lostpointercapture", 1, 60);
  assert.equal(f.panel.style.values.has("--mobile-toc-drag-y"), false);
  assert.equal(f.mobile.open, true);
  await f.pointer("pointerdown", 1, 0);
  await f.pointer("pointermove", 1, 150);
  await f.pointer("pointercancel", 1, 150);
  assert.equal(f.mobile.open, true);
  await f.pointer("pointerdown", 1, 0);
  await f.pointer("pointermove", 1, 150);
  await f.window.emit("resize");
  assert.equal(f.panel.style.values.has("--mobile-toc-drag-y"), false);
  await f.pointer("pointerdown", 1, 0);
  await f.pointer("pointermove", 1, 150);
  await f.pointer("pointerup", 1, 150);
  assert.equal(f.mobile.open, false);
  f.mobile.open = true;
  f.narrow.matches = false;
  await f.narrow.emit("change");
  assert.equal(f.mobile.open, false);
});

test("copy failure is visible and announced; a retry restores success feedback", async () => {
  const block = new Element(), code = new Element(), prose = new Element();
  code.textContent = "const value = 1;";
  prose.dataset = { copyCode: "Copy", codeCopied: "Copied", copyFailed: "Copy failed" };
  block.querySelector = () => code;
  block.closest = () => prose;
  let wrapper!: Element;
  let reject = true;
  block.before = (node: Element) => { wrapper = node; };
  const timers = new Map<number, () => void>();
  let nextTimer = 0;
  const document = lifecycleDocument({ querySelectorAll: () => [block], createElement: () => new Element(),
    createElementNS: () => new Element() });
  run("code-copy", {
    document,
    navigator: { clipboard: { async writeText(value: string) {
      assert.equal(value, code.textContent);
      if (reject) throw new Error("denied");
    } } },
    window: { clearTimeout: (id: number) => timers.delete(id),
      setTimeout: (fn: () => void) => { timers.set(++nextTimer, fn); return nextTimer; } },
  });
  const [, button, status] = wrapper.children;
  await button.emit("click");
  assert.equal(status.textContent, "Copy failed");
  assert.equal(status.attributes.get("role"), "status");
  assert.equal(button.disabled, false);
  reject = false;
  await button.emit("click");
  assert.equal(status.textContent, "Copied");
  [...timers.values()][0]();
  assert.equal(button.attributes.get("aria-label"), "Copy");
  assert.equal(status.textContent, "");
  await button.emit("click");
  await document.emitLifecycle("astro:before-swap");
  assert.equal(timers.size, 0);
});

const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

function pagefindFixture() {
  const trigger = new Element(), links: Element[] = [], imports: string[] = [], instances: string[] = [];
  trigger.dataset = { pagefindComponentPath: "/pagefind/pagefind-component-ui.js",
    pagefindComponentCss: "/pagefind/pagefind-component-ui.css" };
  const document = {
    querySelector: (selector: string) => selector === "link[data-pagefind-component-ui]"
      ? links.find((link) => link.isConnected) ?? null : null,
    createElement: () => {
      const link = new Element();
      link.cloneNode = () => {
        const copy = new Element();
        copy.href = link.href;
        copy.rel = link.rel;
        copy.dataset = { ...link.dataset };
        return copy;
      };
      link.remove = () => { link.isConnected = false; };
      return link;
    },
    head: { append: (link: Element) => links.push(link) },
  };
  const searchModule = run("site-search", {
    document,
    window: { PagefindComponents: { getInstanceManager: () => ({
      getInstance(name: string) { instances.push(name); return {}; },
    }) } },
    require: (path: string) => { imports.push(path); return {}; },
  });
  return { trigger, document, links, imports, instances, searchModule };
}

test("Pagefind component loading shares CSS and script requests", async () => {
  const f = pagefindFixture();
  const first = f.searchModule.loadPagefindComponents(f.trigger);
  const second = f.searchModule.loadPagefindComponents(f.trigger);
  assert.equal(f.links.length, 1);
  assert.equal(f.links[0]?.dataset.pagefindComponentUi, "loading");

  await f.links[0]?.emit("load");
  await Promise.all([first, second]);
  assert.equal(f.links[0]?.dataset.pagefindComponentUi, "ready");
  assert.deepEqual(f.imports, ["/pagefind/pagefind-component-ui.js"]);
  assert.deepEqual(f.instances, ["murmur-search"]);
});

test("Pagefind component stylesheet survives an Astro head swap", async () => {
  const f = pagefindFixture();
  const request = f.searchModule.loadPagefindComponents(f.trigger);
  await f.links[0]?.emit("load");
  await request;

  const incomingStylesheets: Element[] = [];
  const newDocument = { head: {
    querySelectorAll: () => incomingStylesheets,
    append: (link: Element) => incomingStylesheets.push(link),
  } };
  await f.document.emitLifecycle("astro:before-swap", { newDocument });

  assert.equal(incomingStylesheets.length, 1);
  assert.equal(incomingStylesheets[0]?.href, f.links[0]?.href);
  assert.equal(incomingStylesheets[0]?.dataset.pagefindComponentUi, "ready");
});

test("Pagefind component loading retries when its stylesheet fails", async () => {
  const f = pagefindFixture();
  const first = f.searchModule.loadPagefindComponents(f.trigger);
  await f.links[0]?.emit("error");
  await assert.rejects(first);
  assert.equal(f.links[0]?.isConnected, false);

  const retry = f.searchModule.loadPagefindComponents(f.trigger);
  assert.equal(f.links.length, 2);
  await f.links[1]?.emit("load");
  await retry;
  assert.equal(f.imports.length, 1);
});

function commentsFixture(lazy = true, options: Record<string, unknown> = {}) {
  const root = new Element();
  const scripts: Element[] = [], styles: Element[] = [];
  const instances: Record<string, unknown>[] = [], updates: Record<string, unknown>[] = [];
  let observer!: IntersectionObserver;
  let themeChanged!: () => void;
  const window: Record<string, any> = {};
  const config = { server: "https://comments.example", ...options };
  root.dataset.theme = "dark";
  const createTarget = () => {
    const target = new Element();
    target.dataset.artalkFailed = "comments failed";
    target.dataset.artalkOptions = JSON.stringify(config);
    return target;
  };
  let target = createTarget();
  class IntersectionObserver {
    callback: (entries: { isIntersecting: boolean }[]) => void;
    constructor(callback: IntersectionObserver["callback"]) { observer = this; this.callback = callback; }
    observe() {}
    disconnect() {}
  }
  window.Artalk = {
    init(value: Record<string, unknown>) {
      instances.push(value);
      return { destroy() {}, setDarkMode(darkMode: boolean) { updates.push({ darkMode }); } };
    },
  };
  if (lazy) window.IntersectionObserver = IntersectionObserver;
  const document = lifecycleDocument({ documentElement: root, querySelector: () => target,
    createElement: (tagName: string) => {
      const element = new Element();
      if (tagName === "script") element.src = "";
      element.remove = () => { element.isConnected = false; };
      return element;
    },
    head: { append: (element: Element) => {
      if ("src" in element) scripts.push(element);
      else styles.push(element);
    } } });
  run("artalk-comments", {
    document,
    window,
    IntersectionObserver,
    MutationObserver: class { constructor(callback: () => void) { themeChanged = callback; } observe() {} disconnect() {} },
  });
  return { get target() { return target; }, setTarget(value: Element) {
      value.dataset.artalkFailed = "comments failed";
      value.dataset.artalkOptions = JSON.stringify(config);
      target = value;
    }, document, root, scripts, styles, instances, updates, observer,
    changeTheme() { themeChanged(); } };
}

test("comments wait until near the viewport and stylesheet readiness, then follow theme changes", async () => {
  const f = commentsFixture();
  assert.equal(f.scripts.length, 0);
  assert.equal(f.styles.length, 0);
  f.observer.callback([{ isIntersecting: false }]);
  assert.equal(f.scripts.length, 0);
  assert.equal(f.styles.length, 0);
  f.observer.callback([{ isIntersecting: true }]);
  await settle();
  assert.equal(f.scripts.length, 1);
  assert.equal(f.styles.length, 1);
  assert.equal(f.instances.length, 0);
  f.scripts[0].onload();
  f.styles[0].onload();
  await settle();
  assert.equal(f.instances[0].darkMode, true);
  f.root.dataset.theme = "light";
  f.changeTheme();
  assert.equal(f.updates[0].darkMode, false);
  delete f.root.dataset.theme;
  f.changeTheme();
  assert.equal(f.updates[1].darkMode, false);
});

test("comments pass Artalk page identity and preserve an explicit theme", async () => {
  const options = { server: "https://comments.example", site: "Blog", pageKey: "/posts/test/",
    pageTitle: "Test", locale: "en", darkMode: false };
  const f = commentsFixture(false, options);
  f.scripts[0].onload();
  f.styles[0].onload();
  await settle();
  for (const [key, value] of Object.entries(options)) assert.equal(f.instances[0][key], value);
  assert.equal(f.instances[0].el, f.target);
  assert.equal(f.updates.length, 0);
});

test("comments load without IntersectionObserver and report stylesheet failures", async () => {
  const f = commentsFixture(false);
  assert.equal(f.scripts.length, 1);
  assert.equal(f.styles.length, 1);
  f.styles[0].onerror();
  await settle();
  assert.equal(f.target.textContent, "comments failed");
  assert.equal(f.instances.length, 0);
});

test("comments reload stylesheet removed by an Astro head swap", async () => {
  const f = commentsFixture(false);
  f.scripts[0].onload();
  f.styles[0].onload();
  await settle();
  assert.equal(f.instances.length, 1);

  await f.document.emitLifecycle("astro:before-swap");
  f.styles[0].isConnected = false;
  f.setTarget(new Element());
  await f.document.emitLifecycle("astro:page-load");
  assert.equal(f.styles.length, 2);
  assert.equal(f.scripts.length, 1);
  f.styles[1].onload();
  await settle();
  assert.equal(f.instances.length, 2);
});
