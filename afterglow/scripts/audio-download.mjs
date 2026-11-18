export function audioTarget(value) {
  const target = new URL(value);
  if (target.protocol !== "https:" || target.port || target.username || target.password || !(target.hostname.endsWith(".xmcdn.com") || target.hostname === "www.scottbuckley.com.au")) throw new Error("该音频网站尚未接入本地下载服务");
  return target.href;
}
let pending = 0;
export async function handleAudioDownload(req, res, fetcher = fetch) {
  const url = new URL(req.url, "http://127.0.0.1");
  if (url.pathname !== "/__afterglow/audio") return false;
  const fail = (code,text) => { res.writeHead(code,{"Content-Type":"text/plain; charset=utf-8"}); res.end(text); };
  const host = req.headers.host || "";
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host) || (req.headers.origin && req.headers.origin !== "http://"+host) || (req.headers["sec-fetch-site"] && !["same-origin","none"].includes(req.headers["sec-fetch-site"]))) { fail(403,"仅支持本机播放器"); return true; }
  if (req.method !== "GET") { fail(405,"仅支持读取音频"); return true; }
  let target;
  try { target=audioTarget(url.searchParams.get("url")); } catch { fail(400,"音频地址无效"); return true; }
  if (pending >= 3) { fail(429,"下载任务过多"); return true; }
  pending++;
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(),90000);
  const close = ()=>controller.abort(); res.on("close",close);
  try {
    let upstream;
    for(let i=0;i<4;i++) {
      upstream=await fetcher(target,{signal:controller.signal,redirect:"manual"});
      if (![301,302,303,307,308].includes(upstream.status)) break;
      await upstream.body?.cancel();
      target=audioTarget(new URL(upstream.headers.get("location"),target));
    }
    if (!upstream.ok || !upstream.body) throw new Error("音频无法读取");
    const mime=upstream.headers.get("content-type") || "application/octet-stream";
    if (!/^(audio\/|application\/(octet-stream|mp4))/i.test(mime)) throw new Error("不是音频文件");
    const limit=100*1024*1024;
    if (Number(upstream.headers.get("content-length")) > limit) throw new Error("文件超过100MB");
    res.writeHead(200,{"Content-Type":mime,"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});
    let size=0;
    for await(const chunk of upstream.body) {
      size+=chunk.byteLength;
      if(size>limit) throw new Error("文件超过100MB");
      if (!res.write(chunk)) await new Promise((resolve,reject)=> {
        const cleanup=()=> {res.off("drain",drain); res.off("close",closed);};
        const drain=()=>{cleanup();resolve();}; const closed=()=>{cleanup();reject(new Error("下载已取消"));};
        res.once("drain",drain);res.once("close",closed);
      });
    }
    res.end();
  } catch { if (res.headersSent) res.destroy(); else if (!res.destroyed) fail(502,"音频下载失败"); }
  finally {controller.abort();clearTimeout(timer);res.off("close",close);pending--;}
  return true;
}
