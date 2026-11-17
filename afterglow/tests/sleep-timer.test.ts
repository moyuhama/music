import { test } from "node:test";
import assert from "node:assert/strict";
import { SleepTimer } from "../src/player/sleepTimer.ts";

test("定时按真实截止时间触发一次，并清除剩余状态", (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1000 });
  let expired = 0;
  const timer = new SleepTimer(() => expired++);
  timer.start(15);
  assert.equal(timer.snapshot(), 901000);
  t.mock.timers.tick(899999);
  assert.equal(expired, 0);
  t.mock.timers.tick(1);
  assert.equal(expired, 1);
  assert.equal(timer.snapshot(), null);
  timer.check();
  t.mock.timers.tick(900000);
  assert.equal(expired, 1);
});
test("更换定时后旧截止时间不再暂停，取消后不触发", (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 0 });
  let expired = 0;
  const timer = new SleepTimer(() => expired++);
  timer.start(1);
  t.mock.timers.tick(30000);
  timer.start(2);
  t.mock.timers.tick(30000);
  assert.equal(expired, 0);
  assert.equal(timer.snapshot(), 150000);
  timer.cancel();
  t.mock.timers.tick(180000);
  assert.equal(expired, 0);
  assert.equal(timer.snapshot(), null);
});
test("页面恢复时检查墙钟时间，已过期立即停止", (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 0 });
  let expired = 0;
  const timer = new SleepTimer(() => expired++);
  timer.start(1);
  t.mock.timers.setTime(120000);
  timer.check();
  assert.equal(expired, 1);
  assert.equal(timer.snapshot(), null);
});
test("非法时长不会覆盖已设置的定时", (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 0 });
  const timer = new SleepTimer(() => {});
  timer.start(15);
  for (const value of [0, -1, 181, 1.5, NaN, Infinity]) assert.equal(timer.start(value), false);
  assert.equal(timer.snapshot(), 900000);
  timer.cancel();
});
