// src/components/layout/Section.tsx
import type { ReactNode } from "react";

export function Section(props: {
  title: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onHide?: () => void;
  children: ReactNode;
}) {
  const { title, collapsed, onToggleCollapsed, onHide, children } = props;

  return (
    <section
      style={{
        border: "1px solid #ddd",
        borderRadius: 10,
        padding: 12,
        marginBottom: 12,
        background: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontWeight: 800 }}>{title}</div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={onToggleCollapsed} style={{ cursor: "pointer" }}>
            {collapsed ? "展開" : "收合"}
          </button>
          {onHide && (
            <button onClick={onHide} style={{ cursor: "pointer" }}>
              隱藏
            </button>
          )}
        </div>
      </div>

      {!collapsed && <div style={{ marginTop: 10 }}>{children}</div>}
    </section>
  );
}
