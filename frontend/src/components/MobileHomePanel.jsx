/**
 * MobileHomePanel — the mobile-only landing surface.
 *
 * The product framing: "scroll your SoT instead of doom-scrolling."
 * When you open the app on your phone in an idle moment, you want it
 * to suggest something to do — not show you a navigation menu and ask
 * you to decide.
 *
 * Layout:
 *
 *   ┌─────────────────────────────────────┐
 *   │ ✦  ✦      ✦         ← graph alive  │
 *   │      ◉ ─── ✦   ✦       in the      │
 *   │   ✦  / \      ✦        background  │
 *   │      ✦                              │
 *   ├─────────────────────────────────────┤
 *   │  ⚡  Quick Quiz             →       │  ← action chips
 *   │  🎓  Teach me something     →       │     overlaid on the
 *   │  📓  Browse Notebook        →       │     graph atmosphere
 *   │  📚  Browse all lessons     →       │
 *   ├─────────────────────────────────────┤
 *   │  Last opened · 2/14 this week       │  ← stats footer
 *   └─────────────────────────────────────┘
 *
 * Why this exists:
 *   - The mobile context is grab-and-glance, not sit-and-work
 *   - Decisions are paralyzing in idle moments — proactive suggestions
 *     are what makes the difference between an app and a website
 *   - The graph in the background gives the home atmosphere most
 *     other apps don't have, without forcing graph interaction on a
 *     small touch surface (M4 specifically chose ambient over
 *     interactive — see GraphPanel's `ambient` prop)
 *
 * Props:
 *   stats         — same shape as App.jsx's stats (course count, lesson
 *                   count, visit count, last entry)
 *   onQuickQuiz   — open Quiz modal. M5 will wire a /random endpoint
 *                   so Quick Quiz skips the picker; for now it opens
 *                   the standard quiz flow.
 *   onClassroom   — set view to "classroom" so the picker opens
 *   onNotebook    — set view to "notebook"
 *   onAllLessons  — set view to "list"
 *   headerOffset  — pixel height of the mobile header (passed through
 *                   to the embedded GraphPanel for correct sizing)
 */

import { useState, useCallback } from "react";
import GraphPanel from "./GraphPanel";

