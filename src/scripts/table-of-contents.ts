export {};


let cleanupCurrentPage: (() => void) | undefined;

function initializeTableOfContents() {
  cleanupCurrentPage?.();
  const controller = new AbortController();
  const { signal } = controller;
  let resizeObserver: ResizeObserver | undefined;
  let frame = 0;
  cleanupCurrentPage = () => {
    controller.abort();
    resizeObserver?.disconnect();
    if (frame) window.cancelAnimationFrame(frame);
  };

  const tocs = [...document.querySelectorAll<HTMLElement>("[data-table-of-contents]")];
  if (tocs.length === 0) return;

  const groups = tocs.map((toc) => {
    const links = [...toc.querySelectorAll<HTMLAnchorElement>("[data-toc-link]")];
    const sections = links.flatMap((link) => {
      const id = link.getAttribute("href")?.slice(1);
      const heading = id ? document.getElementById(decodeURIComponent(id)) : null;
      return heading instanceof HTMLElement ? [{ link, heading }] : [];
    });
    return {
      toc,
      scroller: toc.querySelector<HTMLElement>(".mobile-toc-scroll") ?? toc,
      sections,
      content: toc.closest(".article")?.querySelector<HTMLElement>(".prose"),
      currentLink: undefined as HTMLAnchorElement | undefined,
    };
  });
  const updateOverflow = (scroller: HTMLElement) => {
    scroller.toggleAttribute("data-toc-overflow",
      scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop > 1);
  };

  const updateVisibleSections = () => {
    frame = 0;
    const readingLine = window.innerHeight * 0.2;
    const viewportBottom = window.innerHeight;
    for (const group of groups) {
      const { toc, sections, content, scroller } = group;
      if (toc.getClientRects().length === 0 || (toc.hasAttribute("popover") && !toc.matches(":popover-open"))) continue;
      const contentBottom = content?.getBoundingClientRect().bottom
        ?? document.documentElement.scrollHeight - window.scrollY;
      const sectionTops = sections.map(({ heading }) => heading.getBoundingClientRect().top);
      let currentIndex = -1;

      sections.forEach(({ link }, index) => {
        const sectionTop = sectionTops[index];
        const sectionBottom = sectionTops[index + 1] ?? contentBottom;
        const isVisible = sectionTop < viewportBottom && sectionBottom > 0;

        if (sectionTop <= readingLine && sectionBottom > readingLine) currentIndex = index;
        link.toggleAttribute("data-visible", isVisible);
        if (index === currentIndex) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });

      const currentLink = sections[currentIndex]?.link;
      if (currentLink && currentLink !== group.currentLink) {
        if (scroller.clientHeight > 0 && scroller.scrollHeight > scroller.clientHeight) {
          const top = scroller.getBoundingClientRect().top + scroller.clientTop;
          const linkBox = currentLink.getBoundingClientRect();
          if (linkBox.top < top || linkBox.height > scroller.clientHeight) {
            scroller.scrollTop += linkBox.top - top;
          } else if (linkBox.bottom > top + scroller.clientHeight) {
            scroller.scrollTop += linkBox.bottom - top - scroller.clientHeight;
          }
        }
      }
      group.currentLink = currentLink;
      updateOverflow(scroller);
    }
  };

  const scheduleUpdate = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(updateVisibleSections);
  };

  window.addEventListener("scroll", scheduleUpdate, { passive: true, signal });
  window.addEventListener("resize", scheduleUpdate, { signal });
  for (const { scroller } of groups) {
    scroller.addEventListener("scroll", () => updateOverflow(scroller), { passive: true, signal });
  }
  // Images and other content can change section positions without a scroll event.
  if (typeof ResizeObserver === "function") {
    resizeObserver = new ResizeObserver(scheduleUpdate);
    for (const { scroller } of groups) {
      resizeObserver.observe(scroller);
      const list = scroller.querySelector(".toc-list");
      if (list) resizeObserver.observe(list);
    }
    for (const content of new Set(groups.map((group) => group.content))) {
      if (content) resizeObserver.observe(content);
    }
  }

  const mobileToc = document.querySelector<HTMLElement>(".mobile-toc");
  const mobilePanel = mobileToc?.querySelector<HTMLElement>(".mobile-toc-panel");
  const dragHandle = mobileToc?.querySelector<HTMLElement>(".mobile-toc-handle");
  const narrowViewport = window.matchMedia("(max-width: 59.999rem)");
  const isOpen = () => typeof mobileToc?.hidePopover === "function" && mobileToc.matches(":popover-open");
  const close = () => { if (isOpen()) mobileToc?.hidePopover(); };
  // Keep the sheet painted until its native exit transitions finish.
  let exitVersion = 0;
  mobileToc?.addEventListener("beforetoggle", (event) => {
    const version = ++exitVersion;
    mobileToc.classList.remove("is-closing");
    if (event.newState !== "closed" || !narrowViewport.matches) return;
    mobileToc.classList.add("is-closing");
    requestAnimationFrame(() => {
      if (version !== exitVersion) return;
      void Promise.allSettled(mobileToc.getAnimations({ subtree: true }).map((animation) => animation.finished))
        .then(() => { if (version === exitVersion) mobileToc.classList.remove("is-closing"); });
    });
  }, { signal });

  mobileToc?.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest("[data-toc-link]")) close();
  }, { signal });

  if (mobileToc && mobilePanel && dragHandle) {
    let drag: { pointerId: number; startY: number; distance: number } | undefined;

    const cancelDrag = () => {
      const pointerId = drag?.pointerId;
      drag = undefined;
      mobileToc.removeAttribute("data-dragging");
      mobilePanel.style.removeProperty("--mobile-toc-drag-y");
      if (pointerId !== undefined && dragHandle.hasPointerCapture(pointerId)) dragHandle.releasePointerCapture(pointerId);
    };
    const finishDrag = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const shouldClose = event.type === "pointerup"
        && drag.distance > Math.max(64, mobilePanel.clientHeight * 0.18);
      cancelDrag();
      if (shouldClose) close();
    };

    dragHandle.addEventListener("pointerdown", (event) => {
      if (!event.isPrimary || event.button !== 0 || drag || !isOpen() || !narrowViewport.matches) return;
      drag = { pointerId: event.pointerId, startY: event.clientY, distance: 0 };
      mobileToc.setAttribute("data-dragging", "");
      dragHandle.setPointerCapture(event.pointerId);
    }, { signal });
    dragHandle.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.pointerId || !dragHandle.hasPointerCapture(event.pointerId)) return;
      drag.distance = Math.max(0, Math.min(mobilePanel.clientHeight, event.clientY - drag.startY));
      mobilePanel.style.setProperty("--mobile-toc-drag-y", `${drag.distance}px`);
    }, { signal });
    dragHandle.addEventListener("pointerup", finishDrag, { signal });
    dragHandle.addEventListener("pointercancel", finishDrag, { signal });
    dragHandle.addEventListener("lostpointercapture", finishDrag, { signal });
    window.addEventListener("resize", cancelDrag, { signal });
    narrowViewport.addEventListener("change", () => {
      cancelDrag();
      exitVersion++;
      mobileToc.classList.remove("is-closing");
      close();
    }, { signal });
    mobileToc.addEventListener("toggle", () => {
      const toggle = document.querySelector<HTMLElement>(".mobile-toc-toggle");
      if (isOpen()) {
        if (!narrowViewport.matches) {
          close();
          return;
        }
        const group = groups.find(({ toc }) => toc === mobileToc);
        if (group) group.currentLink = undefined;
        updateVisibleSections();
        const currentLink = mobilePanel.querySelector<HTMLElement>('[aria-current="location"]')
          ?? mobilePanel.querySelector<HTMLElement>("[data-toc-link]");
        currentLink?.focus({ preventScroll: true });
        return;
      }
      if (mobilePanel.contains(document.activeElement) && toggle?.getClientRects().length) {
        toggle.focus({ preventScroll: true });
      }
      cancelDrag();
    }, { signal });
  }

  updateVisibleSections();
}

document.addEventListener("astro:page-load", initializeTableOfContents);
document.addEventListener("astro:before-swap", () => {
  cleanupCurrentPage?.();
  cleanupCurrentPage = undefined;
});
