import { useState } from "react";
import { BEAT_TYPE_LABELS } from "./classroomTypes";
import { useIsMobile } from "../../lib/useMediaQuery";

/**
 * Lesson-plan progress view. Two layouts share the same data:
 *
 *   Desktop — vertical sidebar on the left of the PlayingView with
 *     one row per beat, highlighting the current position and the
 *     CHECK pass/fail pills as they come in.
 *   Mobile  — a thin horizontal strip at the top showing current beat
 *     N/M, lesson title, and an "End session" tap target. The strip
 *     expands into a dropdown showing the full beat list when tapped
 *     (same idiom as the Notebook mobile picker and the MobileViewPicker).
 *
 * Props:
 *   plan: Plan
 *   currentBeat: number (index)
 *   checkResults: Map<beat_id, { passed }>
 *   onExit: () => void  (mobile only — desktop has its own End Session
 *                        button in PlayingView's top-right corner)
 */
export default function LessonPlanSidebar({ plan, currentBeat, checkResults, onExit }) {
  const isMobile = useIsMobile();
  if (!plan) return null;
  if (isMobile) {
    return <MobileLessonPlanStrip plan={plan} currentBeat={currentBeat} checkResults={checkResults} onExit={onExit} />;
  }
  return <DesktopLessonPlanSidebar plan={plan} currentBeat={currentBeat} checkResults={checkResults} />;
}

function DesktopLessonPlanSidebar({ plan, currentBeat, checkResults }) {
  return (
    <div
      style={{
        width: 280,
        flexShrink: 0,
        borderRight: "1px solid var(--border)",
        padding: "18px 16px",
        overflowY: "auto",
        background: "rgba(0,0,0,0.2)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--text-mute)",
          marginBottom: 6,
        }}
      >
        Lesson plan
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "var(--text)",
          marginBottom: 4,
          lineHeight: 1.3,
        }}
      >
        {plan.source_lesson?.lesson}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--text-mute)",
          marginBottom: 14,
        }}
      >
        {plan.source_lesson?.course} · week {plan.source_lesson?.week} ·{" "}
        {plan.beats?.length || 0} beats · ~{plan.estimated_duration_min ?? "?"} min
      </div>

      <BeatList
        beats={plan.beats || []}
        currentBeat={currentBeat}
        checkResults={checkResults}
      />
    </div>
  );
}

// ============================================================
//  MobileLessonPlanStrip — thin top strip + tap-to-expand
//  vertical beat list. Same pattern as MobileNotePicker.
// ============================================================
function MobileLessonPlanStrip({ plan, currentBeat, checkResults, onExit }) {
  const [open, setOpen] = useState(false);
  const beats = plan.beats || [];
  const total = beats.length;
  const current = beats[currentBeat];
  const currentLabel = current
    ? BEAT_TYPE_LABELS[current.type] || current.type
    : "—";
  // Position is 1-indexed for humans even though currentBeat is 0-indexed.
  // After the last beat (currentBeat == total) the session is ENDED;
  // strip just shows "Done" to avoid "Beat 15 of 14" weirdness.
  const positionLabel = currentBeat >= total ? "Done" : `${currentBeat + 1} / ${total}`;

  return (
    <div
      style={{
        position: "relative",
        borderBottom: "1px solid var(--border)",
        background: "rgba(0,0,0,0.3)",
        flexShrink: 0,
        zIndex: 6,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          minHeight: 52,
        }}
      >
        {/* Strip body — tap to expand. Takes everything except the End
            Session button slot. */}
        <button
          onClick={() => setOpen((o) => !o)}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 12px",
            background: "transparent",
            border: "none",
            color: "var(--text)",
            textAlign: "left",
            cursor: "pointer",
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--accent)",
              fontWeight: 700,
              letterSpacing: "0.1em",
              flexShrink: 0,
            }}
          >
            {positionLabel}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--text-mute)",
              flexShrink: 0,
            }}
          >
            {currentLabel}
          </span>
          <span
            style={{
              flex: 1,
              fontSize: 12,
              color: "var(--text-dim)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
            }}
          >
            {plan.source_lesson?.lesson}
          </span>
          <span
            style={{
              fontSize: 10,
              color: "var(--text-mute)",
              flexShrink: 0,
            }}
          >
            {open ? "▲" : "▼"}
          </span>
        </button>

        {/* End Session — kept adjacent so the student can always exit
            without hunting. Tap target is ≥44px square. */}
        {onExit && (
          <button
            onClick={onExit}
            title="End the classroom session"
            style={{
              width: 44,
              flexShrink: 0,
              background: "transparent",
              border: "none",
              borderLeft: "1px solid var(--border)",
              color: "var(--text-dim)",
              fontSize: 18,
              fontFamily: "var(--font-mono)",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        )}
      </div>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.4)",
              zIndex: 40,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              background: "var(--panel-strong)",
              borderBottom: "1px solid var(--border-strong)",
              boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
              zIndex: 41,
              maxHeight: "70vh",
              overflowY: "auto",
              padding: "12px 14px",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--text-mute)",
                letterSpacing: "0.08em",
                marginBottom: 10,
              }}
            >
              {plan.source_lesson?.course} · week {plan.source_lesson?.week} ·{" "}
              {plan.beats?.length || 0} beats · ~{plan.estimated_duration_min ?? "?"} min
            </div>
            <BeatList
              beats={beats}
              currentBeat={currentBeat}
              checkResults={checkResults}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
//  BeatList — shared vertical timeline for both desktop sidebar
//  and mobile dropdown. Pure presentation, no read-only/jumping.
// ============================================================
function BeatList({ beats, currentBeat, checkResults }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {beats.map((beat, i) => {
        const isCurrent = i === currentBeat;
        const isPast = i < currentBeat;
        const checkResult = checkResults?.get(beat.beat_id);
        return (
          <div
            key={beat.beat_id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 8px",
              background: isCurrent ? "var(--accent-bg)" : "transparent",
              border: isCurrent
                ? "1px solid var(--accent-soft)"
                : "1px solid transparent",
              borderRadius: 5,
              opacity: isPast ? 0.55 : 1,
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: isCurrent
                  ? "var(--accent)"
                  : isPast
                  ? "var(--text-mute)"
                  : "var(--border-strong)",
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: isCurrent ? "var(--accent)" : "var(--text-mute)",
                minWidth: 70,
              }}
            >
              {BEAT_TYPE_LABELS[beat.type] || beat.type}
            </span>
            {checkResult && (
              <span
                style={{
                  fontSize: 10,
                  color: checkResult.passed
                    ? "var(--accent)"
                    : "var(--accent-yellow)",
                }}
              >
                {checkResult.passed ? "✓" : "△"}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
