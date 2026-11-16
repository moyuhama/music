import { test } from "node:test";
import assert from "node:assert/strict";
import { nextId, formatTime } from "../src/domain/types.ts";
test("顺序自然结束时停止，手动下一首循环回首首", () => {
  assert.equal(nextId(["a", "b"], "b", "sequence", true), null);
  assert.equal(nextId(["a", "b"], "b", "sequence"), "a");
});
test("单曲循环只影响自然结束", () => {
  assert.equal(nextId(["a", "b"], "a", "repeat-one", true), "a");
  assert.equal(nextId(["a", "b"], "a", "repeat-one", false), "b");
});
test("随机模式不重复当前曲目", () => {
  assert.equal(
    nextId(["a", "b", "c"], "a", "shuffle", false, () => 0),
    "b",
  );
  assert.equal(
    nextId(["a", "b", "c"], "a", "shuffle", false, () => 0.99),
    "c",
  );
});
test("空队列和失效当前项", () => {
  assert.equal(nextId([], "a", "sequence"), null);
  assert.equal(nextId(["b", "c"], "a", "sequence"), "b");
  assert.equal(nextId(["b"], "b", "shuffle"), "b");
});
test("未知时长与正常格式", () => {
  assert.equal(formatTime(Infinity), "0:00");
  assert.equal(formatTime(125.3), "2:05");
});
