"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface MediaClock {
  currentMs: number;
  durationMs: number;
  playing: boolean;
  rate: number;
  simulated: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (ms: number, opts?: { play?: boolean }) => void;
  skip: (deltaMs: number) => void;
  setRate: (r: number) => void;
}

const TICK_MS = 100; // UI update rate; smooth enough for transcript sync

/**
 * Playback clock for the meeting player.
 *
 * With a `mediaUrl` it drives a real <audio> element. Without one (seeded or
 * uploaded transcripts have no recording) it simulates playback with a timer,
 * so seeking, speed and transcript sync behave exactly the same.
 */
export function useMediaClock(durationMs: number, mediaUrl?: string | null): MediaClock {
  const [currentMs, setCurrentMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRateState] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const posRef = useRef(0); // authoritative position for the simulated clock
  const rateRef = useRef(1);

  // Real media element
  useEffect(() => {
    if (!mediaUrl) return;
    const audio = new Audio(mediaUrl);
    audio.preload = "metadata";
    audioRef.current = audio;
    const onTime = () => {
      posRef.current = audio.currentTime * 1000;
      setCurrentMs(posRef.current);
    };
    const onEnd = () => setPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnd);
      audioRef.current = null;
    };
  }, [mediaUrl]);

  // Simulated clock
  useEffect(() => {
    if (mediaUrl || !playing) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      posRef.current = Math.min(durationMs, posRef.current + (now - last) * rateRef.current);
      last = now;
      setCurrentMs(posRef.current);
      if (posRef.current >= durationMs) setPlaying(false);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [playing, mediaUrl, durationMs]);

  const play = useCallback(() => {
    if (audioRef.current) void audioRef.current.play().catch(() => setPlaying(false));
    else if (posRef.current >= durationMs) posRef.current = 0;
    setPlaying(true);
  }, [durationMs]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setPlaying(false);
  }, []);

  const seek = useCallback(
    (ms: number, opts?: { play?: boolean }) => {
      const clamped = Math.max(0, Math.min(durationMs, ms));
      posRef.current = clamped;
      if (audioRef.current) audioRef.current.currentTime = clamped / 1000;
      setCurrentMs(clamped);
      if (opts?.play) {
        if (audioRef.current) void audioRef.current.play().catch(() => setPlaying(false));
        setPlaying(true);
      }
    },
    [durationMs],
  );

  const setRate = useCallback((r: number) => {
    rateRef.current = r;
    if (audioRef.current) audioRef.current.playbackRate = r;
    setRateState(r);
  }, []);

  return {
    currentMs,
    durationMs,
    playing,
    rate,
    simulated: !mediaUrl,
    play,
    pause,
    toggle: () => (playing ? pause() : play()),
    seek,
    skip: (d: number) => seek(posRef.current + d),
    setRate,
  };
}
