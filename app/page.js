"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useEventSettings } from "../lib/useEventSettings";
import { storeAttribution } from "../lib/attribution";
import InfoScrubber from "../components/InfoScrubber";

// Reads useSearchParams() so its effect re-runs whenever the `ref` param
// itself changes — including a same-tab client-side navigation to a new
// ?ref= link — rather than only once on first mount, which is all a plain
// window.location.search read in a []-effect would ever see.
function ReferralCapture() {
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref");

  // A valid ?ref= visit always wins (last-click-wins) — validate server-side
  // before touching localStorage so an invalid/inactive code never clobbers
  // a previously stored, still-valid attribution.
  useEffect(() => {
    if (!ref) return;

    fetch(`/api/validate-referral?code=${encodeURIComponent(ref)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.valid) return;
        storeAttribution(ref.trim().toUpperCase());
        fetch("/api/affiliate-click", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: ref }),
        }).catch(() => {});
      })
      .catch(() => {});
  }, [ref]);

  return null;
}

export default function Home() {
  const [loaded, setLoaded] = useState(false);
  const EVENT = useEventSettings();

  useEffect(() => {
    const id = requestAnimationFrame(() => setLoaded(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <main className="home-page">
      <Suspense fallback={null}>
        <ReferralCapture />
      </Suspense>
      <img
        src="/logo.png"
        alt={EVENT.name}
        className={`home-logo logo-reveal ${loaded ? "logo-reveal-in" : ""}`}
      />
      <a
        href={`https://instagram.com/${EVENT.instagramHandle.replace(/^@/, "")}`}
        target="_blank"
        rel="noreferrer"
        className={`home-buy-btn btn-glossy home-instagram-btn text-reveal ${loaded ? "text-reveal-in" : ""}`}
      >
        Syvete on Instagram
      </a>
      <InfoScrubber />
    </main>
  );
}