export default function MobileHomePanel({
  stats,
  onQuickQuiz,
  onClassroom,
  onNotebook,
  onAllLessons,
  headerOffset = 56,
}) {
  // Counter we bump every time the user taps ✦ Pulse. GraphPanel
  // watches the prop and fires one heartbeat wave on each change.
  // Lives at this level so the button + the graph stay in sync
  // without a ref handshake.
  const [pulseSignal, setPulseSignal] = useState(0);
  // Debounce the button — one tap = one pulse cycle (~3s). Hold the
  // button in a "spent" state until the wave finishes so a frustrated
  // tap-tap-tap doesn't queue five overlapping pulses.
  const [pulseSpent, setPulseSpent] = useState(false);
  const firePulse = useCallback(() => {
    if (pulseSpent) return;
    setPulseSignal((n) => n + 1);
    setPulseSpent(true);
    // ~3s ≈ one full heartbeat-wave duration (1.4s out + ~1.6s buffer).
    // Long enough that re-arming feels intentional, not laggy.
    setTimeout(() => setPulseSpent(false), 3000);
  }, [pulseSpent]);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        zIndex: 5,
      }}
    >
      {/* Ambient graph layer — pure background, no interactivity.
          Lower opacity so it reads as atmosphere; the chips above
          stay legible. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.55,
        }}
      >
        <GraphPanel ambient headerOffset={headerOffset} pulseSignal={pulseSignal} />
      </div>

      {/* ✦ Pulse button — top-right of the graph area. Breathing
          animation invites the tap; tapping fires one heartbeat
          wave across the graph. After it fires, the button stays
          "spent" for ~3s so you can't over-pulse. */}
      <PulseButton onFire={firePulse} spent={pulseSpent} />

      {/* Subtle dark vignette so the chips/footer have contrast even
          where the graph happens to cluster bright nodes underneath. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at center, rgba(4,6,10,0.3) 0%, rgba(4,6,10,0.7) 90%)",
          pointerEvents: "none",
        }}
      />

      {/* Content stack — chips + footer, anchored to the bottom so
          the graph has room to breathe above. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          padding: "16px 12px",
          pointerEvents: "none",  // children re-enable per their needs
        }}
      >
        {/* Spacer pushing the chips downward so the graph fills the
            top of the screen as the visual hero. */}
        <div style={{ flex: 1 }} />

        {/* Action chips — vertical stack of tap targets. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            pointerEvents: "auto",
          }}
        >
          <ActionChip
            icon="⚡"
            label="Quick Quiz"
            sublabel="one question, ~1 min"
            onClick={onQuickQuiz}
            tone="yellow"
          />
          <ActionChip
            icon="🎓"
            label="Teach me something"
            sublabel="full Classroom session, ~5-10 min"
            onClick={onClassroom}
            tone="green"
            prominent
          />
          <ActionChip
            icon="📓"
            label="Browse Notebook"
            sublabel="your saved study guides"
            onClick={onNotebook}
            tone="green"
          />
          <ActionChip
            icon="📚"
            label="Browse all lessons"
            sublabel={
              stats?.total
                ? `${stats.total} lesson${stats.total === 1 ? "" : "s"} in your SOT`
                : "the full Source of Truth"
            }
            onClick={onAllLessons}
            tone="dim"
          />
        </div>

        {/* Footer strip — last opened + lessons-this-week.
            Cheap to compute, gives the home a "tracked progress"
            signal that motivates return visits. */}
        <HomeFooter stats={stats} />
      </div>
    </div>
  );
}

function ActionChip({ icon, label, sublabel, onClick, tone = "green", prominent = false }) {
  // Tone palette — green is the system accent, yellow is the "less
  // committal" alternative used elsewhere for Quick Quiz / raise-hand,
  // dim is for the lesser-priority entry into the SOT browser.
  const palette =
    tone === "yellow"
      ? {
          border: "rgba(247,255,0,0.4)",
          bg: "rgba(247,255,0,0.06)",
          iconBg: "rgba(247,255,0,0.18)",
          accent: "var(--accent-yellow, #f7ff00)",
        }
      : tone === "dim"
      ? {
          border: "rgba(255,255,255,0.18)",
          bg: "rgba(8,10,16,0.55)",
          iconBg: "rgba(255,255,255,0.06)",
          accent: "var(--text-dim)",
        }
      : {
          border: prominent ? "rgba(57,255,20,0.45)" : "rgba(57,255,20,0.3)",
          bg: prominent ? "rgba(57,255,20,0.1)" : "rgba(57,255,20,0.06)",
          iconBg: "rgba(57,255,20,0.18)",
          accent: "var(--accent)",
        };

  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        padding: "14px 14px",
        minHeight: 64,  // generous tap target, fits two lines of text
        background: palette.bg,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        border: `1px solid ${palette.border}`,
        borderRadius: 12,
        color: "var(--text)",
        textAlign: "left",
        cursor: "pointer",
        fontFamily: "inherit",
        boxShadow: prominent ? "0 0 24px rgba(57,255,20,0.25)" : "0 4px 14px rgba(0,0,0,0.4)",
      }}
    >
      <span
        style={{
          width: 36,
          height: 36,
          flexShrink: 0,
          borderRadius: "50%",
          background: palette.iconBg,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
        }}
      >
        {icon}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontSize: 15,
            fontWeight: 600,
            color: palette.accent,
            letterSpacing: "0.02em",
            lineHeight: 1.2,
          }}
        >
          {label}
        </span>
        <span
          style={{
            display: "block",
            fontSize: 11,
            color: "var(--text-mute)",
            marginTop: 2,
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.04em",
          }}
        >
          {sublabel}
        </span>
      </span>
      <span style={{ color: palette.accent, fontSize: 18, flexShrink: 0 }}>
        →
      </span>
    </button>
  );
}

