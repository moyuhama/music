export function publicResourceUrl(value: unknown): string {
  let url: URL;
  try { url = new URL(String(value)); } catch { throw new Error("音源网址无效"); }
  const host = url.hostname.toLowerCase();
  const ip = /^\d+\.\d+\.\d+\.\d+$/.test(host) ? host.split(".").map(Number) : null;
  const privateIP = ip && (ip[0] === 0 || ip[0] === 10 || ip[0] === 127 || ip[0] >= 224 ||
    (ip[0] === 169 && ip[1] === 254) || (ip[0] === 172 && ip[1] >= 16 && ip[1] <= 31) ||
    (ip[0] === 192 && ip[1] === 168) || (ip[0] === 100 && ip[1] >= 64 && ip[1] <= 127) ||
    (ip[0] === 198 && (ip[1] === 18 || ip[1] === 19)));
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password ||
    host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
    !host.includes(".") || host.includes(":") || privateIP) throw new Error("音源只能访问公开的 HTTP 或 HTTPS 网站");
  return url.href;
}
// Source-specific IDs are data passed back to the plugin, never navigation URLs.
export function resourceReference(value: unknown, base?: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > 8192) return "";
  const text = value.trim();
  if (/^(?:javascript|data|file|blob|vbscript):/i.test(text)) return "";
  if (/^[a-z][a-z\d+.-]*:/i.test(text) && !/^https?:/i.test(text)) return text;
  try {
    const url = new URL(text, base);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : "";
  } catch { return ""; }
}
