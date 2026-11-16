import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeCatalog, musicCatalog } from "../src/domain/catalog.ts";
test("首次载入曲目并记录已处理目录项", () => {
  const value = mergeCatalog([], []);
  assert.equal(value.tracks.length, 3);
  assert.equal(value.catalogIds.length, 3);
});
test("刷新不会重复导入，被移除的曲目不会自动回来", () => {
  const value = mergeCatalog([], []);
  const next = mergeCatalog(value.tracks.slice(1), value.catalogIds);
  assert.equal(next.tracks.length, 2);
});
test("已有同一音频地址时只补全作者与授权信息", () => {
  const existing = {
    ...musicCatalog[0],
    id: "manual-import",
    artist: "example.com",
  };
  const result = mergeCatalog([existing], []);
  assert.equal(result.tracks.length, 3);
  assert.equal(result.tracks[0].id, "manual-import");
  assert.equal(result.tracks[0].artist, "Scott Buckley");
});
