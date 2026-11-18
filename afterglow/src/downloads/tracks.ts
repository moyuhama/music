import type { Track } from "../domain/types";
import { providers, registeredFile } from "../sources";
import type { DownloadItem } from "./files";
export function trackDownload(track: Track): DownloadItem {
  return { id:track.id, title:track.title, async resolve(signal) {
    const source=await providers[track.source.kind].resolve(track,signal);
    return {...source,file:track.source.kind === "local" ? registeredFile(track.source.fileKey) : undefined,fileName:track.source.kind === "local" ? track.source.fileName : undefined,lyricText:track.lyricText,lyrics:track.lyrics};
  } };
}
