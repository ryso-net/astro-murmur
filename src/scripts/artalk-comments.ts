export {};

interface ArtalkInstance {
  destroy(): void;
  setDarkMode(darkMode: boolean): void;
}

interface ArtalkClient {
  init(options: Record<string, unknown>): ArtalkInstance;
}

declare global {
  interface Window {
    Artalk?: ArtalkClient;
  }
}

const clientScripts = new Map<string, Promise<ArtalkClient>>();
const stylesheets = new Map<string, { link: HTMLLinkElement; promise: Promise<void> }>();
let cleanupCurrentPage: (() => void) | undefined;

function getAssetUrl(server: string, filename: string) {
  const baseUrl = `${server.replace(/\/+$/, "")}/`;
  return new URL(`dist/${filename}`, baseUrl).href;
}

function loadClient(server: string) {
  const src = getAssetUrl(server, "Artalk.js");
  const cached = clientScripts.get(src);
  if (cached) return cached;

  const script = document.createElement("script");
  script.src = src;
  script.async = true;

  const request = new Promise<ArtalkClient>((resolve, reject) => {
    script.onload = () => {
      if (window.Artalk) resolve(window.Artalk);
      else reject(new Error("Artalk client did not expose its API"));
    };
    script.onerror = () => reject(new Error("Artalk client failed to load"));
  }).catch((error: unknown) => {
    script.remove();
    clientScripts.delete(src);
    throw error;
  });

  clientScripts.set(src, request);
  document.head.append(script);
  return request;
}

function loadStylesheet(server: string) {
  const href = getAssetUrl(server, "Artalk.css");
  const cached = stylesheets.get(href);
  if (cached?.link.isConnected) return cached.promise;
  if (cached) stylesheets.delete(href);

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;

  const request = new Promise<void>((resolve, reject) => {
    link.onload = () => resolve();
    link.onerror = () => reject(new Error("Artalk stylesheet failed to load"));
  }).catch((error: unknown) => {
    link.remove();
    if (stylesheets.get(href)?.link === link) stylesheets.delete(href);
    throw error;
  });

  stylesheets.set(href, { link, promise: request });
  document.head.append(link);
  return request;
}

async function initializeComments(target: HTMLElement, isActive: () => boolean) {
  const options = JSON.parse(target.dataset.artalkOptions || "{}") as Record<string, unknown>;
  const server = typeof options.server === "string" ? options.server : "";
  if (!server) throw new Error("Artalk server is not configured");

  const followsSiteTheme = !Object.hasOwn(options, "darkMode");
  const systemDarkMode = followsSiteTheme && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : undefined;
  const currentDarkMode = () => {
    const theme = document.documentElement.dataset.theme;
    if (theme === "dark") return true;
    if (theme === "light") return false;
    return systemDarkMode?.matches ?? false;
  };

  const [artalk] = await Promise.all([
    loadClient(server),
    loadStylesheet(server),
  ]);
  if (!isActive() || !target.isConnected) return undefined;

  const instance = artalk.init({
    ...options,
    el: target,
    ...(followsSiteTheme ? { darkMode: currentDarkMode() } : {}),
  });

  let themeObserver: MutationObserver | undefined;
  const syncDarkMode = () => instance.setDarkMode(currentDarkMode());
  if (followsSiteTheme) {
    themeObserver = new MutationObserver(syncDarkMode);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    systemDarkMode?.addEventListener("change", syncDarkMode);
  }

  return () => {
    themeObserver?.disconnect();
    systemDarkMode?.removeEventListener("change", syncDarkMode);
    instance.destroy();
  };
}

function initializeCommentsForPage() {
  cleanupCurrentPage?.();
  cleanupCurrentPage = undefined;
  const target = document.querySelector<HTMLElement>("[data-artalk]");
  if (!target) return;

  let active = true;
  let destroyComments: (() => void) | undefined;
  let observer: IntersectionObserver | undefined;
  const cleanup = () => {
    active = false;
    observer?.disconnect();
    destroyComments?.();
  };
  cleanupCurrentPage = cleanup;

  const start = async () => {
    try {
      const destroy = await initializeComments(target, () => active);
      if (active) destroyComments = destroy;
      else destroy?.();
    } catch {
      if (active && target.isConnected) target.textContent = target.dataset.artalkFailed ?? "";
    }
  };

  if ("IntersectionObserver" in window) {
    observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer?.disconnect();
      void start();
    }, { rootMargin: "400px" });
    observer.observe(target);
  } else {
    void start();
  }
}

document.addEventListener("astro:before-swap", () => {
  cleanupCurrentPage?.();
  cleanupCurrentPage = undefined;
});
document.addEventListener("astro:page-load", initializeCommentsForPage);
