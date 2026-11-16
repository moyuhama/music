import { test } from "node:test";
import assert from "node:assert/strict";
import { ScrollMemory } from "../src/interactions/scrollMemory.ts";
test("独立恢复音乐库、收藏、搜索视图的位置", () => {
  const memory = new ScrollMemory();
  memory.save("all", 360);
  memory.save("favorites", 75);
  memory.save("search:夜", 150);
  assert.equal(memory.read("all"), 360);
  assert.equal(memory.read("favorites"), 75);
  assert.equal(memory.read("search:夜"), 150);
  assert.equal(memory.read("new-playlist"), 0);
});
test("记录数量有上限，并保留最近浏览的页面", () => {
  const memory = new ScrollMemory(2);
  memory.save("all", 120);
  memory.save("favorites", 50);
  memory.save("all", 230);
  memory.save("recent", 60);
  assert.equal(memory.read("favorites"), 0);
  assert.equal(memory.read("all"), 230);
  assert.equal(memory.read("recent"), 60);
});
