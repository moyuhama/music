import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { zipSync, strToU8 } from "fflate";
import { newQuickJSAsyncWASMModuleFromVariant } from "quickjs-emscripten-core";
import variant from "@jitl/quickjs-wasmfile-release-asyncify";
import { readResourceZip } from "../src/resources/archive.ts";
import { executeResource } from "../src/resources/sandbox.ts";
import { publicResourceUrl, resourceReference } from "../src/resources/policy.ts";
import { resourceCrypto } from "../src/resources/crypto.ts";
import type { ResourcePackage } from "../src/resources/types.ts";

function archive(files: Record<string, string>) {
  return zipSync(Object.fromEntries(Object.entries(files).map(([name, text]) => [name, strToU8(text)])));
}
const manifest = JSON.stringify({ name: "TestSources", version: "1.0", scripts: ["source.js"] });
test("读取根目录与带目录的 ZIP，保留脚本顺序但不执行", () => {
  const zip = archive({ "bundle/manifest.json": manifest, "bundle/source.js": "throw new Error('not executed')" });
  const pkg = readResourceZip(zip);
  assert.equal(pkg.id, "testsources");
  assert.equal(pkg.scripts[0].name, "source.js");
  assert.equal(pkg.sources.length, 0);
});
test("缺少清单、缺少脚本或多个清单时拒绝整个导入", () => {
  assert.throws(() => readResourceZip(archive({ "source.js": "" })), /manifest/);
  assert.throws(() => readResourceZip(archive({ "manifest.json": manifest })), /缺少脚本/);
  assert.throws(() => readResourceZip(archive({ "manifest.json": manifest, "other/manifest.json": manifest })), /只能有一个/);
});
test("拒绝路径穿越及重复脚本", () => {
  assert.throws(() => readResourceZip(archive({ "../manifest.json": manifest })), /路径/);
  assert.throws(() => readResourceZip(archive({ "manifest.json": JSON.stringify({ name: "bad", version: "1", scripts: ["source.js", "source.js"] }), "source.js": "" })), /重复/);
});
test("在解压前拒绝展开后过大的 ZIP", () => {
  assert.throws(() => readResourceZip(archive({ "manifest.json": manifest, "source.js": "x".repeat(5 * 1024 * 1024) })), /过大/);
});
test("拒绝无效、私有网络及带凭据地址，允许公开站点", () => {
  for (const url of ["javascript:alert(1)", "file:///etc/passwd", "http://127.0.0.1/", "http://2130706433/", "http://10.0.0.1/", "http://localhost/", "https://name:password@example.com/"]) assert.throws(() => publicResourceUrl(url));
  assert.equal(publicResourceUrl("https://example.com/music"), "https://example.com/music");
});

const engine = newQuickJSAsyncWASMModuleFromVariant(variant);
const bootstrap = readFileSync(new URL("../src/resources/bootstrap.js", import.meta.url), "utf8");
function pkg(code: string): ResourcePackage {
  return { id: "test", name: "Test", version: "1", author: "", importedAt: 0, sources: [], scripts: [{ name: "source.js", code }] };
}
const bridge = { dom: () => null, io: async () => null };
test("真实隔离引擎能注册音源并调用同步插件中的异步网络接口", async () => {
  const source = pkg("registerSource({id:'test',name:'测试源',url:'https://example.com/',categoryMenus:function(){return JSON.parse(this.host.getString('https://example.com/api'));}})");
  const inspected = await executeResource(await engine, bootstrap, source, "inspect", "", [], bridge) as any[];
  assert.equal(inspected[0].name, "测试源");
  const result = await executeResource(await engine, bootstrap, source, "categoryMenus", "test", [], { ...bridge, io: async () => '[{"title":"专辑","tabs":[]}]' });
  assert.deepEqual(result, [{ title: "专辑", tabs: [] }]);
});
test("导入阶段不允许脚本发起网络请求", async () => {
  let calls = 0;
  const module = await engine;
  await assert.rejects(() => executeResource(module, bootstrap, pkg("__host.getString('https://example.com/')"), "inspect", "", [], { ...bridge, io: async () => { calls++; } }), /不能在导入时访问网络/);
  assert.equal(calls, 0);
});
test("插件接触不到网页存储和浏览器全局对象", async () => {
  const source = pkg("registerSource({id:'test',name:'隔离测试',url:'https://example.com/',categoryMenus:function(){return [typeof window,typeof document,typeof indexedDB,typeof fetch,typeof postMessage];}})");
  const result = await executeResource(await engine, bootstrap, source, "categoryMenus", "test", [], bridge);
  assert.deepEqual(result, ["undefined", "undefined", "undefined", "undefined", "undefined"]);
});
test("死循环会被中断，不阻塞宿主或留下可用音源", async () => {
  const module = await engine;
  await assert.rejects(() => executeResource(module, bootstrap, pkg("while(true){}"), "inspect", "", [], bridge, 30), /interrupted/);
});

test("分类和章节保留插件自定义标识，拒绝脚本地址", () => {
  assert.equal(resourceReference("xm:123"), "xm:123");
  assert.equal(resourceReference("rb-list:clickcount:20#1"), "rb-list:clickcount:20#1");
  assert.equal(resourceReference("javascript:alert(1)"), "");
  assert.equal(resourceReference("/album/123", "https://example.com"), "https://example.com/album/123");
});
test("SDK 提供真实插件依赖的全局 JSON 与正则工具", async () => {
  const source = pkg(`registerSource({id:'test',name:'工具测试',url:'https://example.com/',categoryMenus:function(){
    var data=parseJson('callback({"data":{"list":[{"title":"专辑","count":"42"}]}});');
    return [items(data,'data.list').length,str(data,'data.list.0.title'),int(data,'data.list.0.count'),at(data,'missing'),regexInt('page=17',/page=(\\d+)/,1),items(null).length];
  }});`);
  assert.deepEqual(await executeResource(await engine, bootstrap, source, "categoryMenus", "test", [], bridge), [1,"专辑",42,null,17,0]);
});
test("SDK 摘要和 AES 解码与独立生成的已知向量一致", () => {
  assert.equal(resourceCrypto("md5", ["abc"]), "900150983cd24fb0d6963f7d28e17f72");
  assert.equal(resourceCrypto("sha256", ["abc"]), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(resourceCrypto("aesEcbDecrypt", ["5Hhtik4TgF3Dbwm2zKWrsgTsARZ1MVx6Z5Rvsj67l4s=", "000102030405060708090a0b0c0d0e0f"]), "播放器兼容测试");
});

test("音源 AES 支持 URL-safe Base64 和省略的填充", () => {
  assert.equal(resourceCrypto("aesEcbDecrypt", ["9_LgHcrPc7-pociw1yoHe8gfTmRTtgoCfQvU3mHVmj0", "000102030405060708090a0b0c0d0e0f"]), "URL-safe AES 测试");
});
