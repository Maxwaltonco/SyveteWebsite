"use client";

import { useEffect, useRef, useState } from "react";
import ApplyModal from "./ApplyModal";

const PANEL_COUNT = 5;
const AUTO_ADVANCE_MS = 5000;
const RESUME_DELAY_MS = 4000;
const MAGNIFY_ACTIVE_SCALE = 1.5;
const MAGNIFY_NEIGHBOR_SCALE = 1.175;
const TICK_BASE_SIZE = 68; // matches .scrubber-tick's base width/height in CSS

// Scale purely as a function of index distance from the active tick —
// no pointer tracking, just snaps to whichever panel is selected.
function scaleForDistance(distance) {
  if (distance === 0) return MAGNIFY_ACTIVE_SCALE;
  if (distance === 1) return MAGNIFY_NEIGHBOR_SCALE;
  return 1;
}

// Extra left/right margin so a scaled-up tile's larger footprint is
// reserved in the flex layout too — neighbors get pushed apart instead
// of being overlapped by the tile's (layout-invisible) transform growth.
function marginForScale(scale) {
  return (TICK_BASE_SIZE * (scale - 1)) / 2;
}

const TICKS = [
  () => <img src="/Slide_1.png" alt="" className="tick-img" />,
  () => <img src="/Slide_2.png" alt="" className="tick-img" />,
  () => <img src="/Slide_3.png" alt="" className="tick-img" />,
  () => <img src="/Slide_4.png" alt="" className="tick-img" />,
  () => <img src="/Slide_5.png" alt="" className="tick-img" />,
];

