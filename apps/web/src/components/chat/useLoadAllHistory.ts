import { useEffect, useRef, useState } from "react";

export function useLoadAllHistory(key: string, loadPage: () => Promise<boolean>) {
  const active = useRef<AbortController | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Cancel history requests on navigation or unmount before another page is requested.
  useEffect(() => {
    return () => {
      active.current?.abort();
      active.current = null;
      setLoadingKey((current) => (current === key ? null : current));
    };
  }, [key]);

  return {
    loadingAll: loadingKey === key,
    error: error?.key === key ? error.message : null,
    clearError: () => setError(null),
    loadAll: () => {
      if (active.current !== null) return;
      const controller = new AbortController();
      active.current = controller;
      setLoadingKey(key);
      setError(null);
      const run = async () => {
        while (!controller.signal.aborted) {
          if (!(await loadPage())) return;
        }
      };
      void run()
        .catch(() => {
          if (active.current === controller && !controller.signal.aborted) {
            setError({ key, message: "Couldn’t load earlier turns. Try again." });
          }
        })
        .finally(() => {
          if (active.current !== controller) return;
          active.current = null;
          setLoadingKey(null);
        });
    },
    stop: () => {
      active.current?.abort();
      setLoadingKey(null);
    },
  };
}
