"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "./format";

export interface QueryState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  refetch: () => void;
  setData: (d: T) => void;
}

/**
 * Tiny fetch hook: runs `fn` on mount and whenever `key` changes,
 * ignoring stale responses. `fn` may be re-created freely; `key` drives refetching.
 */
export function useQuery<T>(fn: (signal: AbortSignal) => Promise<T>, key: ReadonlyArray<unknown>, enabled = true): QueryState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  const depKey = JSON.stringify(key);

  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    fnRef
      .current(ctrl.signal)
      .then((d) => {
        if (alive) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!alive || (e instanceof DOMException && e.name === "AbortError")) return;
        setError(errorMessage(e));
        setLoading(false);
      });
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [depKey, tick, enabled]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, refetch, setData };
}
