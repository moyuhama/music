import type { Track } from "../domain/types";
const files = new Map<string, File>();
export function registerFile(id: string, file: File) {
  files.set(id, file);
}
export function forgetFile(id: string) {
  files.delete(id);
}
export function available(track: Track) {
  return track.source.kind === "remote" || files.has(track.source.fileKey);
}
export function validateUrl(value: string) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("请输入 HTTP 或 HTTPS 音频直链");
  return url.href;
}
export interface SourceProvider {
  resolve(
    track: Track,
    signal: AbortSignal,
  ): Promise<{ url: string; release(): void }>;
}
const local: SourceProvider = {
  async resolve(track, signal) {
    signal.throwIfAborted();
    if (track.source.kind !== "local") throw new Error("音源类型不匹配");
    const file = files.get(track.source.fileKey);
    if (!file) throw new Error("请重新导入此本地文件");
    const url = URL.createObjectURL(file);
    return { url, release: () => URL.revokeObjectURL(url) };
  },
};
const remote: SourceProvider = {
  async resolve(track, signal) {
    signal.throwIfAborted();
    if (track.source.kind !== "remote") throw new Error("音源类型不匹配");
    return { url: validateUrl(track.source.url), release() {} };
  },
};
export const providers = { local, remote };
