import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Timer, X } from "lucide-react";
import { SleepTimer as SleepTimerController } from "../player/sleepTimer";
import { player } from "../player/engine";
import { formatTime } from "../domain/types";

const timer = new SleepTimerController(() => player.pause());
export default function SleepTimer() {
  const deadline = useSyncExternalStore(timer.subscribe, timer.snapshot);
  const [now, setNow] = useState(Date.now);
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState("15");
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const remaining = deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now) / 1000));
  useEffect(() => {
    if (deadline === null) return;
    const tick = () => { timer.check(); setNow(Date.now()); };
    tick();
    const interval = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [deadline]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape, true);
    };
  }, [open]);
  function start(value: number) {
    setNow(Date.now());
    if (timer.start(value)) { setOpen(false); trigger.current?.focus(); }
  }
  return (
    <div className="sleep-timer" ref={root} onBlur={(event) => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
    }}>
      <button className={`sleep-timer-trigger ${deadline === null ? "" : "is-set"}`} ref={trigger}
        aria-label={deadline === null ? "定时停止" : `定时停止，剩余 ${formatTime(remaining)}`}
        aria-expanded={open} aria-controls="sleep-timer-panel" title="定时停止" onClick={() => setOpen(!open)}>
        <Timer size={18} />
        {deadline !== null && <><span className="sleep-timer-count" aria-hidden="true">{formatTime(remaining)}</span><i /></>}
      </button>
      {open && <div id="sleep-timer-panel" className="sleep-timer-panel" role="dialog" aria-label="定时停止设置">
        <header><strong>定时停止</strong><button aria-label="关闭定时停止设置" onClick={() => { setOpen(false); trigger.current?.focus(); }}><X size={16} /></button></header>
        <p>{deadline === null ? "选择时长，到时间自动暂停" : <span role="timer" aria-live="off">{formatTime(remaining)} 后暂停播放</span>}</p>
        <div className="sleep-timer-presets">
          {[15, 30, 45, 60, 90, 120].map((value) => <button key={value} onClick={() => start(value)}>{value} 分钟</button>)}
        </div>
        <form className="sleep-timer-custom" onSubmit={(event) => { event.preventDefault(); start(Number(minutes)); }}>
          <input aria-label="自定义分钟数" type="number" min="1" max="180" step="1" required value={minutes} onChange={(event) => setMinutes(event.target.value)} />
          <span>分钟</span><button type="submit">开始</button>
        </form>
        {deadline !== null && <button className="sleep-timer-cancel" onClick={() => { timer.cancel(); setOpen(false); trigger.current?.focus(); }}>取消定时停止</button>}
      </div>}
    </div>
  );
}
