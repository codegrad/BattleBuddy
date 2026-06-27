import { useRef, useCallback } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { Colors } from '../theme';
import type { MascotState } from '../components/mascot';

const STATE_COLOR_MAP: Record<string, string> = {
  idle: Colors.stateIdle,
  listening: Colors.stateListening,
  user_speaking: Colors.stateUserSpeaking,
  speaking: Colors.stateSpeaking,
  celebrating: Colors.stateUserSpeaking,
  empathy: Colors.stateSpeaking,
};

export function useAudioLevel() {
  const mascotState = useSessionStore((s) => s.mascotState);
  const levelRef = useRef(0);
  const callbacksRef = useRef<Set<(level: number) => void>>(new Set());

  const stateColor = STATE_COLOR_MAP[mascotState] ?? Colors.stateIdle;

  const updateLevel = useCallback((level: number) => {
    levelRef.current = level;
    for (const cb of callbacksRef.current) cb(level);
  }, []);

  const subscribe = useCallback((cb: (level: number) => void) => {
    callbacksRef.current.add(cb);
    return () => { callbacksRef.current.delete(cb); };
  }, []);

  return {
    level: levelRef,
    stateColor,
    updateLevel,
    subscribe,
  };
}

export function getStateColor(state: MascotState): string {
  return STATE_COLOR_MAP[state] ?? Colors.stateIdle;
}
