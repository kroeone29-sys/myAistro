/**
 * NotebookSectionPicker — the Classroom's primary entry surface.
 *
 * Listens to the Notebook: shows every saved section across every saved
 * note, grouped under collapsible note headers. The Classroom now uses
 * the Notebook as its "what's available to teach" feed instead of
 * browsing every SOT lesson directly. Reframing:
 *
 *   Notebook  = where the user curates what's worth studying
 *   Classroom = where the user executes on that curation
 *
 * Each section is clickable:
 *   - If a plan is already cached (cached_plan_id set), label is
 *     "▶ Resume" and clicking should load the cached plan (faster).
 *   - If no plan exists yet, label is "🎓 Teach" and clicking should
 *     trigger a fresh plan-from-section generation.
 *
 * The parent (ClassroomPanel) provides callbacks for both cases; this
 * component just renders + dispatches.
 *
 * Empty state guides the user toward saving an advisor output first,
 * or browsing all SOT lessons (the secondary path) via the link the
 * parent renders below this component.
 *
 * @param {object}   props
 * @param {Function} props.onTeachSection   Called with {notebook_id,
 *                                          section_index, course,
 *                                          week, lesson} when the user
 *                                          clicks a fresh section.
 * @param {Function} props.onResumePlan     Called with {plan_id} when
 *                                          the user clicks a section
 *                                          with a cached plan.
 * @param {Function} props.onBrowseAll      Called when the user clicks
 *                                          the "browse all lessons"
 *                                          secondary link.
 */

import { useCallback, useEffect, useState } from "react";
import { useIsMobile } from "../../lib/useMediaQuery";

