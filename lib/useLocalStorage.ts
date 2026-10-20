'use client';

import { useCallback, useSyncExternalStore } from 'react';

const EVENT = 'neon-flappy:storage';

function subscribe(cb: () => void) {
  window.addEventListener('storage', cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener('storage', cb);
    window.removeEventListener(EVENT, cb);
  };
}

/**
 * localStorage 문자열 값을 React 상태처럼 읽고 쓰는 훅.
 * 서버 스냅샷은 항상 fallback 이라 hydration 불일치가 없습니다.
 */
export function useLocalStorage(key: string, fallback = ''): [string, (v: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key) ?? fallback;
      } catch {
        return fallback;
      }
    },
    () => fallback,
  );

  const set = useCallback(
    (v: string) => {
      try {
        localStorage.setItem(key, v);
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );

  return [value, set];
}
