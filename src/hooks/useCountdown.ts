import { useEffect, useState } from "react";
import { secondsUntil } from "../lib/time";

/** Đếm ngược tới end_at (ISO). Clamp về 0, tránh giờ âm. */
export function useCountdown(endAtIso: string) {
  const [seconds, setSeconds] = useState(() => secondsUntil(endAtIso));

  useEffect(() => {
    let mounted = true;
    const tick = () => {
      if (!mounted) return;
      setSeconds(secondsUntil(endAtIso));
    };
    const id = window.setInterval(tick, 1000);
    tick(); // cập nhật ngay khi mount
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [endAtIso]);

  return seconds;
}
