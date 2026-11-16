import type { LyricLine } from "./types";
export function parseLrc(text: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const offset = Number(text.match(/\[offset:([+-]?\d+)\]/i)?.[1] || 0) / 1000;
  for (const raw of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const tags = [...raw.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    const content = raw.replace(/\[[^\]]*\]/g, "").trim();
    for (const match of tags) {
      const seconds = Number(match[2]);
      if (seconds >= 60) continue;
      const time =
        Number(match[1]) * 60 + seconds + Number(`0.${match[3] || 0}`) + offset;
      lines.push({ time: Math.max(0, time), text: content || "♪" });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}
export function activeLine(lines: LyricLine[], time: number) {
  let index = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= time) index = i;
    else break;
  }
  return index;
}
