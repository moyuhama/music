// Local-only adapter for public Ximalaya JSON APIs. Never forwards browser cookies.
const route = "/__afterglow/ximalaya";
export function ximalayaTarget(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.port || url.username || url.password || url.hash) throw new Error("接口地址无效");
  const mobile = url.hostname === "mobile.ximalaya.com" && (
    url.pathname === "/mobile/v1/album/track" ||
    /^\/mobile\/others\/ca\/album\/track\/\d+\/true\/\d+\/\d+$/.test(url.pathname));
  const web = url.hostname === "www.ximalaya.com" && (
    ["/revision/album/v1/simple", "/revision/category/allCategoryInfo", "/revision/category/queryCategoryPageAlbums"].includes(url.pathname) ||
    /^\/mobile-playpage\/track\/v3\/baseInfo\/\d+$/.test(url.pathname));
  if (!mobile && !web) throw new Error("不支持的音源接口");
  const allowed = new Set(["albumId", "pageId", "pageSize", "isAsc", "device", "trackId", "trackQualityLevel", "category", "subcategory", "meta", "sort", "page", "perPage"]);
  for (const [key, val] of url.searchParams) {
    if (!allowed.has(key) || !/^[\w,.-]{0,120}$/.test(val)) throw new Error("接口参数无效");
    if (["pageSize", "perPage"].includes(key) && (!/^\d+$/.test(val) || Number(val) > 200)) throw new Error("分页数量过大");
  }
  return url.href;
}
let pending = 0;
export async function handleXimalayaProxy(req, res, fetcher = fetch) {
  const local = new URL(req.url, "http://127.0.0.1");
  if (local.pathname !== route) return false;
  const finish = (status, text) => { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }); res.end(text); };
  const fail = (status, error) => finish(status, JSON.stringify({ error }));
  const host = req.headers.host || "";
  const site = req.headers["sec-fetch-site"];
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host) || (req.headers.origin && req.headers.origin !== "http://" + host) || (site && !["same-origin", "none"].includes(site))) {
    fail(403, "仅允许本机播放器访问"); return true;
  }
  if (req.method !== "GET") { fail(405, "仅支持读取接口"); return true; }
  let target;
  try { target = ximalayaTarget(local.searchParams.get("url")); }
  catch { fail(400, "不支持的音源接口地址或参数"); return true; }
  if (pending >= 6) { fail(429, "请求过多，请稍后重试"); return true; }
  pending++;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  const close = () => controller.abort();
  res.on("close", close);
  try {
    const upstream = await fetcher(target, { redirect: "error", signal: controller.signal,
      headers: { Accept: "application/json", Referer: "https://www.ximalaya.com/" } });
    const chunks = []; let length = 0;
    for await (const chunk of upstream.body ?? []) {
      length += chunk.byteLength;
      if (length > 4 * 1024 * 1024) { controller.abort(); throw new Error("音源响应过大"); }
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);
    JSON.parse(body.toString("utf8"));
    finish(upstream.status, body);
  } catch (error) {
    if (!res.destroyed) fail(502, controller.signal.aborted ? "音源请求超时或已取消" : "本地服务无法读取音源接口");
  } finally { pending--; clearTimeout(timer); res.removeListener("close", close); }
  return true;
}
