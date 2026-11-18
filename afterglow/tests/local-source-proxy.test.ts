import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
// @ts-ignore Node tests load the same middleware as the double-click server.
import { handleXimalayaProxy, ximalayaTarget } from "../scripts/ximalaya-proxy.mjs";
const target = "https://mobile.ximalaya.com/mobile/v1/album/track?albumId=9742745&pageId=1&pageSize=200&isAsc=true&device=android";
test("本地接口只允许固定的公开喜马拉雅路径，拒绝任意代理与过大分页", () => {
  assert.equal(ximalayaTarget(target), target);
  for (const value of ["http://127.0.0.1/", "https://example.com/", "https://mobile.ximalaya.com/admin", target.replace("pageSize=200", "pageSize=9999"), target + "&callback=evil", target.replace("https://", "https://name:secret@")]) assert.throws(() => ximalayaTarget(value));
});
test("本地服务可读取 text/plain JSON，不转发 Cookie，并拒绝跨站调用和重定向", async () => {
  let calls = 0;
  const server = http.createServer((req, res) => { void handleXimalayaProxy(req, res, async (_url: string, options: any) => {
    calls++;
    assert.equal(options.redirect, "error");
    assert.equal(options.headers.Cookie, undefined);
    return new Response('{"ret":0,"data":{"list":[{"title":"章节一"}]}}', { headers: { "Content-Type": "text/plain" } });
  }); });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  const url = `http://127.0.0.1:${port}/__afterglow/ximalaya?url=${encodeURIComponent(target)}`;
  try {
    const r = await fetch(url, { headers: { Cookie: "not-forwarded" } });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).data.list[0].title, "章节一");
    assert.equal((await fetch(url, { headers: { Origin: "https://untrusted.example" } })).status, 403);
    assert.equal((await fetch(url, { headers: { "Sec-Fetch-Site": "cross-site" } })).status, 403);
    assert.equal((await fetch(url, { method: "POST" })).status, 405);
    assert.equal(calls, 1);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
});
