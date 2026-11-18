import { useEffect, useState } from "react";

interface Palette { top: string; bottom: string; panel: string; bar: string }
const fallback: Palette = { top: "#53575d", bottom: "#34373c", panel: "#2d3035", bar: "#34373c" };
const cache = new Map<string, Palette>();
export function useCoverPalette(src?: string) {
  const [result, setResult] = useState<{ src?: string; palette: Palette }>({ palette: fallback });
  useEffect(() => {
    if (!src) { setResult({ palette: fallback }); return; }
    const saved = cache.get(src);
    if (saved) { setResult({ src, palette: saved }); return; }
    let live = true;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 24;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return;
        context.drawImage(image, 0, 0, 24, 24);
        const pixels = context.getImageData(0, 0, 24, 24).data;
        let red = 0, green = 0, blue = 0, count = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i + 3] < 128) continue;
          red += pixels[i]; green += pixels[i + 1]; blue += pixels[i + 2]; count++;
        }
        if (!count) return;
        const rgb = [red / count, green / count, blue / count];
        const luminance = rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
        const scale = Math.min(.9, 128 / Math.max(1, luminance));
        const color = (factor: number) => `rgb(${rgb.map((v) => Math.round(v * scale * factor)).join(" ")})`;
        const palette = { top: color(1), bottom: color(.68), panel: color(.58), bar: color(.68) };
        if (cache.size >= 30) cache.delete(cache.keys().next().value!);
        cache.set(src, palette);
        if (live) setResult({ src, palette });
      } catch { if (live) setResult({ src, palette: fallback }); }
    };
    image.onerror = () => { if (live) setResult({ src, palette: fallback }); };
    image.src = src;
    return () => { live = false; image.onload = image.onerror = null; };
  }, [src]);
  return (src && cache.get(src)) || result.palette;
}
