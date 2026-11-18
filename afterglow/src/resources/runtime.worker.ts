import { newQuickJSAsyncWASMModuleFromVariant, newVariant } from "quickjs-emscripten-core";
import variant from "@jitl/quickjs-wasmfile-release-asyncify";
import wasmUrl from "@jitl/quickjs-wasmfile-release-asyncify/wasm?url";
import bootstrap from "./bootstrap.js?raw";
import type { ResourcePackage, ResourceMethod } from "./types";
import { executeResource } from "./sandbox";
import { publicResourceUrl as publicUrl } from "./policy";
import { createResourceDom } from "./dom";

const { dom, clear } = createResourceDom(() => navigator.userAgent);
let requests = 0, downloadedSize = 0;
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
    const localProxy = ["127.0.0.1", "localhost"].includes(location.hostname);
    if (localProxy && new URL(href).hostname === "music.163.com" && new URL(href).pathname === "/api/nuser/account/get") throw new Error("当前网页版尚未接入网易云账号登录，请使用推荐或公开歌单");
    const sourceHeaders = Object.fromEntries(headers);
    if (localProxy) for (const [key,value] of Object.entries(options.headers ?? {})) {
      if (/^(user-agent|referer)$/i.test(key)) sourceHeaders[key] = String(value);
    }
    if (localProxy && options.body && !sourceHeaders["content-type"] && !options.contentType) sourceHeaders["content-type"] = "application/x-www-form-urlencoded";
    const response = await fetch(localProxy ? "/__afterglow/resource" : href, localProxy ? {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({url:href,method:options.method||"GET",body:options.body,headers:sourceHeaders,readBody}), signal:controller.signal,
    } : {
      method: options.method || "GET", body: options.body, headers,
      credentials: "omit", referrerPolicy: "no-referrer", signal: controller.signal,
    });
    if (response.headers.get("X-Afterglow-Error")) throw new Error((await response.json()).error || "本地音源请求失败");
    const finalUrl = localProxy ? decodeURIComponent(response.headers.get("X-Afterglow-Url") || encodeURIComponent(href)) : response.url;
    publicUrl(finalUrl);
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
  if (result.status < 200 || result.status >= 300) throw Object.assign(new Error(result.status === 403 ? "音源网站拒绝请求（HTTP 403），可能需要网站验证或登录" : "音源网站返回 HTTP " + result.status), { status: result.status });
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
  } finally { clear(); }
};
