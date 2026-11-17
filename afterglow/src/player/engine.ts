import type { Track } from "../domain/types";
import { providers } from "../sources/index.ts";
export interface PlayerState {
  trackId: string | null;
  status: "idle" | "loading" | "playing" | "paused" | "ended" | "error";
  time: number;
  duration: number;
  volume: number;
  error: string;
  seekVersion: number;
}
export class PlayerEngine {
  private audio = new Audio();
  private listeners = new Set<() => void>();
  private source?: { release(): void };
  private controller?: AbortController;
  private revision = 0;
  private pendingSeek: number | null = null;
  private state: PlayerState = {
    trackId: null,
    status: "idle",
    time: 0,
    duration: 0,
    volume: 0.7,
    error: "",
    seekVersion: 0,
  };
  onEnded?: () => void;
  constructor() {
    this.audio.preload = "metadata";
    this.audio.volume = 0.7;
    const updateTime = () =>
      this.update({
        time: this.audio.currentTime,
        duration: Number.isFinite(this.audio.duration)
          ? this.audio.duration
          : 0,
      });
    this.audio.addEventListener("loadedmetadata", () => {
      if (this.pendingSeek !== null) {
        const time = this.pendingSeek;
        this.pendingSeek = null;
        this.audio.currentTime = Number.isFinite(this.audio.duration)
          ? Math.min(time, this.audio.duration)
          : time;
      }
      updateTime();
    });
    this.audio.addEventListener("timeupdate", updateTime);
    this.audio.addEventListener("durationchange", updateTime);
    this.audio.addEventListener("playing", () =>
      this.update({ status: "playing", error: "" }),
    );
    this.audio.addEventListener("pause", () => {
      if (this.state.status !== "error" && this.state.status !== "idle")
        this.update({ status: "paused" });
    });
    this.audio.addEventListener("waiting", () => {
      if (!this.audio.paused) this.update({ status: "loading" });
    });
    this.audio.addEventListener("ended", () => {
      this.update({ status: "ended" });
      this.onEnded?.();
    });
    this.audio.addEventListener("error", () => {
      if (this.state.trackId && this.audio.getAttribute("src"))
        this.update({
          status: "error",
          error: "无法播放：请检查音频格式、链接是否过期或源站访问限制。",
        });
    });
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  snapshot = () => this.state;
  private update(patch: Partial<PlayerState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }
  async play(track: Track, startTime = 0) {
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    const revision = ++this.revision;
    this.pendingSeek = null;
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
    this.source?.release();
    this.source = undefined;
    this.update({
      trackId: track.id,
      status: "loading",
      time: Math.max(0, startTime),
      duration: 0,
      error: "",
      seekVersion: this.state.seekVersion + 1,
    });
    try {
      const source = await providers[track.source.kind].resolve(
        track,
        controller.signal,
      );
      if (revision !== this.revision) {
        source.release();
        return;
      }
      this.source = source;
      this.pendingSeek = startTime > 0 ? startTime : null;
      this.audio.src = source.url;
      await this.audio.play();
    } catch (e) {
      if (
        revision !== this.revision ||
        controller.signal.aborted ||
        (e instanceof DOMException && e.name === "AbortError")
      )
        return;
      this.update({
        status: "error",
        error:
          e instanceof DOMException && e.name === "NotAllowedError"
            ? "浏览器需要你点击播放按钮后才能播放。"
            : e instanceof Error
              ? e.message
              : "播放失败，请重试",
      });
    }
  }
  select(track: Track) {
    this.stop();
    this.update({
      trackId: track.id,
      status: "paused",
      duration: track.duration ?? 0,
    });
  }
  hasSource() {
    return Boolean(this.source);
  }
  pause() {
    // Invalidate pending source resolution so expiry cannot be followed by autoplay.
    ++this.revision;
    this.controller?.abort();
    this.audio.pause();
    if (this.state.trackId) this.update({ status: "paused" });
  }
  async toggle() {
    if (!this.state.trackId) return;
    if (this.state.status === "playing" || this.state.status === "loading")
      this.audio.pause();
    else {
      try {
        await this.audio.play();
      } catch {
        this.update({
          status: "error",
          error: "播放失败，请重新选择曲目或重试。",
        });
      }
    }
  }
  seek(time: number) {
    if (!Number.isFinite(time) || !this.state.trackId) return;
    const target = Math.max(
      0,
      this.state.duration > 0 ? Math.min(time, this.state.duration) : time,
    );
    if (this.audio.readyState === 0) this.pendingSeek = target;
    else this.audio.currentTime = target;
    this.update({ time: target, seekVersion: this.state.seekVersion + 1 });
  }
  setVolume(volume: number) {
    const safe = Math.max(0, Math.min(1, volume));
    this.audio.volume = safe;
    this.update({ volume: safe });
  }
  stop() {
    ++this.revision;
    this.controller?.abort();
    this.pendingSeek = null;
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
    this.source?.release();
    this.source = undefined;
    this.update({
      trackId: null,
      status: "idle",
      time: 0,
      duration: 0,
      error: "",
    });
  }
}
export const player = new PlayerEngine();
