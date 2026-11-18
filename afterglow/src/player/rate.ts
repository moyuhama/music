export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
export function validPlaybackRate(value: number) { return PLAYBACK_RATES.includes(value); }
export function savedPlaybackRate() {
  try { const value = Number(localStorage.getItem('afterglow-playback-rate')); return validPlaybackRate(value) ? value : 1; }
  catch { return 1; }
}
