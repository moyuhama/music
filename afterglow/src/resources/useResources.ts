import { useEffect, useState } from "react";
import { readResourceZip } from "./archive";
import { runResource } from "./client";
import { loadPackages, savePackage } from "./repository";
import type { ResourcePackage, ResourceSource } from "./types";

export function useResources() {
  const [packages, setPackages] = useState<ResourcePackage[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let live = true;
    loadPackages().then((items) => { if (live) setPackages(items); })
      .catch(() => { if (live) setError("无法读取已导入的资源包，请检查浏览器存储权限"); })
      .finally(() => { if (live) setReady(true); });
    return () => { live = false; };
  }, []);
  async function importZip(file: File) {
    setBusy(true); setError(""); setMessage("");
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("ZIP 文件不能超过 10 MB");
      const pkg = readResourceZip(new Uint8Array(await file.arrayBuffer()));
      pkg.sources = await runResource<ResourceSource[]>(pkg, "inspect");
      if (!pkg.sources.length) throw new Error("资源包没有注册任何音源");
      await savePackage(pkg);
      setPackages((items) => [...items.filter((item) => item.id !== pkg.id), pkg]);
      setMessage("已导入 " + pkg.name + "，共 " + pkg.sources.length + " 个音源");
    } catch (e) { setError(e instanceof Error ? e.message : "资源包导入失败"); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    setError(""); setMessage("");
    try { await savePackage(id); setPackages((items) => items.filter((pkg) => pkg.id !== id)); }
    catch { setError("移除失败，请重试"); }
  }
  return { packages, ready, busy, error, message, importZip, remove, hasSources: packages.some((pkg) => pkg.sources.length > 0) };
}
export type ResourcesController = ReturnType<typeof useResources>;
