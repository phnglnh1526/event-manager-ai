import { useEffect, useRef } from "react";

/**
 * useAutoRefresh hook
 * Provides near real-time multi-device data synchronization via:
 * 1. Window focus detection (refreshes when user returns to window)
 * 2. Tab visibility change (refreshes immediately when tab becomes visible)
 * 3. Throttled smart interval polling (runs every `interval` ms, auto-pauses when tab is hidden)
 *
 * @param {Function} onRefresh - Callback invoked when a refresh is triggered
 * @param {Object} options
 * @param {number} [options.interval=20000] - Polling interval in ms (default: 20 seconds)
 * @param {boolean} [options.enabled=true] - Whether auto-refresh is active
 * @param {number} [options.debounceMs=4000] - Minimum duration between focus refetches
 */
export function useAutoRefresh(
  onRefresh,
  { interval = 20000, enabled = true, debounceMs = 4000 } = {}
) {
  const lastRefreshRef = useRef(Date.now());
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!enabled) return undefined;

    const triggerRefresh = (source) => {
      const now = Date.now();
      if (now - lastRefreshRef.current < debounceMs) {
        return;
      }
      lastRefreshRef.current = now;
      if (typeof onRefreshRef.current === "function") {
        onRefreshRef.current({ source });
      }
    };

    // 1. Window focus listener
    const handleFocus = () => {
      triggerRefresh("window-focus");
    };

    // 2. Tab visibility listener
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        triggerRefresh("tab-visible");
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // 3. Smart interval polling
    let intervalId = null;
    if (interval > 0) {
      intervalId = setInterval(() => {
        if (document.visibilityState === "visible") {
          triggerRefresh("interval-poll");
        }
      }, interval);
    }

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (intervalId) clearInterval(intervalId);
    };
  }, [enabled, interval, debounceMs]);
}

export default useAutoRefresh;
