import "./layout-interactions";

type SiteSearchModule = typeof import("./site-search");
let searchModulePromise: Promise<SiteSearchModule> | undefined;
let searchUiPromise: Promise<void> | undefined;
let searchPreloadScheduled = false;
let pageController: AbortController | undefined;
const searchShortcutOwner = {};

function setSearchCloseHint(active: boolean, description = "") {
  const instance = window.PagefindComponents?.getInstanceManager().getInstance("murmur-search");
  if (!instance) return;
  if (active) instance.registerShortcut({ label: "esc", description }, searchShortcutOwner);
  else instance.deregisterAllShortcuts(searchShortcutOwner);
}

function cleanupSiteHeaderBeforeSwap() {
  const searchDialog = document.querySelector<HTMLDialogElement>("[data-search-modal]");
  if (searchDialog?.open) searchDialog.close();
  document.querySelector<HTMLButtonElement>("[data-search-open]")?.setAttribute("aria-expanded", "false");
  document.querySelector<HTMLElement>(".site-header")?.removeAttribute("data-scroll-hidden");
  setSearchCloseHint(false);

  const mobileNav = document.querySelector<HTMLElement>("#site-nav-mobile-panel");
  if (typeof mobileNav?.hidePopover === "function" && mobileNav.matches(":popover-open")) {
    mobileNav.hidePopover();
  }

  pageController?.abort();
  pageController = undefined;
}

const loadSearch = () => {
  searchModulePromise ??= import("./site-search").catch((error: unknown) => {
    searchModulePromise = undefined;
    throw error;
  });
  return searchModulePromise;
};

const preloadSearch = (trigger: HTMLElement) => {
  searchUiPromise ??= loadSearch()
    .then(({ loadPagefindComponents }) => loadPagefindComponents(trigger))
    .catch((error: unknown) => {
      searchUiPromise = undefined;
      throw error;
    });
  return searchUiPromise;
};

function scheduleSearchPreload(trigger: HTMLElement) {
  if (searchPreloadScheduled || searchUiPromise) return;
  searchPreloadScheduled = true;

  const start = () => {
    searchPreloadScheduled = false;
    if (!trigger.isConnected) return;
    void preloadSearch(trigger).catch(() => {});
  };

  const requestIdleCallback = (window as unknown as {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  }).requestIdleCallback;
  if (requestIdleCallback) requestIdleCallback.call(window, start, { timeout: 1000 });
  else window.setTimeout(start, 1);
}

