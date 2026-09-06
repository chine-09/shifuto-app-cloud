import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ShiftType } from "@shifuto/shared-core";
import { cellElementId } from "../violations/ViolationsPanel";
import { useClickOutside } from "../../hooks/useClickOutside";

export type CellValue = { shiftType: ShiftType; startTime: string | null; endTime: string | null } | null;

const VIEWPORT_MARGIN = 8;

export function ShiftCell({
  employeeId,
  date,
  value,
  violationMessages,
  editable,
  editing,
  anchor,
  fillPreview = false,
  onOpen,
  onClose,
  onSave,
  onClear,
  onFillHandleMouseDown,
}: {
  employeeId: string;
  date: string;
  value: CellValue;
  violationMessages: string[];
  editable: boolean;
  editing: boolean;
  /** The trigger cell's viewport position at the moment it was opened; set alongside `editing`. */
  anchor?: DOMRect | null;
  fillPreview?: boolean;
  /** Called with the trigger cell's viewport position, used to anchor the portal-rendered popover. */
  onOpen: (anchor: DOMRect) => void;
  onClose: () => void;
  onSave: (next: { shiftType: ShiftType; startTime: string | null; endTime: string | null }) => void;
  onClear: () => void;
  onFillHandleMouseDown?: () => void;
}) {
  const cellRef = useRef<HTMLDivElement>(null);

  const hasViolation = violationMessages.length > 0;

  function openHere() {
    if (!cellRef.current) return;
    onOpen(cellRef.current.getBoundingClientRect());
  }

  if (!editing) {
    const label =
      value?.shiftType === "work"
        ? `${value.startTime?.slice(0, 5)}-${value.endTime?.slice(0, 5)}`
        : value?.shiftType === "leave"
          ? "有休"
          : value?.shiftType === "off"
            ? "休"
            : "";

    return (
      <div
        ref={cellRef}
        id={cellElementId(employeeId, date)}
        role="button"
        tabIndex={editable ? 0 : -1}
        onClick={() => {
          if (!editable) return;
          openHere();
        }}
        onKeyDown={(e) => {
          if (!editable) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openHere();
          }
        }}
        className={`group relative h-full w-full px-1 py-1 text-center text-sm transition-shadow ${
          editable ? "cursor-pointer hover:bg-blue-50" : "cursor-default"
        } ${hasViolation ? "outline outline-2 outline-offset-[-2px] outline-red-500 bg-red-50" : ""} ${
          fillPreview ? "bg-blue-100 outline outline-1 outline-dashed outline-blue-400" : ""
        }`}
        title={hasViolation ? violationMessages.join("\n") : undefined}
      >
        {label || <span className="text-zinc-300">-</span>}
        {hasViolation && (
          <span aria-hidden className="absolute right-0.5 top-0.5 text-xs leading-none text-red-600">
            ⚠
          </span>
        )}
        {editable && onFillHandleMouseDown && (
          <div
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onFillHandleMouseDown();
            }}
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-0 right-0 h-1.5 w-1.5 cursor-crosshair bg-blue-600 opacity-0 group-hover:opacity-100"
          />
        )}
      </div>
    );
  }

  if (!anchor) return null;

  return <EditingPopover value={value} onClose={onClose} onSave={onSave} onClear={onClear} anchor={anchor} />;
}

function EditingPopover({
  value,
  onClose,
  onSave,
  onClear,
  anchor,
}: {
  value: CellValue;
  onClose: () => void;
  onSave: (next: { shiftType: ShiftType; startTime: string | null; endTime: string | null }) => void;
  onClear: () => void;
  anchor: DOMRect;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  useClickOutside(popoverRef, true, onClose);
  const [shiftType, setShiftType] = useState<ShiftType>(value?.shiftType ?? "work");
  const [start, setStart] = useState(value?.startTime?.slice(0, 5) ?? "09:00");
  const [end, setEnd] = useState(value?.endTime?.slice(0, 5) ?? "17:00");
  const [style, setStyle] = useState<{ top: number; left: number; visibility: "hidden" | "visible" }>({
    top: 0,
    left: 0,
    visibility: "hidden",
  });

  // Measure after the real popover size is known (both dimensions vary with
  // font size/zoom, and height also varies with shiftType), then flip above
  // the cell / clamp horizontally so it always stays on-screen instead of
  // being clipped by the table's scroll container.
  useLayoutEffect(() => {
    const popover = popoverRef.current;
    if (!popover) return;

    const popoverHeight = popover.offsetHeight;
    const popoverWidth = popover.offsetWidth;
    const fitsBelow = anchor.bottom + popoverHeight + VIEWPORT_MARGIN <= window.innerHeight;
    const top = fitsBelow ? anchor.bottom : anchor.top - popoverHeight;
    const left = Math.min(
      Math.max(anchor.left, VIEWPORT_MARGIN),
      window.innerWidth - popoverWidth - VIEWPORT_MARGIN,
    );
    setStyle({ top, left, visibility: "visible" });
  }, [shiftType, anchor]);

  // The anchor rect is captured once at open time and doesn't track the
  // table's own scrolling, so instead of drifting away from the cell it was
  // opened for, close on any scroll (capture phase catches the table's
  // horizontally-scrolling container too, not just window-level scroll).
  // The scroll listener is attached a frame late so it doesn't catch a
  // scroll-into-view that was still settling from the click that opened
  // this popover in the first place (e.g. a cell near the bottom of a short
  // viewport) — otherwise the popover could close itself immediately.
  useEffect(() => {
    let attached = false;
    const raf = requestAnimationFrame(() => {
      attached = true;
      window.addEventListener("scroll", handleScroll, true);
    });
    function handleScroll() {
      onClose();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      if (attached) window.removeEventListener("scroll", handleScroll, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  function handleClear() {
    onClear();
    onClose();
  }

  function handleSave() {
    onSave({
      shiftType,
      startTime: shiftType === "work" ? start : null,
      endTime: shiftType === "work" ? end : null,
    });
    onClose();
  }

  return createPortal(
    <div
      ref={popoverRef}
      style={{ position: "fixed", top: style.top, left: style.left, visibility: style.visibility }}
      className="z-20 flex w-max flex-col gap-1.5 rounded-md border border-zinc-300 bg-white p-2 text-sm shadow-lg"
    >
      <div className="flex gap-1">
        {(["work", "leave", "off"] as ShiftType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setShiftType(t)}
            className={`whitespace-nowrap rounded px-1.5 py-0.5 ${
              shiftType === t ? "bg-blue-600 text-white" : "bg-zinc-100 text-zinc-600"
            }`}
          >
            {t === "work" ? "勤務" : t === "leave" ? "有休" : "休"}
          </button>
        ))}
      </div>
      {shiftType === "work" && (
        <div className="flex items-center gap-1">
          <input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-full rounded border border-zinc-300 px-1 py-0.5"
          />
          〜
          <input
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="w-full rounded border border-zinc-300 px-1 py-0.5"
          />
        </div>
      )}
      <div className="flex justify-between gap-1">
        <button
          type="button"
          onClick={handleClear}
          className="whitespace-nowrap rounded px-1.5 py-0.5 text-red-500 hover:bg-red-50"
        >
          クリア
        </button>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onClose}
            className="whitespace-nowrap rounded px-1.5 py-0.5 text-zinc-500 hover:bg-zinc-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="whitespace-nowrap rounded bg-blue-600 px-1.5 py-0.5 text-white hover:bg-blue-700"
          >
            保存
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
