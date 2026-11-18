import http from "node:http";
import { handleXimalayaProxy } from "./ximalaya-proxy.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { randomUUID, timingSafeEqual } from "node:crypto";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtime = path.join(root, ".runtime");
const statePath = path.join(runtime, "service.json");
const action = process.argv[2] || "start";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function readState() {
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch {
    return null;
  }
}
async function isOurs(state) {
  if (
    !state ||
    !Number.isInteger(state.port) ||
    state.port < 1024 ||
    state.port > 65535
  )
    return false;
  try {
    const response = await fetch(
      `http://127.0.0.1:${state.port}/__afterglow/status`,
      { signal: AbortSignal.timeout(800) },
    );
    const result = await response.json();
    return result.app === "afterglow" && result.instance === state.instance;
  } catch {
    return false;
  }
}
function openBrowser(url) {
  if (process.env.AFTERGLOW_NO_OPEN !== "1") {
    const child = spawn("open", [url], { stdio: "ignore" });
    child.on("error", () => {});
    child.unref();
  }
}
function equal(a, b) {
  const x = Buffer.from(a || "");
  const y = Buffer.from(b || "");
  return x.length === y.length && timingSafeEqual(x, y);
}
if (action === "serve") {
  const dist = path.join(root, "dist");
  const instance = randomUUID();
  const token = randomUUID();
  const mime = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".wav": "audio/wav",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".json": "application/json",
  };
  const server = http.createServer(async (req, res) => {
    if (await handleXimalayaProxy(req, res)) return;
    const url = new URL(req.url, "http://127.0.0.1");
    if (url.pathname === "/__afterglow/status") {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify({ app: "afterglow", instance }));
      return;
    }
    if (url.pathname === "/__afterglow/stop") {
      if (
        req.method !== "POST" ||
        !equal(req.headers["x-afterglow-token"], token) ||
        (req.headers.origin &&
          req.headers.origin !== `http://127.0.0.1:${server.address().port}`)
      ) {
        res.writeHead(403);
        res.end();
        return;
      }
      res.writeHead(200);
      res.end("stopping");
      setTimeout(shutdown, 20);
      return;
    }
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405);
      res.end();
      return;
    }
    let file;
    try {
      file = path.resolve(
        dist,
        "." +
          decodeURIComponent(
            url.pathname === "/" ? "/index.html" : url.pathname,
          ),
      );
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }
    if (!file.startsWith(dist + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    let stat;
    try {
      stat = fs.statSync(file);
      if (!stat.isFile()) throw new Error();
    } catch {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const headers = {
      "Content-Type": mime[path.extname(file)] || "application/octet-stream",
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    };
    let start = 0,
      end = stat.size - 1,
      status = 200;
    if (req.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!match || (!match[1] && !match[2])) {
        res.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
        res.end();
        return;
      }
      if (!match[1]) start = Math.max(0, stat.size - Number(match[2]));
      else start = Number(match[1]);
      if (match[1] && match[2]) end = Math.min(end, Number(match[2]));
      if (start > end || start >= stat.size) {
        res.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
        res.end();
        return;
      }
      headers["Content-Range"] = `bytes ${start}-${end}/${stat.size}`;
      status = 206;
    }
    headers["Content-Length"] = end - start + 1;
    res.writeHead(status, headers);
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    const stream = fs.createReadStream(file, { start, end });
    stream.on("error", () => res.destroy());
    res.on("close", () => stream.destroy());
    stream.pipe(res);
  });
  function shutdown() {
    const state = readState();
    if (state?.instance === instance) fs.rmSync(statePath, { force: true });
    server.close(() => process.exit(0));
    server.closeAllConnections();
    setTimeout(() => process.exit(0), 1500).unref();
  }
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  let port = 4173;
  while (true) {
    try {
      await new Promise((resolve, reject) => {
        const onError = (e) => {
          server.removeListener("listening", onListen);
          reject(e);
        };
        const onListen = () => {
          server.removeListener("error", onError);
          resolve();
        };
        server.once("error", onError);
        server.once("listening", onListen);
        server.listen(port, "127.0.0.1");
      });
      break;
    } catch (e) {
      if (e.code === "EADDRINUSE" && port < 4193) {
        port++;
        continue;
      }
      throw e;
    }
  }
  fs.mkdirSync(runtime, { recursive: true });
  const temp = statePath + ".tmp";
  fs.writeFileSync(
    temp,
    JSON.stringify({ pid: process.pid, port, instance, token }),
    { mode: 0o600 },
  );
  fs.renameSync(temp, statePath);
  console.log(`余音已启动：http://127.0.0.1:${port}`);
} else if (action === "start") {
  fs.mkdirSync(runtime, { recursive: true });
  const lock = path.join(runtime, "start.lock");
  try {
    fs.mkdirSync(lock);
  } catch {
    console.error(
      "启动操作正在进行。若上次启动被中断，请稍后重试；确认没有启动任务后可删除 .runtime/start.lock。",
    );
    process.exit(1);
  }
  try {
    const state = readState();
    if (await isOurs(state)) {
      const url = `http://127.0.0.1:${state.port}`;
      console.log(`播放器已经运行：${url}`);
      openBrowser(url);
    } else {
      if (!fs.existsSync(path.join(root, "dist", "index.html")))
        throw new Error("尚未构建，请运行 npm run build。");
      const log = fs.openSync(path.join(runtime, "server.log"), "a", 0o600);
      const child = spawn(
        process.execPath,
        [fileURLToPath(import.meta.url), "serve"],
        { cwd: root, detached: true, stdio: ["ignore", log, log] },
      );
      child.unref();
      fs.closeSync(log);
      let running;
      for (let i = 0; i < 100; i++) {
        const candidate = readState();
        if (await isOurs(candidate)) {
          running = candidate;
          break;
        }
        await sleep(100);
      }
      if (!running) throw new Error("启动失败，请查看 .runtime/server.log。");
      const url = `http://127.0.0.1:${running.port}`;
      console.log(
        `余音已启动：${url}\n关闭终端后仍可听歌。双击“关闭播放器.command”结束服务。`,
      );
      openBrowser(url);
    }
  } finally {
    fs.rmSync(lock, { recursive: true, force: true });
  }
} else if (action === "stop") {
  const state = readState();
  if (!(await isOurs(state))) {
    console.log("播放器服务未运行。");
    if (state) fs.rmSync(statePath, { force: true });
  } else {
    const response = await fetch(
      `http://127.0.0.1:${state.port}/__afterglow/stop`,
      {
        method: "POST",
        headers: { "x-afterglow-token": state.token },
        signal: AbortSignal.timeout(3000),
      },
    );
    if (!response.ok) throw new Error("关闭请求未通过校验，未终止任何进程。");
    for (let i = 0; i < 30 && (await isOurs(state)); i++) await sleep(100);
    if (await isOurs(state)) throw new Error("服务尚未结束，请稍后重试。");
    console.log("余音播放器服务已关闭。浏览器标签页可以自行关闭。");
  }
} else {
  console.error("用法：node scripts/service.mjs start|stop");
  process.exit(1);
}
