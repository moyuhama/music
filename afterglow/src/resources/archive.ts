import { unzipSync } from "fflate";
import type { ResourcePackage } from "./types";

function safePath(path: string) {
  return !!path && !path.startsWith("/") && !/[\\:\x00]/.test(path) &&
    !path.split("/").some((part) => part === ".." || part === ".");
}
export function readResourceZip(bytes: Uint8Array): ResourcePackage {
  if (bytes.length > 10 * 1024 * 1024) throw new Error("ZIP 文件不能超过 10 MB");
  let total = 0, count = 0;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, { filter(entry) {
      if (!safePath(entry.name)) throw new Error("ZIP 中包含无效文件路径");
      total += entry.originalSize;
      if (++count > 256 || total > 4 * 1024 * 1024) throw new Error("资源包解压后过大");
      return !entry.name.endsWith("/") && /(?:\.js|manifest\.json)$/i.test(entry.name);
    } });
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "无法读取 ZIP 文件");
  }
  const manifests = Object.keys(files).filter((name) => /(^|\/)manifest\.json$/.test(name));
  if (manifests.length !== 1) throw new Error("资源包中需要且只能有一个 manifest.json");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const manifest = JSON.parse(decoder.decode(files[manifests[0]]));
  if (!manifest || typeof manifest.name !== "string" || !manifest.name.trim() ||
      manifest.name.length > 120 || typeof manifest.version !== "string" || !manifest.version.trim() || manifest.version.length > 80 ||
      !Array.isArray(manifest.scripts) || !manifest.scripts.length || manifest.scripts.length > 64) {
    throw new Error("资源包清单缺少名称、版本或脚本列表");
  }
  const prefix = manifests[0].slice(0, -"manifest.json".length);
  const seen = new Set<string>();
  const scripts = manifest.scripts.map((value: unknown) => {
    if (typeof value !== "string") throw new Error("脚本路径无效");
    const name = value.replace(/^\.\//, "");
    if (!safePath(name) || !name.endsWith(".js") || seen.has(name)) throw new Error("脚本路径无效或重复");
    seen.add(name);
    const data = files[prefix + name];
    if (!data) throw new Error("资源包缺少脚本：" + name);
    return { name, code: decoder.decode(data) };
  });
  return {
    id: manifest.name.trim().normalize("NFC").toLowerCase(),
    name: manifest.name.trim().slice(0, 120), version: manifest.version.trim().slice(0, 80),
    author: typeof manifest.author === "string" ? manifest.author.slice(0, 120) : "",
    scripts, sources: [], importedAt: Date.now(),
  };
}
