import { useMemo } from "react";
import { useTick } from "../clock/TickProvider";

/** Đếm ngược tới end_at (ISO). Clamp về 0, tránh giờ âm. Dựa trên global tick. */
export function useCountdown(endAtIso: string) {
  const now = useTick();
  const seconds = useMemo(() => {
    const end = new Date(endAtIso).getTime();
    return Math.max(0, Math.floor((end - now) / 1000));
  }, [endAtIso, now]);
  return seconds;
}
