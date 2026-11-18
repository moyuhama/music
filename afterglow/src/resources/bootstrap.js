// Executed only inside QuickJS, with no browser or application globals.
var __sources = [], __cache = {}, __prefs = {};
function at(value, path) {
  if (path == null || path === "") return value == null ? null : value;
  var parts = String(path).split(".");
  for (var i = 0; i < parts.length; i++) {
    if (value == null || typeof value !== "object" || !Object.prototype.hasOwnProperty.call(value, parts[i])) return null;
    value = value[parts[i]];
  }
  return value == null ? null : value;
}
function str(value, path, fallback) {
  var result = at(value, path);
  return result == null ? (fallback == null ? "" : String(fallback)) : String(result);
}
function int(value, path, fallback) {
  var number = parseInt(at(value, path), 10);
  return isFinite(number) ? number : (fallback == null ? 0 : fallback);
}
function items(value, path) { var result = at(value, path); return Array.isArray(result) ? result : []; }
function parseJson(text) {
  var input = String(text).trim();
  try { return JSON.parse(input); } catch (e) {}
  var wrapped = /^[\w.$]+\s*\(([\s\S]*)\)\s*;?$/.exec(input);
  if (wrapped) { try { return JSON.parse(wrapped[1]); } catch (e) {} }
  return null;
}
function regexInt(text, regex, fallback) {
  var match = regex.exec(String(text));
  var result = match ? parseInt(match[1], 10) : NaN;
  return isFinite(result) ? result : (fallback == null ? 0 : fallback);
}
function __domCall(op, args) { return JSON.parse(__dom(op, JSON.stringify(args))); }
function __ioCall(op, args) {
  var reply = JSON.parse(__io(op, JSON.stringify(args)));
  if (reply.error) { var error = new Error(reply.error); error.status = reply.status || 0; throw error; }
  return reply.value;
}
function __node(id) {
  return {
    tag: function () { return __domCall("tag", [id]); },
    hasClass: function (name) { return __domCall("hasClass", [id, name]); },
    byId: function (name) { return __node(__domCall("byId", [id, name])); },
    exists: function () { return !!id; },
    text: function () { return __domCall("text", [id]); },
    ownText: function () { return __domCall("ownText", [id]); },
    attr: function (name) { return __domCall("attr", [id, name]); },
    absUrl: function (name) { return __domCall("absUrl", [id, name]); },
    html: function () { return __domCall("html", [id]); },
    outerHtml: function () { return __domCall("outerHtml", [id]); },
    first: function (selector) { return __node(__domCall("first", [id, selector])); },
    select: function (selector) { return __domCall("select", [id, selector]).map(__node); },
    parent: function () { return __node(__domCall("parent", [id])); },
    children: function () { return __domCall("children", [id]).map(__node); }
  };
}
var __host = {
  parseHtml: function (html, base) { return __node(__domCall("parse", [html, base || ""])); },
  getString: function (url, options) { return __ioCall("string", [url, options || {}]); },
  getJson: function (url, options) {
    var result = parseJson(this.getString(url, options));
    if (result === null) throw new Error("音源接口没有返回有效 JSON");
    return result;
  },
  getHtml: function (url, options) { return this.parseHtml(this.getString(url, options), url); },
  getStrings: function (urls, options) { return __ioCall("strings", [urls, options || {}]); },
  fetch: function (url, options) { return __ioCall("fetch", [url, options || {}]); },
  status: function (url, options) { return __ioCall("status", [url, options || {}]); },
  finalUrl: function (url, options) { return __ioCall("finalUrl", [url, options || {}]); },
  sleep: function (time) { return __ioCall("sleep", [time]); },
  render: function () { throw new Error("此音源需要浏览器验证或页面渲染，当前网页版暂不支持"); },
  sniff: function () { throw new Error("此音源需要浏览器音频嗅探，当前网页版暂不支持"); },
  webViewUA: function () { return ""; },
  userAgent: function () { return __domCall("userAgent", []); },
  cookies: function () { return ""; },
  log: function () {}, toast: function () {}, progress: function () {},
  readCache: function (key) { return __cache[key] ? __cache[key].value : ""; },
  writeCache: function (key, value) { __cache[key] = { value: String(value), time: Date.now() }; },
  cacheAge: function (key) { return __cache[key] ? Date.now() - __cache[key].time : -1; },
  getPref: function (key, fallback) { return Object.prototype.hasOwnProperty.call(__prefs, key) ? __prefs[key] : fallback; },
  setPref: function (key, value) { __prefs[key] = value; },
  htmlDecode: function (text) { return __domCall("decode", [text]); },
  base64Decode: function (text) { return __domCall("base64Decode", [text]); },
  base64Encode: function (text) { return __domCall("base64Encode", [text]); },
  uuid: function () { return __domCall("uuid", []); },
  md5: function (text) { return __domCall("md5", [text]); },
  sha256: function (text) { return __domCall("sha256", [text]); },
  aesEcbDecrypt: function (data, keyHex) { return __domCall("aesEcbDecrypt", [data, keyHex]); }
};
function registerSource(source) {
  if (!source || typeof source.id !== "string" || !source.id.trim() || source.id.length > 160 || typeof source.name !== "string" || !source.name.trim() || source.name.length > 160 || typeof source.url !== "string") throw new Error("音源缺少有效的 id、名称或网址");
  if (__sources.length >= 128 || __sources.some(function (item) { return item.id === source.id; })) throw new Error("音源数量过多或 id 重复");
  source.host = __host;
  __sources.push(source);
}
function __inspect() {
  return __sources.map(function (source) {
    return { id: source.id, name: source.name, url: source.url, group: source.group || "", description: source.description || "", multipleEpisodePages: !!source.multipleEpisodePages };
  });
}
function __invoke(id, method, args) {
  var source = __sources.find(function (item) { return item.id === id; });
  if (!source) throw new Error("找不到这个音源，请重新导入资源包");
  if (typeof source[method] !== "function") {
    if (method === "categoryMenus") return [];
    if (method === "audio") return { url: args[0], headers: typeof source.audioHeaders === "function" ? source.audioHeaders(args[0]) : null };
    throw new Error("这个音源没有提供所选功能");
  }
  var result = source[method].apply(source, args);
  if (result && typeof result.then === "function") throw new Error("这个音源返回异步脚本，当前插件格式暂不支持");
  if (method === "audio" && typeof result === "string") return { url: result, headers: typeof source.audioHeaders === "function" ? source.audioHeaders(result) : null };
  return result == null ? null : result;
}
