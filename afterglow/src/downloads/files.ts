import {audioExtension} from "./format.mjs";
export {safeName,audioExtension} from "./format.mjs";
import {resourceMediaUrl} from "../resources/media.ts";
import { Zip, ZipPassThrough, strToU8 } from "fflate";
import type { LyricLine } from "../domain/types";
export interface DownloadAsset { url: string; file?: Blob; fileName?: string; headers?: Record<string,string>; release?(): void; lyricText?: string; lyrics?: LyricLine[]; subtitles?: { text: string; format: "lrc" | "srt" | "vtt" | "txt" }[] }
export interface DownloadItem { id: string; title: string; resolve(signal: AbortSignal): Promise<DownloadAsset> }
export function lrcText(lines: LyricLine[]) {
  return lines.filter((line) => Number.isFinite(line.time) && line.time >= 0).map((line) => {
    const cs = Math.round(line.time * 100);
    return `[${String(Math.floor(cs / 6000)).padStart(2, "0")}:${String(Math.floor(cs / 100) % 60).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}]${line.text}`;
  }).join("\n");
}
export function sidecars(asset: DownloadAsset) {
  const result = (Array.isArray(asset.subtitles) ? asset.subtitles : []).filter((item) => item && typeof item.text === "string" && item.text.trim() && ["lrc", "srt", "vtt", "txt"].includes(item.format));
  const lyrics = (typeof asset.lyricText === "string" ? asset.lyricText.trim() : "") || (Array.isArray(asset.lyrics) && asset.lyrics.length ? lrcText(asset.lyrics) : "");
  if (lyrics && !result.some((item) => item.text === lyrics)) result.unshift({ text: lyrics, format: /\[\d+:\d+/.test(lyrics) ? "lrc" : "txt" });
  return result;
}
export function downloadUrl(url: string, headers: Record<string,string> = {}) {
  const target = new URL(url,location.href);
  if(target.origin === location.origin && target.pathname === "/__afterglow/audio") {target.searchParams.set("mode","download");return target.href;}
  if(target.protocol === "blob:" || target.origin === location.origin)return target.href;
  return resourceMediaUrl(target.href,headers,"download");
}
export async function readAudio(asset: DownloadAsset, signal: AbortSignal) {
  const response = await fetch(downloadUrl(asset.url,asset.headers), { signal: AbortSignal.any([signal, AbortSignal.timeout(90000)]), credentials: "omit" });
  if (!response.ok) throw new Error(`下载失败（HTTP ${response.status}）`);
  const mime = response.headers.get("Content-Type") || "";
  if (/text\/|json|mpegurl/i.test(mime)) throw new Error("该地址返回网页、播放清单或错误信息，无法保存为音频");
  const limit = 100 * 1024 * 1024;
  const reader = response.body?.getReader();
  if (!reader) throw new Error("无法读取音频");
  const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const {value,done} = await reader.read(); if (done) break; size += value.byteLength; if (size > limit) throw new Error("单个文件超过 100 MB 下载上限"); chunks.push(value); } }
  catch (error) { await reader.cancel().catch(() => {}); throw error; }
  if (!size) throw new Error("音频文件为空");
  return { blob: new Blob(chunks as BlobPart[], {type:mime}), extension: audioExtension(asset.fileName || asset.url, mime), size };
}
export function saveBlob(blob: Blob, name: string) {
  const href = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = href; link.download = name; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 60000);
}
// Audio is already compressed. Store ZIP entries without recompression.
export class DownloadZip {
  private chunks: Uint8Array[] = [];
  private zip: Zip;
  constructor() { this.zip = new Zip((error, data) => { if (error) throw error; this.chunks.push(data); }); }
  add(name: string, data: Uint8Array) { const file = new ZipPassThrough(name); this.zip.add(file); file.push(data, true); }
  text(name: string, text: string) { this.add(name, strToU8(text)); }
  finish() { this.zip.end(); const blob = new Blob(this.chunks as BlobPart[], {type:"application/zip"}); this.chunks = []; return blob; }
  cancel() { this.zip.terminate(); this.chunks = []; }
}
