import {loadResourceLyrics} from "../resources/lyrics";
import type { Track } from "../domain/types";
import { providers, registeredFile } from "../sources";
import type { DownloadItem } from "./files";
export function trackDownload(track: Track): DownloadItem {
  return { id:track.id, title:track.title, async resolve(signal) {
    const [source,lyrics]=await Promise.all([providers[track.source.kind].resolve(track,signal),track.lyricText?Promise.resolve(null):loadResourceLyrics(track,signal)]);
    return {...source,file:track.source.kind === "local" ? registeredFile(track.source.fileKey) : undefined,fileName:track.source.kind === "local" ? track.source.fileName : undefined,bundledPath:track.origin?.kind === "bundled" && !track.origin.hosted ? track.origin.path : undefined,lyricText:track.lyricText||lyrics?.lyricText,lyrics:track.lyrics||lyrics?.lyrics,subtitles:track.subtitles};
  } };
}
