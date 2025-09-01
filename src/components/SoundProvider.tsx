import React, { createContext, useContext, useEffect, useRef, useState } from "react";

type Ctx = {
  ready: boolean;
  playAlarm: () => Promise<void>;
  requestUnlock: () => Promise<void>;
};

const SoundCtx = createContext<Ctx | null>(null);

export default function SoundProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [ready, setReady] = useState(false);
  const [showUnlock, setShowUnlock] = useState(false);

  useEffect(() => {
    const a = new Audio("/alarm.mp3");
    a.preload = "auto";
    a.loop = false;
    audioRef.current = a;
  }, []);

  async function requestUnlock() {
    try {
      // Thử phát và dừng ngay để "unlock"
      await audioRef.current?.play();
      audioRef.current?.pause();
      audioRef.current!.currentTime = 0;
      setReady(true);
      setShowUnlock(false);
    } catch {
      setShowUnlock(true);
    }
  }

  async function playAlarm() {
    if (!ready) {
      // fallback unlock + beep WebAudio ngắn nếu chưa unlock
      try {
        await requestUnlock();
      } catch {}
    }
    try {
      await audioRef.current?.play();
    } catch {
      // Fallback beep (WebAudio)
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.frequency.value = 880;
        g.gain.setValueAtTime(0.001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
        o.start();
        o.stop(ctx.currentTime + 0.8);
      } catch {}
    }
  }

  // Banner nhỏ yêu cầu bật âm thanh
  const UnlockBanner = () =>
    showUnlock || !ready ? (
      <div className="fixed bottom-4 inset-x-0 flex justify-center z-[101]">
        <button
          onClick={requestUnlock}
          className="bg-brand-500 hover:bg-brand-600 text-white rounded-full px-4 py-2 shadow"
        >
          Nhấn để bật âm thanh cảnh báo
        </button>
      </div>
    ) : null;

  return (
    <SoundCtx.Provider value={{ ready, playAlarm, requestUnlock }}>
      {children}
      <UnlockBanner />
    </SoundCtx.Provider>
  );
}

export function useSound() {
  const ctx = useContext(SoundCtx);
  if (!ctx) throw new Error("useSound must be used within <SoundProvider>");
  return ctx;
}
