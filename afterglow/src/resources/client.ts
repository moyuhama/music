import type { ResourceMethod, ResourcePackage } from "./types";

export function runResource<T>(pkg: ResourcePackage, method: ResourceMethod, sourceId = "", args: unknown[] = [], signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./runtime.worker.ts", import.meta.url), { type: "module" });
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener("abort", abort); worker.terminate(); };
    const abort = () => { cleanup(); reject(new DOMException("已取消", "AbortError")); };
    const timer = setTimeout(() => { cleanup(); reject(new Error("音源响应超时，请稍后重试")); }, 25000);
    worker.onmessage = (event) => {
      cleanup();
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data.result);
    };
    worker.onerror = () => { cleanup(); reject(new Error("音源运行失败，请检查资源包后重试")); };
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener("abort", abort, { once: true });
    worker.postMessage({ pkg, method, sourceId, args });
  });
}
