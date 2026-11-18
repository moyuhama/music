import { test } from "node:test";
import assert from "node:assert/strict";
class FakeAudio extends EventTarget {
  static instances: FakeAudio[] = [];
  src = "";
  preload = "";
  volume = 1;
  currentTime = 0;
  duration = NaN;
  readyState = 0;
  paused = true;
  constructor() {
    super();
    FakeAudio.instances.push(this);
  }
  pause() {
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  }
  async play() {
    this.paused = false;
    this.dispatchEvent(new Event("playing"));
  }
  removeAttribute(name: string) {
    if (name === "src") this.src = "";
  }
  getAttribute(name: string) {
    return name === "src" ? this.src : null;
  }
  load() {
    this.currentTime = 0;
    this.duration = NaN;
    this.readyState = 0;
  }
  metadata(duration: number) {
    this.duration = duration;
    this.readyState = 1;
    this.dispatchEvent(new Event("loadedmetadata"));
  }
}
Object.assign(globalThis, { Audio: FakeAudio });
const { PlayerEngine } = await import("../src/player/engine.ts");
const track = {
  id: "one",
  title: "One",
  artist: "Test",
  source: { kind: "remote" as const, url: "https://example.com/one.mp3" },
  addedAt: 0,
  favorite: false,
  persist: false,
};
test("从歌词启动时，先保留目标时间，再在元数据载入后 seek", async () => {
  const engine = new PlayerEngine();
  const audio = FakeAudio.instances.at(-1)!;
  await engine.play(track, 18);
  assert.equal(engine.snapshot().time, 18);
  audio.metadata(40);
  assert.equal(audio.currentTime, 18);
  assert.equal(engine.snapshot().duration, 40);
});
test("加载阶段点击歌词不会被丢弃，最后一次跳转优先", async () => {
  const engine = new PlayerEngine();
  const audio = FakeAudio.instances.at(-1)!;
  await engine.play(track);
  engine.seek(12);
  engine.seek(23);
  assert.equal(engine.snapshot().time, 23);
  audio.metadata(40);
  assert.equal(audio.currentTime, 23);
  assert.equal(engine.snapshot().time, 23);
});
test("已加载音频按实际时长限制跳转，并更新跳转标识", async () => {
  const engine = new PlayerEngine();
  const audio = FakeAudio.instances.at(-1)!;
  await engine.play(track);
  audio.metadata(40);
  const version = engine.snapshot().seekVersion;
  engine.seek(80);
  assert.equal(audio.currentTime, 40);
  engine.seek(-1);
  assert.equal(audio.currentTime, 0);
  assert.equal(engine.snapshot().seekVersion, version + 2);
});
test("连续快速切歌时只采用最后一次解析结果", async () => {
  const engine = new PlayerEngine();
  const audio = FakeAudio.instances.at(-1)!;
  await Promise.all([
    engine.play(track),
    engine.play({
      ...track,
      id: "two",
      source: { kind: "remote", url: "https://example.com/two.mp3" },
    }),
  ]);
  assert.equal(engine.snapshot().trackId, "two");
  assert.equal(audio.src, "https://example.com/two.mp3");
});
test("定时暂停保留当前曲目与播放位置", async () => {
  const engine = new PlayerEngine();
  const audio = FakeAudio.instances.at(-1)!;
  await engine.play(track);
  audio.metadata(40);
  engine.seek(18);
  engine.pause();
  assert.equal(audio.paused, true);
  assert.equal(engine.snapshot().status, "paused");
  assert.equal(engine.snapshot().trackId, "one");
  assert.equal(engine.snapshot().time, 18);
  assert.equal(engine.hasSource(), true);
});
test("定时到期时仍在解析的音源不会随后自动播放", async () => {
  const engine = new PlayerEngine();
  const audio = FakeAudio.instances.at(-1)!;
  const loading = engine.play(track);
  engine.pause();
  await loading;
  assert.equal(audio.paused, true);
  assert.equal(audio.src, "");
  assert.equal(engine.snapshot().status, "paused");
  assert.equal(engine.snapshot().trackId, "one");
});
test("倍速作用于音频并在切歌、暂停与停止后保持，非法输入不改变速度",async()=>{
  const engine=new PlayerEngine();const audio=FakeAudio.instances.at(-1)! as FakeAudio & {playbackRate:number;defaultPlaybackRate:number;preservesPitch:boolean};
  engine.setPlaybackRate(1.5);await engine.play(track);
  assert.equal(audio.playbackRate,1.5);assert.equal(audio.defaultPlaybackRate,1.5);assert.equal(audio.preservesPitch,true);
  engine.pause();await engine.play({...track,id:'two'});assert.equal(engine.snapshot().playbackRate,1.5);assert.equal(audio.playbackRate,1.5);
  for(const value of [0,-1,4,NaN,Infinity])engine.setPlaybackRate(value);
  assert.equal(engine.snapshot().playbackRate,1.5);engine.stop();assert.equal(engine.snapshot().playbackRate,1.5);
});
