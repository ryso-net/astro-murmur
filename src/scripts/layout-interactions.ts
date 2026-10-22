// Distinguish layout expansion from ordinary client navigations.
export {};

type Layout = "single" | "double";
interface NavigationEvent extends Event { to: URL }

const root = document.documentElement;
const getLayout = (): Layout => root.dataset.layout === "double"
  && window.matchMedia("(min-width: 60rem)").matches
  ? "double"
  : "single";
let previousLayout: Layout | undefined;
let hasFragmentTarget = false;

document.addEventListener("astro:before-preparation", (event) => {
  previousLayout = getLayout();
  hasFragmentTarget = Boolean((event as NavigationEvent).to.hash);
});

document.addEventListener("astro:after-swap", () => {
  const nextLayout = getLayout();
  delete root.dataset.layoutTransition;
  delete root.dataset.pageEnter;

  if (!hasFragmentTarget && previousLayout === "single" && nextLayout === "double") {
    root.dataset.layoutTransition = "single-to-double";
  } else {
    root.dataset.pageEnter = nextLayout;
  }
  previousLayout = undefined;
  hasFragmentTarget = false;
});
