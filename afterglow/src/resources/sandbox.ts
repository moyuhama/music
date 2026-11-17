import type { QuickJSAsyncWASMModule } from "quickjs-emscripten-core";
import type { ResourcePackage, ResourceMethod, ResourceSource } from "./types.ts";
import { publicResourceUrl } from "./policy.ts";

export interface ResourceBridge {
  dom(op: string, args: any[]): unknown;
  io(op: string, args: any[]): Promise<unknown>;
}
export async function executeResource(engine: QuickJSAsyncWASMModule, bootstrap: string, pkg: ResourcePackage, method: ResourceMethod, sourceId: string, args: unknown[], bridge: ResourceBridge, timeout = 20000) {
  const context = engine.newContext();
  try {
    context.runtime.setMemoryLimit(48 * 1024 * 1024);
    context.runtime.setMaxStackSize(512 * 1024);
    const deadline = Date.now() + timeout;
    context.runtime.setInterruptHandler(() => Date.now() > deadline);
    const domHandle = context.newFunction("__dom", (op, input) => context.newString(JSON.stringify(bridge.dom(context.getString(op), JSON.parse(context.getString(input))))));
    context.setProp(context.global, "__dom", domHandle); domHandle.dispose();
    let importing = true;
    const ioHandle = context.newAsyncifiedFunction("__io", async (op, input) => {
      try {
        if (importing) throw new Error("资源包不能在导入时访问网络");
        const value = await bridge.io(context.getString(op), JSON.parse(context.getString(input)));
        return context.newString(JSON.stringify({ value }));
      } catch (e) {
        return context.newString(JSON.stringify({ error: e instanceof Error ? e.message : "音源请求失败", status: (e as any)?.status }));
      }
    });
    context.setProp(context.global, "__io", ioHandle); ioHandle.dispose();
    async function evaluate(code: string, name = "resource.js") {
      const result = await context.evalCodeAsync(code, name);
      if (result.error) {
        const error = context.dump(result.error); result.error.dispose();
        throw new Error(error?.message || "资源脚本运行失败");
      }
      try { return context.dump(result.value); } finally { result.value.dispose(); }
    }
    await evaluate(bootstrap, "host.js");
    for (const script of pkg.scripts) await evaluate(script.code, script.name);
    importing = false;
    const output = await evaluate("JSON.stringify(" + (method === "inspect" ? "__inspect()" : "__invoke(" + JSON.stringify(sourceId) + "," + JSON.stringify(method) + "," + JSON.stringify(args) + ")") + ")");
    if (typeof output !== "string" || output.length > 2 * 1024 * 1024) throw new Error("音源返回的数据过大或无效");
    const value = JSON.parse(output);
    if (method === "inspect") {
      if (!Array.isArray(value) || value.length > 128) throw new Error("音源注册结果无效");
      const ids = new Set<string>();
      for (const source of value) {
        if (!source || typeof source.id !== "string" || !source.id.trim() || source.id.length > 160 ||
          typeof source.name !== "string" || !source.name.trim() || source.name.length > 160 || ids.has(source.id)) throw new Error("音源名称或标识无效");
        ids.add(source.id);
      }
      return value.map((source: ResourceSource) => ({
        id: source.id, name: source.name, url: publicResourceUrl(source.url),
        group: String(source.group || "").slice(0, 100), description: String(source.description || "").slice(0, 2000),
        multipleEpisodePages: !!source.multipleEpisodePages,
      }));
    }
    if (method === "audio") {
      const audio = typeof value === "string" ? { url: value } : value;
      if (!audio || typeof audio.url !== "string") throw new Error("音源没有返回有效音频地址");
      audio.url = publicResourceUrl(audio.url);
      return audio;
    }
    return value;
  } finally { context.dispose(); }
}
