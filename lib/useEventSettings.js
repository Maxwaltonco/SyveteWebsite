"use client";

import { useEffect, useState } from "react";
import { EVENT_FALLBACK } from "./eventConfig";

// Client-side counterpart to getEventSettings() — fetches the same live
// row via the public API route. Starts from the fallback defaults so SSR
// and the first client render match exactly (no hydration mismatch), then
// swaps in the real values once the fetch resolves.
export function useEventSettings() {
  const [settings, setSettings] = useState(EVENT_FALLBACK);

  useEffect(() => {
    fetch("/api/event-settings")
      .then((res) => res.json())
      .then((data) => {
        if (data && !data.error) setSettings(data);
      })
      .catch(() => {});
  }, []);

  return settings;
}
