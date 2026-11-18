import type { Track } from "../domain/types";
const files = new Map<string, File>();
export function registerFile(id: string, file: File) {
  files.set(id, file);
}
export function registeredFile(key: string) { return files.get(key); }
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
    if(track.origin?.kind==='resource'){
      const origin=track.origin;
      const {loadPackages}=await import('../resources/repository.ts');
      const packages=await loadPackages();signal.throwIfAborted();
      const pkg=packages.find(item=>item.id===origin.packageId&&item.sources.some(source=>source.id===origin.sourceId));
      if(!pkg)throw new Error('该歌曲的音源已移除，请重新导入对应资源包');
      if(!origin.resolvedAt||Date.now()-origin.resolvedAt>30000){
        const {runResource}=await import('../resources/client.ts');const {resourceMediaUrl}=await import('../resources/media.ts');
        const result=await runResource<string|{url:string;headers?:Record<string,string>}>(pkg,'audio',origin.sourceId,[origin.itemUrl],signal);
        const audio=typeof result==='string'?{url:result}:result;
        return{url:resourceMediaUrl(audio.url,audio.headers),release(){}};
      }
    }
    return { url: validateUrl(track.source.url), release() {} };
  },
};
export const providers = { local, remote };
