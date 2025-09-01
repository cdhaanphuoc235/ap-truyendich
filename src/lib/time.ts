/** Tính số phút truyền: (ml * giọt/ml) / (giọt/phút) */
export function calcMinutes(volumeMl: number, dropsPerMl: number, rateDpm: number) {
  return (volumeMl * dropsPerMl) / rateDpm;
}

/** end_at = start + ceil(minutes*60) giây -> ISO */
export function computeEndAtFromNow(minutes: number) {
  const secs = Math.ceil(minutes * 60);
  const start = Date.now();
  const end = new Date(start + secs * 1000);
  return end.toISOString();
}

export function secondsUntil(isoEnd: string) {
  const end = new Date(isoEnd).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((end - now) / 1000));
}

export function fmtHm(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
