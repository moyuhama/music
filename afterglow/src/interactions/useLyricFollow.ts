import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import type { LyricLine } from "../domain/types";
export function useLyricFollow(
  trackId: string | undefined,
  lines: LyricLine[] | undefined,
  index: number,
  seekVersion: number,
  active: boolean,
  focusRatio = .5,
) {
  const scroller = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [following, setFollowing] = useState(true);
  const [alignment, realign] = useReducer((n) => n + 1, 0);
  const instant = useRef(true);
  const resume = useCallback(() => {
    instant.current = true;
    setFollowing(true);
    realign();
  }, []);
  const browse = useCallback(() => setFollowing(false), []);
  useEffect(resume, [trackId, lines, seekVersion, resume]);
  const align = useCallback(
    (immediate = false) => {
      const container = scroller.current;
      const line = lineRefs.current[index];
      if (!active || !following || !container || !line) return;
      container.scrollTo({
        top:
          line.offsetTop - container.clientHeight * focusRatio + line.clientHeight / 2,
        behavior:
          immediate ||
          instant.current ||
          matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
      });
      instant.current = false;
    },
    [index, active, following, focusRatio],
  );
  useLayoutEffect(() => align(), [align, alignment]);
  useEffect(() => {
    const container = scroller.current;
    if (!container) return;
    const observer = new ResizeObserver(() => align(true));
    observer.observe(container);
    return () => observer.disconnect();
  }, [align, lines]);
  return {
    scroller,
    lineRefs,
    browsing: !following,
    browse,
    resume,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (
        ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(
          e.key,
        )
      )
        browse();
    },
  };
}
