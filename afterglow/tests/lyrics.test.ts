import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLrc, activeLine, removeDemoLyrics } from "../src/domain/lyrics.ts";
import { insertNext } from "../src/domain/types.ts";
test("LRC 多时间戳、小数位和元数据", () => {
  assert.deepEqual(
    parseLrc("[ti:标题]\n[00:04.5][00:08.50]同一句\n[00:01.250]第一句"),
    [
      { time: 1.25, text: "第一句" },
      { time: 4.5, text: "同一句" },
      { time: 8.5, text: "同一句" },
    ],
  );
});
test("offset 按毫秒修正，跳过非法秒数", () => {
  assert.deepEqual(
    parseLrc("[offset:-500]\n[00:00.20]开头\n[01:70]无效\n[00:02]后面"),
    [
      { time: 0, text: "开头" },
      { time: 1.5, text: "后面" },
    ],
  );
});
test("当前歌词随 seek 前后切换", () => {
  const lines = parseLrc("[00:01]一\n[00:02]二");
  assert.equal(activeLine(lines, 0), -1);
  assert.equal(activeLine(lines, 2.5), 1);
  assert.equal(activeLine(lines, 1.2), 0);
});
test("下一首插入移动原条目且不重复当前曲目", () => {
  assert.deepEqual(insertNext(["a", "b", "c"], "a", "c"), ["a", "c", "b"]);
  assert.deepEqual(insertNext(["a", "b"], "a", "a"), ["a", "b"]);
  assert.deepEqual(insertNext([], null, "c"), ["c"]);
});

test("清理旧试听测试文案，保留真实导入歌词", async () => {
  const { readFile } = await import("node:fs/promises");
  const lyrics = parseLrc(await readFile(new URL("./fixtures/sample.lrc", import.meta.url), "utf8"));
  const sample = { id: "sample-evening", title: "晚风来信", artist: "余音声音实验室", source: { kind: "remote" as const, url: "https://example.com/song.wav" }, addedAt: 1, favorite: false, persist: true, lyrics };
  assert.equal(removeDemoLyrics(sample).lyrics, undefined);
  const realLyrics = { ...sample, lyrics: [{ time: 0, text: "用户导入的歌词" }] };
  assert.equal(removeDemoLyrics(realLyrics), realLyrics);
  const imported = { ...sample, id: "user-imported" };
  assert.equal(removeDemoLyrics(imported), imported);
});
