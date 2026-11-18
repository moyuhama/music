export type SourceRef =
  | {
      kind: "local";
      fileKey: string;
      fileName?: string;
      size?: number;
      modified?: number;
    }
  | { kind: "remote"; url: string };
export interface LyricLine {
  time: number;
  text: string;
}
export type TrackOrigin = {kind:"bundled";path:string;hosted?:boolean} | {kind:"resource";packageId:string;sourceId:string;itemUrl:string;resolvedAt?:number};
export interface Track {
  origin?: TrackOrigin;
  subtitles?: {text:string;format:"lrc"|"srt"|"vtt"|"txt"}[];
  attribution?: { sourceUrl: string; license: string; licenseUrl: string };
  id: string;
  title: string;
  artist: string;
  album?: string;
  cover?: string;
  duration?: number;
  source: SourceRef;
  addedAt: number;
  lastPlayed?: number;
  favorite: boolean;
  persist: boolean;
  lyrics?: LyricLine[];
  lyricText?: string;
}
export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
}
export type PlayMode = "sequence" | "repeat-one" | "shuffle";
export type View =
  | "settings"
  | "discovery"
  | "modes"
  | "favorites"
  | "local"
  | "remote"
  | "recent"
  | `playlist:${string}`;
export function nextId(
  ids: string[],
  current: string | null,
  mode: PlayMode,
  ended = false,
  random = Math.random,
): string | null {
  if (!ids.length) return null;
  if (ended && mode === "repeat-one" && current && ids.includes(current))
    return current;
  if (mode === "shuffle" && ids.length > 1) {
    const rest = ids.filter((id) => id !== current);
    return rest[Math.floor(random() * rest.length)];
  }
  const i = current ? ids.indexOf(current) : -1;
  if (ended && mode === "sequence" && i === ids.length - 1) return null;
  return ids[(i + 1) % ids.length];
}
export function formatTime(s: number) {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  return `${Math.floor(s / 60)}:${Math.floor(s % 60)
    .toString()
    .padStart(2, "0")}`;
}
export function insertNext(ids: string[], current: string | null, id: string) {
  if (id === current) return ids;
  const rest = ids.filter((v) => v !== id);
  const index = current ? rest.indexOf(current) : -1;
  return [...rest.slice(0, index + 1), id, ...rest.slice(index + 1)];
}
