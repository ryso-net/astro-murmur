const svgNamespace = "http://www.w3.org/2000/svg";
let cleanupCurrentPage: (() => void) | undefined;

const createIcon = (copied: boolean) => {
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");

  if (copied) {
    const check = document.createElementNS(svgNamespace, "path");
    check.setAttribute("d", "m5 12 4 4L19 6");
    svg.append(check);
  } else {
    const back = document.createElementNS(svgNamespace, "path");
    back.setAttribute("d", "M8 8V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-3");
    const front = document.createElementNS(svgNamespace, "rect");
    front.setAttribute("x", "4");
    front.setAttribute("y", "8");
    front.setAttribute("width", "11");
    front.setAttribute("height", "13");
    front.setAttribute("rx", "2");
    svg.append(back, front);
  }

  return svg;
};

function initializeCodeCopy() {
  cleanupCurrentPage?.();
  const timers = new Set<number>();
  cleanupCurrentPage = () => {
    for (const timer of timers) window.clearTimeout(timer);
    timers.clear();
  };

  if (navigator.clipboard?.writeText) {
    const codeBlocks = document.querySelectorAll<HTMLPreElement>(".prose pre.astro-code[data-language]");
    for (const block of codeBlocks) {
      const code = block.querySelector("code");
      const prose = block.closest<HTMLElement>(".prose");
      const copyLabel = prose?.dataset.copyCode;
      const copiedLabel = prose?.dataset.codeCopied;
      const failedLabel = prose?.dataset.copyFailed;
      if (!code || !copyLabel || !copiedLabel || !failedLabel) continue;

      const button = document.createElement("button");
      button.className = "code-copy-button";
      button.type = "button";
      button.setAttribute("aria-label", copyLabel);
      button.append(createIcon(false));
      const status = document.createElement("span");
      status.className = "copy-status";
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      status.setAttribute("aria-atomic", "true");
      status.setAttribute("data-pagefind-ignore", "");

      let resetTimer = 0;
      button.addEventListener("click", async () => {
        window.clearTimeout(resetTimer);
        timers.delete(resetTimer);
        status.textContent = "";
        status.removeAttribute("data-failed");
        button.disabled = true;
        try {
          await navigator.clipboard.writeText(code.textContent ?? "");
          if (!block.isConnected) return;
          button.setAttribute("aria-label", copiedLabel);
          button.replaceChildren(createIcon(true));
          status.textContent = copiedLabel;
        } catch {
          if (!block.isConnected) return;
          button.setAttribute("aria-label", copyLabel);
          button.replaceChildren(createIcon(false));
          status.textContent = failedLabel;
          status.setAttribute("data-failed", "");
        } finally {
          button.disabled = false;
          if (!block.isConnected) return;
          resetTimer = window.setTimeout(() => {
            timers.delete(resetTimer);
            button.setAttribute("aria-label", copyLabel);
            button.replaceChildren(createIcon(false));
            status.textContent = "";
            status.removeAttribute("data-failed");
          }, status.hasAttribute("data-failed") ? 4000 : 2000);
          timers.add(resetTimer);
        }
      });

      const wrapper = document.createElement("div");
      wrapper.className = "code-block";
      block.before(wrapper);
      wrapper.append(block, button, status);
    }
  }
}

document.addEventListener("astro:before-swap", () => {
  cleanupCurrentPage?.();
  cleanupCurrentPage = undefined;
});
document.addEventListener("astro:page-load", initializeCodeCopy);
