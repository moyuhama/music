import { flushSync } from "react-dom";

let cancelActive: (() => void) | undefined;
let generation = 0;

/** Lift the listening surface from the footer; dismiss it along the same path. */
export function transitionPlayer(expanded: boolean, update: () => void) {
  cancelActive?.();
  const id = ++generation;
  const root = document.documentElement;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || document.hidden || !document.startViewTransition) {
    // CSS provides the same vertical movement on browsers without View Transitions.
    flushSync(update);
    return;
  }

  root.dataset.playerMotion = expanded ? "expand" : "collapse";
  let updated = false;
  const apply = () => {
    if (updated) return;
    updated = true;
    flushSync(update);
  };
  const clear = () => {
    if (generation !== id) return;
    delete root.dataset.playerMotion;
    cancelActive = undefined;
  };
  try {
    const transition = document.startViewTransition(apply);
    cancelActive = () => {
      // A second click must start from the committed view, even before capture ends.
      apply();
      transition.skipTransition();
      clear();
    };
    void transition.ready.catch(apply);
    void transition.finished.then(clear, clear);
  } catch {
    apply();
    clear();
  }
}

export function cancelPlayerTransition() {
  cancelActive?.();
  ++generation;
}
