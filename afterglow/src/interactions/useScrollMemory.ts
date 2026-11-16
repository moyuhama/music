import { useLayoutEffect, useRef } from "react";
import { ScrollMemory } from "./scrollMemory";
export function useScrollMemory(key: string, visible: boolean) {
  const container = useRef<HTMLDivElement>(null);
  const positions = useRef(new ScrollMemory());
  const currentKey = useRef(key);
  useLayoutEffect(() => {
    currentKey.current = key;
    if (visible && container.current)
      container.current.scrollTop = positions.current.read(key);
  }, [key, visible]);
  return {
    ref: container,
    onScroll: () => {
      if (container.current)
        positions.current.save(currentKey.current, container.current.scrollTop);
    },
  };
}
