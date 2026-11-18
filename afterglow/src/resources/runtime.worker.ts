import { newQuickJSAsyncWASMModuleFromVariant, newVariant } from "quickjs-emscripten-core";
import variant from "@jitl/quickjs-wasmfile-release-asyncify";
import wasmUrl from "@jitl/quickjs-wasmfile-release-asyncify/wasm?url";
import { parseHTML } from "linkedom";
import bootstrap from "./bootstrap.js?raw";
import type { ResourcePackage, ResourceMethod } from "./types";
import { executeResource } from "./sandbox";
import { publicResourceUrl as publicUrl } from "./policy";
import { resourceCrypto } from "./crypto";

const nodes = new Map<number, { node: any; base: string }>();
let nextNode = 1, parsedSize = 0, downloadedSize = 0, domCalls = 0;
const keep = (node: any, base: string): number => {
  if (!node) return 0;
  if (nextNode > 30000) throw new Error("音源页面节点过多");
  const id = nextNode++; nodes.set(id, { node, base }); return id;
};
function dom(op: string, args: any[]): unknown {
  if (++domCalls > 20000) throw new Error("音源解析次数过多");
  if (op === "parse") {
    parsedSize += String(args[0]).length;
    if (parsedSize > 12 * 1024 * 1024) throw new Error("音源页面过大");
    return keep(parseHTML(String(args[0])).document, String(args[1]));
  }
  if (op === "decode") return parseHTML("<html><body></body></html>").document.createRange().createContextualFragment(String(args[0])).textContent;
  if (op === "base64Decode") return new TextDecoder().decode(Uint8Array.from(atob(String(args[0])), (char) => char.charCodeAt(0)));
  if (op === "base64Encode") return btoa(Array.from(new TextEncoder().encode(String(args[0])), (byte) => String.fromCharCode(byte)).join(""));
  if (op === "userAgent") return navigator.userAgent;
  if (["md5", "sha256", "aesEcbDecrypt"].includes(op)) return resourceCrypto(op, args);
  if (op === "uuid") return crypto.randomUUID();
  const entry = nodes.get(args[0]);
  const node = entry?.node, base = entry?.base ?? "";
  switch (op) {
    case "text": return (node?.textContent ?? "").trim();
    case "ownText": return Array.from(node?.childNodes ?? []).filter((n: any) => n.nodeType === 3).map((n: any) => n.textContent).join("").trim();
    case "attr": return node?.getAttribute?.(args[1]) ?? "";
    case "absUrl": { const value = node?.getAttribute?.(args[1]); if (!value) return ""; try { return new URL(value, base).href; } catch { return ""; } }
    case "html": return node?.innerHTML ?? "";
    case "outerHtml": return node?.outerHTML ?? "";
    case "first": return keep(node?.querySelector?.(args[1]), base);
    case "select": return Array.from(node?.querySelectorAll?.(args[1]) ?? []).slice(0, 3000).map((item) => keep(item, base));
    case "parent": return keep(node?.parentElement, base);
    case "children": return Array.from(node?.children ?? []).map((item) => keep(item, base));
    default: throw new Error("不支持的网页解析操作");
  }
}
let requests = 0;
async function request(url: unknown, options: any = {}, readBody = true) {
  if (++requests > 24) throw new Error("此操作请求过多，请缩小搜索范围");
  const href = publicUrl(url);
  if (location.protocol === "https:" && href.startsWith("http:")) throw new Error("此音源接口仅提供 HTTP，HTTPS 网页无法读取");
  const headers = new Headers();
  if (options.contentType) headers.set("Content-Type", String(options.contentType));
  for (const [name, value] of Object.entries(options.headers ?? {})) {
    if (/^cookie$/i.test(name) && value) throw new Error("此音源需要网站登录会话，当前网页版暂不支持");
    // Browser-controlled headers cannot be overridden; public APIs can still
    // accept the browser's own UA and origin. Let the actual request decide.
    if (/^(cookie|user-agent|referer|origin|host|sec-)/i.test(name)) continue;
    headers.set(name, String(value));
  }
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
  try {
    const target = new URL(href);
    const localProxy = ["127.0.0.1", "localhost"].includes(location.hostname) &&
      ((target.hostname === "mobile.ximalaya.com" && (target.pathname === "/mobile/v1/album/track" || /^\/mobile\/others\/ca\/album\/track\//.test(target.pathname))) ||
       (target.hostname === "www.ximalaya.com" && (["/revision/album/v1/simple", "/revision/category/allCategoryInfo", "/revision/category/queryCategoryPageAlbums"].includes(target.pathname) || /^\/mobile-playpage\/track\/v3\/baseInfo\//.test(target.pathname)))) &&
      (!options.method || options.method === "GET");
    const requestUrl = localProxy ? "/__afterglow/ximalaya?url=" + encodeURIComponent(href) : href;
    const response = await fetch(requestUrl, {
      method: options.method || "GET", body: options.body, headers,
      credentials: "omit", referrerPolicy: "no-referrer", signal: controller.signal,
    });
    if (!localProxy) publicUrl(response.url);
    const finalUrl = localProxy ? href : response.url;
    if (!readBody) {
      await response.body?.cancel();
      return { status: response.status, body: "", url: finalUrl, headers: Object.fromEntries(response.headers) };
    }
    const reader = response.body?.getReader();
    const parts: Uint8Array[] = []; let size = 0;
    if (reader) while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength; downloadedSize += chunk.value.byteLength;
      if (size > 4 * 1024 * 1024 || downloadedSize > 12 * 1024 * 1024) { await reader.cancel(); throw new Error("音源响应过大"); }
      parts.push(chunk.value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
    let body: string;
    try { body = new TextDecoder(options.encoding || "utf-8").decode(bytes); }
    catch { body = new TextDecoder().decode(bytes); }
    return { status: response.status, body, url: finalUrl, headers: Object.fromEntries(response.headers) };
  } catch (e) {
    if (e instanceof TypeError) throw new Error("浏览器无法访问音源网站，可能是跨域限制或网络连接失败");
    if (e instanceof DOMException && e.name === "AbortError") throw new Error("音源请求超时，请稍后重试");
    throw e;
  } finally { clearTimeout(timer); }
}
async function io(op: string, args: any[]) {
  if (op === "sleep") { await new Promise((resolve) => setTimeout(resolve, Math.min(1000, Math.max(0, Number(args[0]) || 0)))); return null; }
  if (op === "strings") {
    if (!Array.isArray(args[0]) || args[0].length > 12) throw new Error("批量请求数量过多");
    return Promise.all(args[0].map(async (url: string, i: number) => {
      try { return (await request(url, Array.isArray(args[1]) ? args[1][i] : args[1])).body; } catch { return null; }
    }));
  }
  const result = await request(args[0], args[1], op !== "status" && op !== "finalUrl");
  if (op === "status") return result.status;
  if (op === "fetch") return result;
  if (result.status < 200 || result.status >= 300) throw Object.assign(new Error("音源网站返回 HTTP " + result.status), { status: result.status });
  if (op === "finalUrl") return result.url;
  return result.body;
}
onmessage = async (event: MessageEvent<{ pkg: ResourcePackage; method: ResourceMethod; sourceId: string; args: unknown[] }>) => {
  try {
    const { pkg, method, sourceId, args } = event.data;
    const engine = await newQuickJSAsyncWASMModuleFromVariant(newVariant(variant, { wasmLocation: wasmUrl }));
    const result = await executeResource(engine, bootstrap, pkg, method, sourceId, args, { dom, io });
    postMessage({ result });
  } catch (e) {
    postMessage({ error: e instanceof Error ? e.message : "资源包脚本运行失败" });
  } finally { nodes.clear(); }
};
