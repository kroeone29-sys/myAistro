import { useState, useEffect, useCallback } from "react";

export default function SotBrowser() {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState({});

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/sot");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setEntries(data);
    } catch (e) {
      setError(e.message ?? String(e));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const f = filter.toLowerCase().trim();
  const visible = (entries ?? []).filter((e) => {
    if (!f) return true;
    return (
      (e.course ?? "").toLowerCase().includes(f) ||
      (e.lesson ?? "").toLowerCase().includes(f) ||
      (e.summary ?? "").toLowerCase().includes(f) ||
      (e.key_concepts ?? []).some((k) => k.toLowerCase().includes(f))
    );
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        paddingTop: 80,
        paddingBottom: 24,
        paddingLeft: 24,
        paddingRight: 24,
        overflowY: "auto",
        zIndex: 5,
      }}
    >
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <input
            type="text"
            placeholder="Filter by course, lesson, summary, or concept…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              flex: 1,
              padding: "10px 14px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 8,
              color: "white",
              outline: "none",
              fontSize: 14,
            }}
          />
          <button
            onClick={refresh}
            style={{
              padding: "10px 16px",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 8,
              color: "white",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Refresh
          </button>
        </div>

        {entries && (
          <div
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.45)",
              marginBottom: 10,
            }}
          >
            {visible.length} of {entries.length} entries
          </div>
        )}

        {error && (
          <div style={{ color: "#ef4444", fontSize: 14 }}>{error}</div>
        )}
        {!entries && !error && (
          <div style={{ color: "rgba(255,255,255,0.5)" }}>Loading…</div>
        )}
        {entries && entries.length === 0 && (
          <div style={{ color: "rgba(255,255,255,0.5)" }}>
            SOT is empty. Switch to Ingest to add a lesson.
          </div>
        )}

        {visible.map((entry) => (
          <EntryCard
            key={entry.event_id}
            entry={entry}
            expanded={!!expanded[entry.event_id]}
            onToggle={() =>
              setExpanded((prev) => ({
                ...prev,
                [entry.event_id]: !prev[entry.event_id],
              }))
            }
          />
        ))}
      </div>
    </div>
  );
}

function EntryCard({ entry, expanded, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{
        background: "rgba(8,10,16,0.7)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        padding: 16,
        marginBottom: 10,
        cursor: "pointer",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            {entry.course} · week {entry.week}
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>
            {entry.lesson}
          </div>
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
          {entry.created_at?.slice(0, 10)}
        </div>
      </div>

      <div
        style={{
          marginTop: 10,
          color: "rgba(255,255,255,0.85)",
          fontSize: 14,
          lineHeight: 1.5,
        }}
      >
        {entry.summary}
      </div>

      {expanded && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {entry.key_concepts?.length > 0 && (
            <Section label="key concepts">
              {entry.key_concepts.join(" · ")}
            </Section>
          )}
          {entry.definitions?.length > 0 && (
            <Section label="definitions">
              {entry.definitions.map((d, i) => (
                <div key={i} style={{ marginTop: i === 0 ? 0 : 4 }}>
                  · {d}
                </div>
              ))}
            </Section>
          )}
          {entry.code_blocks?.length > 0 && (
            <Section label="code">
              {entry.code_blocks.map((c, i) => (
                <pre
                  key={i}
                  style={{
                    background: "rgba(0,0,0,0.4)",
                    padding: 10,
                    borderRadius: 6,
                    overflowX: "auto",
                    fontSize: 12,
                    margin: i === 0 ? 0 : "8px 0 0 0",
                  }}
                >
                  {c}
                </pre>
              ))}
            </Section>
          )}
          <div
            style={{
              marginTop: 12,
              fontSize: 11,
              color: "rgba(255,255,255,0.4)",
            }}
          >
            event_id: {entry.event_id} · score: {entry.validation_score}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "rgba(255,255,255,0.5)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ color: "rgba(255,255,255,0.78)", fontSize: 13 }}>
        {children}
      </div>
    </div>
  );
}
