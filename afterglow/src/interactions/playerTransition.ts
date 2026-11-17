import { flushSync } from "react-dom";

let cancelActive: (() => void) | undefined;
let generation = 0;

/** Animate the same cover between the persistent mini player and listening page. */
export function transitionPlayer(expanded: boolean, update: () => void) {
  cancelActive?.();
  const id = ++generation;
  const source = document.querySelector<HTMLElement>(
    `[data-player-cover="${expanded ? "mini" : "full"}"]`,
  );
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const from = source?.getBoundingClientRect();
  if (reduced || document.hidden || !source || !from?.width || !from.height) {
    flushSync(update);
    return;
  }
  const root = document.documentElement;
  root.dataset.coverMotion = "";
  const marked: HTMLElement[] = [];
  const clear = () => {
    if (generation !== id) return;
    marked.forEach((el) => el.style.removeProperty("view-transition-name"));
    if (generation === id) {
      delete root.dataset.coverMotion;
      cancelActive = undefined;
    }
  };
  if (document.startViewTransition) {
    source.style.viewTransitionName = "listening-cover";
    marked.push(source);
    let updated = false;
    const apply = () => {
      if (updated || generation !== id) return;
      updated = true;
      source.style.removeProperty("view-transition-name");
      flushSync(update);
      const target = document.querySelector<HTMLElement>(
        `[data-player-cover="${expanded ? "full" : "mini"}"]`,
      );
      if (target) {
        target.style.viewTransitionName = "listening-cover";
        marked.push(target);
      }
    };
    try {
      const transition = document.startViewTransition(apply);
      cancelActive = () => {
        transition.skipTransition();
        clear();
      };
      void transition.ready.catch(() => {
        if (generation === id) apply();
      });
      void transition.finished.finally(clear).catch(() => {});
      return;
    } catch {
      clear();
    }
  }
  // Older browsers still get a real moving cover instead of an abrupt replacement.
  root.dataset.coverMotion = "";
  const ghost = source.cloneNode(true) as HTMLElement;
  ghost.removeAttribute("data-player-cover");
  ghost.setAttribute("aria-hidden", "true");
  ghost.inert = true;
  Object.assign(ghost.style, {
    position: "fixed",
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
    margin: "0",
    zIndex: "1000",
    pointerEvents: "none",
    borderRadius: getComputedStyle(source).borderRadius,
    viewTransitionName: "none",
  });
  flushSync(update);
  const target = document.querySelector<HTMLElement>(
    `[data-player-cover="${expanded ? "full" : "mini"}"]`,
  );
  const to = target?.getBoundingClientRect();
  if (!target || !to?.width || !to.height || !ghost.animate) {
    clear();
    return;
  }
  document.body.append(ghost);
  const oldVisibility = target.style.visibility;
  target.style.visibility = "hidden";
  const pageAnimation = target
    .closest<HTMLElement>(".page-layer")
    ?.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 240,
      easing: "ease-out",
    });
  void pageAnimation?.finished.catch(() => {});
  const animation = ghost.animate(
    [
      {
        left: `${from.left}px`,
        top: `${from.top}px`,
        width: `${from.width}px`,
        height: `${from.height}px`,
      },
      {
        left: `${to.left}px`,
        top: `${to.top}px`,
        width: `${to.width}px`,
        height: `${to.height}px`,
        borderRadius: getComputedStyle(target).borderRadius,
      },
    ],
    { duration: 320, easing: "cubic-bezier(.22,.7,.2,1)", fill: "both" },
  );
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    animation.cancel();
    pageAnimation?.cancel();
    ghost.remove();
    target.style.visibility = oldVisibility;
    clear();
  };
  cancelActive = cleanup;
  void animation.finished.then(cleanup, cleanup);
}

export function cancelPlayerTransition() {
  cancelActive?.();
  ++generation;
}