export default function NotebookSectionPicker({
  onTeachSection,
  onResumePlan,
  onBrowseAll,
}) {
  const isMobile = useIsMobile();
  const [notes, setNotes] = useState(null);
  const [error, setError] = useState(null);
  // Collapsed state per notebook_id. Default: first note expanded,
  // rest collapsed. The user can toggle each independently.
  const [collapsed, setCollapsed] = useState({});

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch("/api/notebook/teachable");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setNotes(Array.isArray(data) ? data : []);
      // Default expand: first note open, others collapsed.
      const initial = {};
      data.forEach((n, i) => {
        initial[n.notebook_id] = i !== 0;
      });
      setCollapsed(initial);
    } catch (e) {
      setError(e.message ?? String(e));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (notes === null && error === null) {
    return (
      <div style={loadingStyle}>Loading your saved sections…</div>
    );
  }

  if (error) {
    return <div style={errorStyle}>{error}</div>;
  }

  return (
    <div style={isMobile ? mobileContainerStyle : containerStyle}>
      <div style={isMobile ? mobileHeaderStyle : headerStyle}>
        <div style={kickerStyle}>Classroom · your study queue</div>
        <h1 style={isMobile ? mobileTitleStyle : titleStyle}>What would you like to learn?</h1>
        {!isMobile && (
          <div style={subtitleStyle}>
            Sections you've saved to your Notebook. Each one becomes a
            beat-by-beat teaching session.
          </div>
        )}
      </div>

      {notes.length === 0 && (
        <EmptyState onBrowseAll={onBrowseAll} />
      )}

      {notes.length > 0 && (
        <div style={listStyle}>
          {notes.map((n) => (
            <NoteGroup
              key={n.notebook_id}
              note={n}
              collapsed={collapsed[n.notebook_id] ?? false}
              onToggle={() =>
                setCollapsed((c) => ({
                  ...c,
                  [n.notebook_id]: !c[n.notebook_id],
                }))
              }
              onTeachSection={onTeachSection}
              onResumePlan={onResumePlan}
            />
          ))}
        </div>
      )}

      {/* Secondary: small text link to the SOT-browse path. Quiet on
          purpose — the picker primary is the Notebook; this is the
          escape hatch for one-off "I want to teach a lesson I haven't
          saved yet" cases. */}
      {notes.length > 0 && (
        <div style={browseLinkContainerStyle}>
          <button onClick={onBrowseAll} style={browseLinkStyle}>
            Or browse all lessons →
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
//  NoteGroup — collapsible note with its sections inside
// ============================================================
function NoteGroup({ note, collapsed, onToggle, onTeachSection, onResumePlan }) {
  return (
    <div style={noteGroupStyle}>
      <button onClick={onToggle} style={noteHeaderStyle}>
        <span style={chevronStyle}>{collapsed ? "▸" : "▾"}</span>
        <span style={noteTitleStyle}>{note.title || "(untitled note)"}</span>
        <span style={noteMetaStyle}>
          {note.section_count} section{note.section_count === 1 ? "" : "s"}
          {note.created_at && (
            <> · {note.created_at.slice(0, 10)}</>
          )}
        </span>
      </button>
      {!collapsed && (
        <div style={sectionListStyle}>
          {note.sections.map((s) => (
            <SectionRow
              key={s.section_index}
              section={s}
              notebookId={note.notebook_id}
              onTeachSection={onTeachSection}
              onResumePlan={onResumePlan}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
//  SectionRow — one teachable section
// ============================================================
function SectionRow({ section, notebookId, onTeachSection, onResumePlan }) {
  const isCached = !!section.cached_plan_id;
  const ratio = section.grounding_ratio;
  // Color the grounding chip the same way the Notebook detail view
  // does — green ≥ 70%, yellow ≥ 50%, red < 50%, neutral if unknown.
  const ratioColor =
    ratio == null
      ? "rgba(255,255,255,0.18)"
      : ratio >= 0.7
      ? "rgba(57,255,20,0.4)"
      : ratio >= 0.5
      ? "rgba(247,255,0,0.4)"
      : "rgba(239,68,68,0.45)";

  const handleClick = () => {
    if (isCached) {
      onResumePlan?.({ plan_id: section.cached_plan_id });
    } else {
      onTeachSection?.({
        notebook_id: notebookId,
        section_index: section.section_index,
        course: section.course,
        week: section.week,
        lesson: section.lesson,
      });
    }
  };

  return (
    <button onClick={handleClick} style={sectionRowStyle}>
      <div style={sectionRowMainStyle}>
        <div style={sectionTitleStyle}>{section.lesson}</div>
        <div style={sectionMetaStyle}>
          <span style={{
            ...courseChipStyle,
            borderColor: ratioColor,
          }}>
            {section.course} · w{section.week}
            {ratio != null && (
              <span style={{ opacity: 0.7, marginLeft: 4 }}>
                · {Math.round(ratio * 100)}%
              </span>
            )}
          </span>
          {section.content_preview && (
            <span style={previewStyle}>{section.content_preview}</span>
          )}
        </div>
      </div>
      <div
        style={{
          ...actionBadgeStyle,
          color: isCached ? "var(--accent, #39ff14)" : "var(--accent-yellow, #f7ff00)",
          borderColor: isCached
            ? "rgba(57,255,20,0.4)"
            : "rgba(247,255,0,0.35)",
        }}
      >
        {isCached ? "▶ Resume" : "🎓 Teach"}
      </div>
    </button>
  );
}

// ============================================================
//  EmptyState — when the notebook has no saved sections yet
// ============================================================
function EmptyState({ onBrowseAll }) {
  return (
    <div style={emptyContainerStyle}>
      <div style={emptyTitleStyle}>Your study queue is empty.</div>
      <div style={emptyBodyStyle}>
        Generate a study guide in <strong>my-AI-stro Chat</strong>, then
        click <em>★ Save to Notebook</em> on the response. Saved sections
        appear here as teachable units — each one a complete classroom
        session.
      </div>
      <button onClick={onBrowseAll} style={emptyBrowseButtonStyle}>
        Or browse all lessons →
      </button>
    </div>
  );
}

// ============================================================
//  STYLES  (inline to match the rest of the app's pattern)
// ============================================================
const containerStyle = {
  position: "absolute",
  inset: 0,
  overflowY: "auto",
  padding: "32px 32px 80px",
  zIndex: 5,
};

// Mobile shrinks the side padding to 12px and the bottom safety
// margin too, so 400px-wide phone screens get the full width for
// section rows instead of losing 64px to gutters.
const mobileContainerStyle = {
  position: "absolute",
  inset: 0,
  overflowY: "auto",
  padding: "16px 12px 60px",
  zIndex: 5,
};

const headerStyle = {
  maxWidth: 880,
  margin: "0 auto 24px",
};

const mobileHeaderStyle = {
  margin: "0 0 16px",
};

const mobileTitleStyle = {
  margin: "8px 0 0",
  fontSize: 20,        // smaller than desktop's 28 — fits phone width
  fontWeight: 700,
  color: "var(--text)",
  lineHeight: 1.25,
};

const kickerStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--accent)",
  marginBottom: 12,
};

const titleStyle = {
  margin: 0,
  fontSize: 28,
  fontWeight: 700,
  color: "var(--text)",
  lineHeight: 1.2,
};

const subtitleStyle = {
  marginTop: 8,
  fontSize: 14,
  color: "var(--text-dim)",
  lineHeight: 1.5,
};

const listStyle = {
  maxWidth: 880,
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

const noteGroupStyle = {
  background: "rgba(8,10,16,0.5)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 10,
  overflow: "hidden",
};

const noteHeaderStyle = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "12px 16px",
  background: "transparent",
  border: "none",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  color: "var(--text)",
  cursor: "pointer",
  textAlign: "left",
  fontFamily: "inherit",
  transition: "background 0.12s",
};

const chevronStyle = {
  color: "var(--text-mute)",
  fontSize: 12,
  width: 14,
};

const noteTitleStyle = {
  flex: 1,
  fontSize: 14,
  fontWeight: 600,
  color: "var(--text)",
};

const noteMetaStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.08em",
  color: "var(--text-mute)",
};

const sectionListStyle = {
  display: "flex",
  flexDirection: "column",
};

const sectionRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 14px",
  background: "transparent",
  border: "none",
  borderTop: "1px solid rgba(255,255,255,0.04)",
  color: "var(--text)",
  cursor: "pointer",
  textAlign: "left",
  fontFamily: "inherit",
  transition: "background 0.12s",
  minHeight: 56,  // iOS-friendly tap target floor for the whole row
};

const sectionRowMainStyle = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const sectionTitleStyle = {
  fontSize: 14,
  fontWeight: 500,
  color: "var(--text)",
  lineHeight: 1.3,
};

const sectionMetaStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const courseChipStyle = {
  display: "inline-flex",
  alignItems: "center",
  padding: "2px 7px",
  background: "rgba(57,255,20,0.05)",
  border: "1px solid rgba(57,255,20,0.25)",
  borderRadius: 999,
  fontSize: 10,
  fontFamily: "var(--font-mono)",
  letterSpacing: "0.05em",
  color: "var(--accent)",
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const previewStyle = {
  fontSize: 11,
  color: "var(--text-mute)",
  fontStyle: "italic",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  flex: 1,
  minWidth: 0,
};

const actionBadgeStyle = {
  flexShrink: 0,
  padding: "5px 11px",
  background: "rgba(0,0,0,0.4)",
  border: "1px solid",
  borderRadius: 6,
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  letterSpacing: "0.06em",
  fontWeight: 600,
};

const browseLinkContainerStyle = {
  maxWidth: 880,
  margin: "24px auto 0",
  textAlign: "center",
};

const browseLinkStyle = {
  background: "transparent",
  border: "none",
  color: "var(--text-dim)",
  fontSize: 12,
  fontFamily: "var(--font-mono)",
  letterSpacing: "0.06em",
  cursor: "pointer",
  padding: "8px 14px",
  textDecoration: "underline",
  textDecorationColor: "rgba(255,255,255,0.18)",
  textUnderlineOffset: 4,
};

const emptyContainerStyle = {
  maxWidth: 600,
  margin: "40px auto",
  padding: "32px 28px",
  background: "rgba(8,10,16,0.5)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  textAlign: "center",
};

const emptyTitleStyle = {
  fontSize: 17,
  fontWeight: 600,
  color: "var(--text)",
  marginBottom: 12,
};

const emptyBodyStyle = {
  fontSize: 13.5,
  color: "var(--text-dim)",
  lineHeight: 1.6,
  marginBottom: 20,
};

const emptyBrowseButtonStyle = {
  padding: "9px 16px",
  background: "rgba(57,255,20,0.08)",
  border: "1px solid rgba(57,255,20,0.3)",
  borderRadius: 6,
  color: "var(--accent)",
  fontSize: 12,
  fontFamily: "var(--font-mono)",
  letterSpacing: "0.08em",
  cursor: "pointer",
};

const loadingStyle = {
  padding: 40,
  textAlign: "center",
  color: "var(--text-dim)",
  fontSize: 13,
};

const errorStyle = {
  padding: 40,
  textAlign: "center",
  color: "var(--danger, #ef4444)",
  fontSize: 13,
};