export default function InfoScrubber() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);

  const [leadEmail, setLeadEmail] = useState("");
  const [leadStatus, setLeadStatus] = useState("idle"); // idle | submitting | success | error
  const [leadError, setLeadError] = useState("");

  const [hoveredIndex, setHoveredIndex] = useState(null);

  // One-time page-load reveal — flips true on the frame after mount and
  // never changes again, so it only ever plays once, not on panel switches.
  const [loaded, setLoaded] = useState(false);

  const scrubberRef = useRef(null);
  const draggingRef = useRef(false);
  const resumeTimeoutRef = useRef(null);

  // Auto-advance timing. nextDelayRef normally holds AUTO_ADVANCE_MS, but
  // opening the modal overwrites it with whatever was left of the current
  // panel's interval so closing the modal resumes from that exact point
  // instead of restarting the full 5s — see openModal/closeModal below.
  const nextDelayRef = useRef(AUTO_ADVANCE_MS);
  const lastAdvanceAtRef = useRef(Date.now());

  useEffect(() => {
    const id = requestAnimationFrame(() => setLoaded(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Embedded Checkout redirects the whole page back here on completion
  // (return_url) — always a hard top-level navigation, never a client-side
  // one, so a plain one-time mount check is sufficient. Auto-opens the
  // modal so ApplyModal's own resume logic can show the inline success view.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout_session_id")) {
      openModal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Any panel change (auto-advance, click, or drag) starts a fresh full
  // cycle for next time, unless something (openModal) overrides the delay
  // before the next cycle's effect run below picks it up.
  useEffect(() => {
    lastAdvanceAtRef.current = Date.now();
    nextDelayRef.current = AUTO_ADVANCE_MS;
  }, [active]);

  // Auto-advance, gated by both hover/drag pause and the modal. Uses a
  // self-scheduling timeout (instead of setInterval) so its delay can be
  // overridden for exactly one cycle when resuming from a modal pause.
  useEffect(() => {
    if (paused || modalOpen) return;
    const delay = nextDelayRef.current;
    const id = setTimeout(() => {
      setActive((a) => (a + 1) % PANEL_COUNT);
    }, delay);
    return () => clearTimeout(id);
  }, [paused, modalOpen, active]);

  useEffect(() => {
    return () => {
      if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    };
  }, []);

  function openModal() {
    const elapsed = Date.now() - lastAdvanceAtRef.current;
    nextDelayRef.current = Math.max(AUTO_ADVANCE_MS - elapsed, 0);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
  }

  function getTicks() {
    const el = scrubberRef.current;
    if (!el) return [];
    return Array.from(el.querySelectorAll(".scrubber-tick"));
  }

  // Snap to whichever tick the pointer is nearest — no continuous pixel math.
  function indexFromClientX(clientX) {
    const ticks = getTicks();
    if (!ticks.length) return active;
    let closestIndex = active;
    let closestDist = Infinity;
    ticks.forEach((child, i) => {
      const rect = child.getBoundingClientRect();
      const center = rect.left + rect.width / 2;
      const dist = Math.abs(clientX - center);
      if (dist < closestDist) {
        closestDist = dist;
        closestIndex = i;
      }
    });
    return closestIndex;
  }

  function pauseAuto() {
    setPaused(true);
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
  }

  function scheduleResume() {
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    resumeTimeoutRef.current = setTimeout(() => {
      setPaused(false);
    }, RESUME_DELAY_MS);
  }

  function handlePointerDown(e) {
    draggingRef.current = true;
    pauseAuto();
    const idx = indexFromClientX(e.clientX);
    setActive(idx);
    setHoveredIndex(idx);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function handlePointerMove(e) {
    const idx = indexFromClientX(e.clientX);
    setHoveredIndex((prev) => (prev === idx ? prev : idx));
    if (!draggingRef.current) return;
    setActive((prev) => (prev === idx ? prev : idx));
  }

  function handlePointerUp() {
    draggingRef.current = false;
    scheduleResume();
  }

  function handlePointerEnter(e) {
    pauseAuto();
    setHoveredIndex(indexFromClientX(e.clientX));
  }

  function handlePointerLeave() {
    setHoveredIndex(null);
    if (!draggingRef.current) scheduleResume();
  }

  function handleTickClick(i) {
    pauseAuto();
    setActive(i);
    setHoveredIndex(i);
    scheduleResume();
  }

  async function handleLeadSubmit(e) {
    e.preventDefault();
    if (!leadEmail.trim()) return;
    setLeadStatus("submitting");
    setLeadError("");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: leadEmail.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setLeadStatus("success");
      } else {
        setLeadError(data.error || "Could not save. Try again.");
        setLeadStatus("error");
      }
    } catch {
      setLeadError("Network error. Try again.");
      setLeadStatus("error");
    }
  }

  function renderMedia(index) {
    switch (index) {
      case 0:
        return <img src="/Slide_1.png" alt="The boat" className="panel-media-img" />;
      case 1:
        return <img src="/Slide_2.png" alt="ID check" className="panel-media-img" />;
      case 2:
        return (
          <img
            src="/Slide_3.png"
            alt="Payments secured by Stripe"
            className="panel-media-img"
          />
        );
      case 3:
        return (
          <img
            src="/Slide_4.png"
            alt="Follow us on Instagram"
            className="panel-media-img"
          />
        );
      case 4:
        return <img src="/Slide_5.png" alt="Mail" className="panel-media-img" />;
      default:
        return null;
    }
  }

  function renderBody(index) {
    switch (index) {
      case 0:
        return (
          <>
            <p className="home-eyebrow">Only 150 Spots</p>
            <p className="home-location">Curated Yacht Party</p>
            <button className="home-buy-btn btn-glossy" onClick={openModal}>
              Apply for Ticket
            </button>
          </>
        );
      case 1:
        return (
          <>
            <p className="home-eyebrow">Something else is overdue.</p>
            <p className="home-location">Same Clubs. Every Weekend</p>
            <button className="home-buy-btn btn-glossy" onClick={openModal}>
              Apply for Ticket
            </button>
          </>
        );
      case 2:
        return (
          <>
            <p className="home-eyebrow">Music. Bar. Open water.</p>
            <p className="home-location">Finally, Something to Do</p>
            <button className="home-buy-btn btn-glossy" onClick={openModal}>
              Apply for Ticket
            </button>
          </>
        );
      case 3:
        return (
          <>
            <p className="home-eyebrow">Not Confirmed? Refunded in full.</p>
            <p className="home-location">Applications Reviewed</p>
            <button className="home-buy-btn btn-glossy" onClick={openModal}>
              Apply for Ticket
            </button>
          </>
        );
      case 4:
        return leadStatus === "success" ? (
          <>
            <p className="panel-copy panel-copy-lg">Get notified before spots close.</p>
            <p className="panel-copy lead-success">you&rsquo;re on the list.</p>
          </>
        ) : (
          <form className="lead-form" onSubmit={handleLeadSubmit}>
            <p className="panel-copy panel-copy-lg">Get notified before spots close.</p>
            <div className="lead-fields">
              <input
                type="email"
                className="lead-input"
                placeholder="Email"
                value={leadEmail}
                onChange={(e) => {
                  setLeadEmail(e.target.value);
                  pauseAuto();
                  scheduleResume();
                }}
                onFocus={() => pauseAuto()}
                onBlur={() => scheduleResume()}
                disabled={leadStatus === "submitting"}
              />
            </div>
            <button
              type="submit"
              className="home-buy-btn btn-glossy"
              disabled={leadStatus === "submitting" || !leadEmail.trim()}
            >
              {leadStatus === "submitting" ? "Joining…" : "Join"}
            </button>
            {leadStatus === "error" && (
              <p className="home-error">{leadError}</p>
            )}
          </form>
        );
      default:
        return null;
    }
  }

  return (
    <div className="info-scrubber">
      <div className={`media-reveal ${loaded ? "media-reveal-in" : ""}`}>
        <div className="panel-media">{renderMedia(active)}</div>
      </div>
      <div className={`text-reveal ${loaded ? "text-reveal-in" : ""}`}>
        <div className="panel-body">{renderBody(active)}</div>
      </div>

      <div
        className={`scrubber-bar track-reveal ${loaded ? "track-reveal-in" : ""}`}
        ref={scrubberRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
      >
        {TICKS.map((Tick, i) => {
          const focusIndex = hoveredIndex !== null ? hoveredIndex : active;
          const scale = scaleForDistance(Math.abs(i - focusIndex));
          const extraMargin = marginForScale(scale);
          const tileDelay = 560 + i * 80;
          return (
            <span
              key={i}
              className={`tile-reveal ${loaded ? "tile-reveal-in" : ""}`}
              style={{ transitionDelay: loaded ? `${tileDelay}ms` : "0ms" }}
            >
              <button
                type="button"
                className="scrubber-tick"
                aria-label={`Go to panel ${i + 1}`}
                aria-current={active === i ? "true" : undefined}
                style={{
                  transform: `scale(${scale})`,
                  margin: `0 ${extraMargin}px`,
                }}
                onClick={() => handleTickClick(i)}
              >
                <Tick />
              </button>
            </span>
          );
        })}
      </div>
      <p className={`scroll-hint hint-reveal ${loaded ? "hint-reveal-in" : ""}`}>
        {"<<< scroll for  details >>>"}
      </p>

      <ApplyModal open={modalOpen} onClose={closeModal} />
    </div>
  );
}
