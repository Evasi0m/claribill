"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";

/** Inline editable number — click the value to edit, Enter/blur to commit,
 *  Esc to cancel. Used everywhere a money value can be tweaked (gross
 *  sales, fees, label price, individual fee items). */
export function EditableNumber({
  value,
  valuePrefix = "",
  valueAbs = false,
  valueColor,
  className,
  style,
  onCommit,
  fmt,
  readOnly,
}: {
  value: number;
  valuePrefix?: string;
  valueAbs?: boolean;
  valueColor?: string;
  className?: string;
  style?: React.CSSProperties;
  onCommit?: (n: number) => void;
  fmt: (n: number) => string;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Sync draft from parent when not actively editing
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const n = Number(draft);
    if (Number.isFinite(n) && n >= 0) {
      onCommit?.(n);
    }
    setEditing(false);
  };

  if (readOnly || !onCommit) {
    return (
      <span className={className} style={{ color: valueColor, ...style }}>
        {valuePrefix}
        {fmt(valueAbs ? Math.abs(value) : value)}
      </span>
    );
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        inputMode="decimal"
        step="0.01"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(String(value));
            setEditing(false);
          }
        }}
        className={className}
        style={{
          ...style,
          color: valueColor ?? "var(--text-primary)",
          background: "color-mix(in oklab, var(--warm-sand) 30%, transparent)",
          border: "1px solid var(--terracotta)",
          borderRadius: 8,
          padding: "2px 8px",
          outline: "none",
          width: "100%",
          fontVariantNumeric: "tabular-nums",
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`${className ?? ""} text-left group relative inline-flex items-center gap-1`}
      style={{
        color: valueColor,
        cursor: "text",
        ...style,
      }}
      title="คลิกเพื่อแก้ไข"
    >
      <span>
        {valuePrefix}
        {fmt(valueAbs ? Math.abs(value) : value)}
      </span>
      <Pencil
        size={10}
        className="opacity-0 group-hover:opacity-50 transition-opacity shrink-0"
        style={{ color: "var(--text-tertiary)" }}
      />
    </button>
  );
}

/** Inline editable text — used for fee item names. Empty input is rejected
 *  on commit so a misclicked-and-cleared field doesn't wipe the AI's
 *  extraction. */
export function EditableText({
  value,
  onCommit,
  className,
  style,
}: {
  value: string;
  onCommit: (v: string) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Sync draft from parent when not actively editing
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const v = draft.trim();
    if (v) onCommit(v);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className={className}
        style={{
          ...style,
          background: "color-mix(in oklab, var(--warm-sand) 30%, transparent)",
          border: "1px solid var(--terracotta)",
          borderRadius: 8,
          padding: "2px 8px",
          outline: "none",
          width: "100%",
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`${className ?? ""} text-left group inline-flex items-center gap-1`}
      style={{ cursor: "text", ...style }}
      title="คลิกเพื่อแก้ไข"
    >
      <span>{value}</span>
      <Pencil
        size={10}
        className="opacity-0 group-hover:opacity-50 transition-opacity shrink-0"
        style={{ color: "var(--text-tertiary)" }}
      />
    </button>
  );
}
