import { parseHTML } from "linkedom";
import { resourceCrypto } from "./crypto.ts";
export function createResourceDom(userAgent: () => string) {
  const nodes = new Map<number, { node: any; base: string }>();
let nextNode = 1, parsedSize = 0, domCalls = 0;
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
  if (op === "decode") return parseHTML("<html><body>" + String(args[0]) + "</body></html>").document.body.textContent || "";
  if (op === "base64Decode") return new TextDecoder().decode(Uint8Array.from(atob(String(args[0])), (char) => char.charCodeAt(0)));
  if (op === "base64Encode") return btoa(Array.from(new TextEncoder().encode(String(args[0])), (byte) => String.fromCharCode(byte)).join(""));
  if (op === "userAgent") return userAgent();
  if (["md5", "sha256", "aesEcbDecrypt"].includes(op)) return resourceCrypto(op, args);
  if (op === "uuid") return crypto.randomUUID();
  const entry = nodes.get(args[0]);
  const node = entry?.node, base = entry?.base ?? "";
  switch (op) {
    case "tag": return node?.localName || "";
    case "hasClass": return !!node?.classList?.contains(String(args[1]));
    case "byId": return keep((node?.nodeType === 9 ? node : node?.ownerDocument)?.getElementById(String(args[1])), base);
    case "text": return (node?.textContent ?? "").replace(/\s+/g, " ").trim();
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

return { dom, clear: () => nodes.clear() };
}
