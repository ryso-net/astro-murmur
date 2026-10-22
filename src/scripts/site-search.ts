interface PagefindShortcut {
  label: string;
  description: string;
}

interface PagefindComponentInstance {
  registerShortcut(shortcut: PagefindShortcut, owner: object): void;
  deregisterAllShortcuts(owner: object): void;
}

interface PagefindComponentManager {
  getInstance(name?: string): PagefindComponentInstance;
}

interface PagefindComponentApi {
  getInstanceManager(): PagefindComponentManager;
}

declare global {
  interface Window {
    PagefindComponents?: PagefindComponentApi;
  }
}

let componentUiPromise: Promise<void> | undefined;
let componentCssPromise: Promise<void> | undefined;

function loadComponentCss(path: string) {
  const existingLink = document.querySelector<HTMLLinkElement>("link[data-pagefind-component-ui]");
  if (existingLink) return componentCssPromise ?? Promise.resolve();

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = path;
  link.dataset.pagefindComponentUi = "loading";
  componentCssPromise = new Promise<void>((resolve, reject) => {
    link.addEventListener("load", () => {
      link.dataset.pagefindComponentUi = "ready";
      resolve();
    }, { once: true });
    link.addEventListener("error", () => reject(new Error("Pagefind component styles failed to load.")), { once: true });
  }).catch((error: unknown) => {
    link.remove();
    componentCssPromise = undefined;
    throw error;
  });
  document.head.append(link);
  return componentCssPromise;
}

export async function loadPagefindComponents(trigger: HTMLElement) {
  const scriptPath = trigger.dataset.pagefindComponentPath;
  const cssPath = trigger.dataset.pagefindComponentCss;
  if (!scriptPath || !cssPath) throw new Error("Pagefind component asset paths are missing.");

  const cssPromise = loadComponentCss(cssPath);
  componentUiPromise ??= cssPromise.then(async () => {
    await import(/* @vite-ignore */ scriptPath);
    const components = window.PagefindComponents;
    if (!components) throw new Error("Pagefind components did not initialize.");
    components.getInstanceManager().getInstance("murmur-search");
  }).catch((error: unknown) => {
    componentUiPromise = undefined;
    throw error;
  });

  await Promise.all([cssPromise, componentUiPromise]);
}
