// Notification sound + voice hook for new bookings
// Uses Web Audio API for chime + SpeechSynthesis for voice announcement

const NOTIFICATION_SOUND_KEY = "rez1-notification-sound";

export const getNotificationSoundEnabled = (): boolean => {
  const stored = localStorage.getItem(NOTIFICATION_SOUND_KEY);
  return stored === null ? true : stored === "true";
};

export const setNotificationSoundEnabled = (enabled: boolean) => {
  localStorage.setItem(NOTIFICATION_SOUND_KEY, String(enabled));
};

// Preload voices as soon as module loads
let voicesLoaded = false;
let cachedVoices: SpeechSynthesisVoice[] = [];

const loadVoices = () => {
  if (!("speechSynthesis" in window)) return;
  cachedVoices = speechSynthesis.getVoices();
  if (cachedVoices.length > 0) {
    voicesLoaded = true;
  }
};

// Load immediately and on voiceschanged event
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  loadVoices();
  speechSynthesis.addEventListener("voiceschanged", loadVoices);
}

// Singleton AudioContext to avoid multiple creations and handle suspension
let audioCtx: AudioContext | null = null;
const getAudioContext = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
};

// Call this on the first user interaction (click / tap) so the context
// is already in "running" state before any Realtime notification arrives.
export const primeAudioContext = () => {
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      ctx.resume();
    }
  } catch (_) {}
};

const playChime = async () => {
  const audioContext = getAudioContext();
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  const playTone = (freq: number, startTime: number, duration: number) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(freq, startTime);
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  };

  const now = audioContext.currentTime;
  playTone(587.33, now, 0.25);
  playTone(739.99, now + 0.15, 0.25);
  playTone(880.0, now + 0.3, 0.4);
};

const pickFemaleVoice = (): SpeechSynthesisVoice | undefined => {
  // Re-try loading voices if still empty
  if (cachedVoices.length === 0) {
    cachedVoices = speechSynthesis.getVoices();
  }
  if (!voicesLoaded && cachedVoices.length > 0) voicesLoaded = true;
  const voices = cachedVoices;

  // Priority list of natural-sounding female voices
  const preferredNames = [
    "Google UK English Female",
    "Microsoft Zira",
    "Samantha",
    "Karen",
    "Moira",
    "Tessa",
    "Fiona",
    "Victoria",
    "Google US English",
  ];

  let voice = voices.find((v) =>
    preferredNames.some((pv) => v.name.includes(pv))
  );

  if (!voice) {
    voice = voices.find(
      (v) => v.lang.startsWith("en") && v.name.toLowerCase().includes("female")
    );
  }

  if (!voice) {
    voice = voices.find((v) => v.lang.startsWith("en"));
  }

  return voice;
};

const speakSlotTime = (slotTime: string, service?: string) => {
  if (!("speechSynthesis" in window)) {
    console.warn("SpeechSynthesis not supported in this browser");
    return;
  }

  // Cancel any ongoing speech
  speechSynthesis.cancel();

  // Wait for chime to finish (~0.7s), then speak
  setTimeout(() => {
    // If voices still not loaded, retry once more
    if (cachedVoices.length === 0) {
      cachedVoices = speechSynthesis.getVoices();
      if (cachedVoices.length > 0) voicesLoaded = true;
    }
    
    const text = service 
      ? `New booking for ${service} at ${slotTime}`
      : `The slot has been booked for ${slotTime}`;
      
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.15;
    utterance.volume = 1;

    const voice = pickFemaleVoice();
    if (voice) {
      utterance.voice = voice;
      console.log("Using voice:", voice.name);
    }

    utterance.onerror = (e) => {
      console.warn("Speech synthesis error:", e);
    };

    speechSynthesis.speak(utterance);
  }, 900);
};

import { useCallback } from "react";

export const useNotificationSound = () => {
  const playBookingSound = useCallback(async (slotTime?: string, service?: string) => {
    if (!getNotificationSoundEnabled()) return;

    try {
      await playChime();
      if (slotTime) {
        speakSlotTime(slotTime, service);
      }
    } catch (e) {
      console.warn("Audio playback failed:", e);
    }
  }, []);

  return { playBookingSound };
};