function initializeSiteHeader() {
  pageController?.abort();
  pageController = new AbortController();
  const { signal } = pageController;
  const root = document.documentElement;
  const header = document.querySelector<HTMLElement>(".site-header");
  const colorScheme = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  const toggle = document.querySelector<HTMLButtonElement>("[data-theme-toggle]");
  const mobileNav = document.querySelector<HTMLElement>("#site-nav-mobile-panel");
  const searchTrigger = document.querySelector<HTMLButtonElement>("[data-search-open]");
  const searchDialog = document.querySelector<HTMLDialogElement>("[data-search-modal]");
  let revealHeader = () => {};

  const closeMobileNav = () => {
    if (typeof mobileNav?.hidePopover === "function" && mobileNav.matches(":popover-open")) mobileNav.hidePopover();
  };
  const mobileViewport = window.matchMedia("(max-width: 36rem)");
  mobileViewport.addEventListener("change", closeMobileNav, { signal });

  mobileNav?.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest(".site-nav-link")) closeMobileNav();
  }, { signal });

  const openSearch = () => {
    if (!searchTrigger || !searchDialog) return;
    void preloadSearch(searchTrigger).then(() => {
      if (signal.aborted || !searchTrigger.isConnected) return;
      searchTrigger.removeAttribute("title");
      if (!searchDialog.open) {
        const description = searchDialog.querySelector<HTMLButtonElement>("[data-search-close]")?.getAttribute("aria-label") ?? "";
        setSearchCloseHint(true, description);
        searchDialog.showModal();
      }
      searchTrigger.setAttribute("aria-expanded", "true");
      searchDialog.querySelector<HTMLElement>("pagefind-input input")?.focus({ preventScroll: true });
    }).catch(() => {
      if (signal.aborted || !searchTrigger.isConnected) return;
      const message = searchTrigger.dataset.pagefindFailed ?? "";
      searchTrigger.setAttribute("title", message);
    });
  };

  searchTrigger?.addEventListener("click", (event) => {
    event.preventDefault();
    closeMobileNav();
    openSearch();
  }, { signal });

  document.addEventListener("keydown", (event) => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== "k") return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && (active.isContentEditable || active.matches("input, textarea, select"))) return;
    event.preventDefault();
    openSearch();
  }, { signal });

  searchDialog?.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.target === searchDialog || event.target.closest("[data-search-close], .pf-result-link, .pf-heading-link")) {
      searchDialog?.close();
    }
  }, { signal });

  searchDialog?.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    searchDialog.close();
  }, { capture: true, signal });
  searchDialog?.addEventListener("close", () => {
    if (searchDialog.open) return;
    searchTrigger?.setAttribute("aria-expanded", "false");
    setSearchCloseHint(false);
    revealHeader();
  }, { signal });

  if (header) {
    let wasScrolled = false;
    const scrollPosition = () => Math.max(0, Math.min(window.scrollY,
      root.scrollHeight - window.innerHeight));
    let previousY = scrollPosition();
    revealHeader = () => {
      previousY = scrollPosition();
      header.removeAttribute("data-scroll-hidden");
    };
    const updateScrollState = () => {
      const currentY = scrollPosition();
      const isScrolled = currentY > 0;
      if (isScrolled !== wasScrolled) {
        wasScrolled = isScrolled;
        header.toggleAttribute("data-scrolled", isScrolled);
      }

      if (!mobileViewport.matches || searchDialog?.open
        || (typeof mobileNav?.hidePopover === "function" && mobileNav.matches(":popover-open"))
        || currentY <= header.offsetHeight) {
        revealHeader();
        return;
      }
      // Ignore small scroll movements; clamp overscroll so bouncing cannot reverse direction.
      if (Math.abs(currentY - previousY) < 8) return;
      header.toggleAttribute("data-scroll-hidden", currentY > previousY);
      previousY = currentY;
    };

    // Restored scroll positions should start with a visible header.
    header.toggleAttribute("data-scrolled", previousY > 0);
    wasScrolled = previousY > 0;
    window.addEventListener("scroll", updateScrollState, { passive: true, signal });
    window.addEventListener("resize", revealHeader, { signal });
    mobileViewport.addEventListener("change", revealHeader, { signal });
    mobileNav?.addEventListener("toggle", revealHeader, { signal });
    header.addEventListener("focusin", revealHeader, { signal });
  }
  if (toggle) {
    const storageKey = "murmur-theme";
    type ThemePreference = "system" | "light" | "dark";
    const getPreference = (): ThemePreference => {
      const theme = root.dataset.theme;
      return theme === "light" || theme === "dark" ? theme : "system";
    };
    const updateButton = () => {
      const preference = getPreference();
      const labels: Record<ThemePreference, string> = {
        system: toggle.dataset.themeSystem ?? "",
        light: toggle.dataset.themeLight ?? "",
        dark: toggle.dataset.themeDark ?? "",
      };
      toggle.setAttribute("aria-pressed", preference === "system" ? "mixed" : String(preference === "dark"));
      const label = (toggle.dataset.themeCurrent ?? "{theme}").replace("{theme}", labels[preference]);
      toggle.setAttribute("aria-label", label);
      toggle.title = label;
    };

    updateButton();
    toggle.addEventListener("click", () => {
      const preference = getPreference();
      const nextPreference: ThemePreference = preference === "system"
        ? "light"
        : preference === "light" ? "dark" : "system";
      if (nextPreference === "system") {
        delete root.dataset.theme;
        colorScheme?.setAttribute("content", "light dark");
      } else {
        root.dataset.theme = nextPreference;
        colorScheme?.setAttribute("content", nextPreference);
      }
      try {
        if (nextPreference === "system") localStorage.removeItem(storageKey);
        else localStorage.setItem(storageKey, nextPreference);
      } catch {
        // Keep the selection for this page even if storage is unavailable.
      }
      updateButton();
    }, { signal });
  }

  if (searchTrigger) scheduleSearchPreload(searchTrigger);
}

document.addEventListener("astro:before-swap", cleanupSiteHeaderBeforeSwap);
document.addEventListener("astro:page-load", initializeSiteHeader);