// ============================================================
//  PulseButton — the inviting little ✦ in the top-right that
//  fires a heartbeat wave across the graph on tap.
// ============================================================
//
// Why this exists: M4 shipped the home with a continuous 7.4s
// heartbeat, which made the phone hot and (per the user) lost its
// novelty fast. The cooling pass slowed auto-pulses to once every
// 2 minutes and added this button for "I want one now." The
// button itself is the new dopamine hit — tap, watch your
// knowledge pulse, satisfaction. The breathing animation makes
// the button look alive even when the graph behind it isn't,
// which advertises "this is interactive" without a tooltip.
function PulseButton({ onFire, spent }) {
  return (
    <>
      {/* Keyframes for the breathing animation. Inline so the
          component is self-contained — no global CSS dependency. */}
      <style>{`
        @keyframes pulse-button-breathe {
          0%   { transform: scale(1.00); opacity: 0.72; box-shadow: 0 0 0 0 rgba(57,255,20,0.35), 0 0 14px rgba(57,255,20,0.25); }
          50%  { transform: scale(1.06); opacity: 1.00; box-shadow: 0 0 0 8px rgba(57,255,20,0.00), 0 0 22px rgba(57,255,20,0.45); }
          100% { transform: scale(1.00); opacity: 0.72; box-shadow: 0 0 0 0 rgba(57,255,20,0.35), 0 0 14px rgba(57,255,20,0.25); }
        }
        @keyframes pulse-button-fire {
          0%   { transform: scale(1.15); box-shadow: 0 0 0 0 rgba(57,255,20,0.65), 0 0 32px rgba(57,255,20,0.7); }
          100% { transform: scale(1.00); box-shadow: 0 0 0 24px rgba(57,255,20,0.00), 0 0 16px rgba(57,255,20,0.3); }
        }
      `}</style>
      <button
        onClick={onFire}
        disabled={spent}
        title={spent ? "Pulse traveling…" : "Tap to send a wave across your knowledge"}
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: spent
            ? "rgba(57,255,20,0.08)"
            : "rgba(8,10,16,0.6)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          border: "1px solid rgba(57,255,20,0.5)",
          color: "var(--accent, #39ff14)",
          fontSize: 20,
          fontFamily: "var(--font-mono)",
          cursor: spent ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 8,
          opacity: spent ? 0.5 : 1,
          // Breathing when idle; "fire" decay when spent so the tap
          // produces a visible flash before settling into the dimmed
          // 3-second cooldown.
          animation: spent
            ? "pulse-button-fire 0.6s ease-out"
            : "pulse-button-breathe 3s ease-in-out infinite",
          transition: "opacity 0.2s",
        }}
      >
        ✦
      </button>
    </>
  );
}

function HomeFooter({ stats }) {
  if (!stats) return null;
  // Recent: the "last" object from /api/stats is the most recently
  // ingested canonical entry. Not strictly "last opened" — but a
  // useful proxy in v1; if it feels wrong we can wire actual
  // last-opened tracking later off the gradebook layer.
  const last = stats.last;
  return (
    <div
      style={{
        marginTop: 14,
        padding: "10px 12px",
        background: "rgba(8,10,16,0.55)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: "0.08em",
        color: "var(--text-mute)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        pointerEvents: "auto",
      }}
    >
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
        }}
      >
        {last
          ? `Most recent · ${last.course} · ${last.lesson}`
          : "No lessons yet"}
      </span>
      {stats.streak_days != null && (
        <span style={{ flexShrink: 0, color: stats.streak_days > 0 ? "var(--accent)" : undefined }}>
          {stats.streak_days}-day streak
        </span>
      )}
    </div>
  );
}
