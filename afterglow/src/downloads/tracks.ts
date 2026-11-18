import type { Track } from "../domain/types";
import { providers } from "../sources";
import type { DownloadItem } from "./files";
export function trackDownload(track: Track): DownloadItem {
  return { id:track.id, title:track.title, async resolve(signal) {
    const source=await providers[track.source.kind].resolve(track,signal);
    return {...source,fileName:track.source.kind === "local" ? track.source.fileName : undefined,lyricText:track.lyricText,lyrics:track.lyrics};
  } };
}
