"use client";

import { useRef, useState, useCallback, useEffect } from "react";

// Minimal typings for the Web Speech API (not in the standard DOM lib).
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
}

interface SpeechRecognitionState {
  supported: boolean;
  listening: boolean;
  finalText: string;
  interim: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function useSpeechRecognition(): SpeechRecognitionState {
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef("");
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SRClass = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SRClass) {
      setSupported(false);
      return;
    }
    setSupported(true);

    const rec = new SRClass();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (e) => {
      let interimStr = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalRef.current += res[0].transcript;
        else interimStr += res[0].transcript;
      }
      setFinalText(finalRef.current);
      setInterim(interimStr);
    };
    rec.onend = () => setListening(false);
    rec.onerror = (e) => {
      // "no-speech" / "aborted" are benign; surface others.
      if (e.error && e.error !== "no-speech" && e.error !== "aborted") {
        setError(e.error);
      }
      setListening(false);
    };
    recRef.current = rec;

    return () => {
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
    };
  }, []);

  const start = useCallback(() => {
    const rec = recRef.current;
    if (!rec || listening) return;
    finalRef.current = "";
    setFinalText("");
    setInterim("");
    setError(null);
    try {
      rec.start();
      setListening(true);
    } catch {
      /* start can throw if called too quickly after stop */
    }
  }, [listening]);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* already stopped */
    }
    setListening(false);
  }, []);

  const reset = useCallback(() => {
    finalRef.current = "";
    setFinalText("");
    setInterim("");
  }, []);

  return { supported, listening, finalText, interim, error, start, stop, reset };
}
