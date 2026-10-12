"use client";
import { Eraser, Hand, Maximize2, Minimize2, Sun } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { minuteLabel, WEEKDAYS_SHORT } from "@/lib/time";
import type { WorkingHours } from "@/lib/types";
import { Button } from "@/components/ui/button";

type Hours = Array<Pick<WorkingHours, "weekday" | "startMinute" | "endMinute">>;
const STEP = 30;
const ROWS = 48;
type Grid = boolean[][]; // [weekday][row]

function toGrid(hours: Hours): Grid {
  const g: Grid = Array.from({ length: 7 }, () => Array<boolean>(ROWS).fill(false));
  for (const h of hours) {
    const from = Math.floor(h.startMinute / STEP);
    const to = Math.ceil(Math.min(h.endMinute, 1440) / STEP);
    for (let r = from; r < to; r++) g[h.weekday]![r] = true;
  }
  return g;
}

export function gridToHours(g: Grid): Hours {
  const out: Hours = [];
  g.forEach((col, weekday) => {
    let start = -1;
    for (let r = 0; r <= ROWS; r++) {
      const on = r < ROWS && col[r];
      if (on && start < 0) start = r;
      if (!on && start >= 0) {
        out.push({ weekday, startMinute: start * STEP, endMinute: r * STEP });
        start = -1;
      }
    }
  });
  return out;
}

function summarize(col: boolean[]) {
  const parts: string[] = [];
  let start = -1;
  for (let r = 0; r <= ROWS; r++) {
    const on = r < ROWS && col[r];
    if (on && start < 0) start = r;
    if (!on && start >= 0) {
      parts.push(`${minuteLabel(start * STEP)}–${minuteLabel(r * STEP)}`);
      start = -1;
    }
  }
  return parts;
}

interface Props {
  initial: Hours;
  /** Changing this re-seeds the grid from `initial` (e.g. when another staff member is selected). */
  resetKey: string;
  onChange: (hours: Hours) => void;
  disabled?: boolean;
}

export function HoursEditor({ initial, resetKey, onChange, disabled }: Props) {
  const [grid, setGrid] = useState<Grid>(() => toGrid(initial));
  const [focus, setFocus] = useState({ d: 1, r: 18 });
  const [full, setFull] = useState(false);
  const [paintTouch, setPaintTouch] = useState(false);
  const drag = useRef<{ mode: boolean } | null>(null);
  const kbMode = useRef<boolean | null>(null);
  const gridRef = useRef<Grid>(grid);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const g = toGrid(initial);
    gridRef.current = g;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGrid(g);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const [lo, hi] = useMemo(() => {
    if (full) return [0, ROWS];
    let a = 12;
    let b = 44;
    grid.forEach((col) =>
      col.forEach((on, r) => {
        if (on) {
          a = Math.min(a, Math.floor(r / 2) * 2);
          b = Math.max(b, Math.ceil((r + 1) / 2) * 2);
        }
      }),
    );
    return [a, b];
  }, [grid, full]);
  const rows = Array.from({ length: hi - lo }, (_, i) => lo + i);

  const commit = useCallback(() => onChange(gridToHours(gridRef.current)), [onChange]);

  const setCell = useCallback((d: number, r: number, on: boolean) => {
    if (gridRef.current[d]![r] === on) return;
    const next = gridRef.current.map((c) => c.slice());
    next[d]![r] = on;
    gridRef.current = next;
    setGrid(next);
  }, []);

  function cellFromPoint(x: number, y: number) {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-cell]");
    if (!el || !rootRef.current?.contains(el)) return null;
    return { d: Number(el.dataset.d), r: Number(el.dataset.r) };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (disabled || e.button > 0) return;
    const c = cellFromPoint(e.clientX, e.clientY);
    if (!c) return;
    e.preventDefault();
    const mode = !gridRef.current[c.d]![c.r];
    drag.current = { mode };
    setFocus(c);
    setCell(c.d, c.r, mode);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const c = cellFromPoint(e.clientX, e.clientY);
    if (c) {
      setFocus(c);
      setCell(c.d, c.r, drag.current.mode);
    }
  }
  function endDrag() {
    if (!drag.current) return;
    drag.current = null;
    commit();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    const move: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      const on = !gridRef.current[focus.d]![focus.r];
      kbMode.current = on;
      setCell(focus.d, focus.r, on);
      commit();
      return;
    }
    const m = move[e.key];
    if (!m) return;
    e.preventDefault();
    const d = Math.min(6, Math.max(0, focus.d + m[0]));
    const r = Math.min(hi - 1, Math.max(lo, focus.r + m[1]));
    setFocus({ d, r });
    if (e.shiftKey) {
      setCell(d, r, kbMode.current ?? gridRef.current[focus.d]![focus.r]!);
      commit();
    }
    requestAnimationFrame(() => rootRef.current?.querySelector<HTMLElement>(`[data-d="${d}"][data-r="${r}"]`)?.focus());
  }

  function preset() {
    const next: Grid = Array.from({ length: 7 }, (_, d) => Array.from({ length: ROWS }, (_, r) => d >= 1 && d <= 5 && r >= 18 && r < 34));
    gridRef.current = next;
    setGrid(next);
    commit();
  }
  function clear() {
    const next: Grid = Array.from({ length: 7 }, () => Array<boolean>(ROWS).fill(false));
    gridRef.current = next;
    setGrid(next);
    commit();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="soft" size="sm" onClick={preset} disabled={disabled}>
          <Sun className="size-3.5" aria-hidden /> Weekdays 9 AM – 5 PM
        </Button>
        <Button variant="quiet" size="sm" onClick={clear} disabled={disabled}>
          <Eraser className="size-3.5" aria-hidden /> Clear week
        </Button>
        <Button variant="quiet" size="sm" onClick={() => setFull((f) => !f)}>
          {full ? <Minimize2 className="size-3.5" aria-hidden /> : <Maximize2 className="size-3.5" aria-hidden />}
          {full ? "Fewer hours" : "Show 24 hours"}
        </Button>
        <Button
          variant={paintTouch ? "teal" : "quiet"}
          size="sm"
          aria-pressed={paintTouch}
          onClick={() => setPaintTouch((v) => !v)}
          className="hidden [@media(pointer:coarse)]:inline-flex"
        >
          <Hand className="size-3.5" aria-hidden /> Draw with finger
        </Button>
      </div>
      <p className="mb-3 text-sm text-ink-2">
        Drag across the grid to mark when this person works. Drag over marked time to clear it. Keyboard: arrows move, space toggles, shift + arrows paints.
      </p>

      <div className="overflow-x-auto">
        <div className="min-w-[32rem]">
          <div className="grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] gap-x-1">
            <div />
            {WEEKDAYS_SHORT.map((w, d) => {
              const parts = summarize(grid[d]!);
              return (
                <div key={w} className="pb-2 text-center">
                  <div className="text-sm font-semibold">{w}</div>
                  <div className={cn("min-h-8 text-[0.68rem] leading-tight", parts.length ? "text-teal-fg" : "text-ink-2/70")}>
                    {parts.length ? parts.map((p) => <div key={p}>{p}</div>) : "Off"}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            ref={rootRef}
            role="grid"
            aria-label="Weekly working hours"
            aria-multiselectable
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={onKeyDown}
            style={{ touchAction: paintTouch ? "none" : "pan-y" }}
            className={cn("grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] gap-x-1 select-none", disabled && "opacity-60")}
          >
            <div className="grid" style={{ gridTemplateRows: `repeat(${rows.length}, 1.375rem)` }} aria-hidden>
              {rows.map((r) => (
                <div key={r} className="-mt-2 pr-2 text-right text-[0.7rem] text-ink-2 tnum">
                  {r % 2 === 0 ? minuteLabel(r * STEP) : ""}
                </div>
              ))}
            </div>
            {WEEKDAYS_SHORT.map((w, d) => (
              <div key={w} role="row" className="grid" style={{ gridTemplateRows: `repeat(${rows.length}, 1.375rem)` }}>
                {rows.map((r) => {
                  const on = grid[d]![r]!;
                  const above = r > lo && grid[d]![r - 1];
                  const below = r < hi - 1 && grid[d]![r + 1];
                  const hourLine = r % 2 === 0;
                  return (
                    <div
                      key={r}
                      role="gridcell"
                      aria-selected={on}
                      aria-label={`${w} ${minuteLabel(r * STEP)}`}
                      tabIndex={focus.d === d && focus.r === r ? 0 : -1}
                      data-cell
                      data-d={d}
                      data-r={r}
                      onFocus={() => setFocus({ d, r })}
                      className={cn(
                        "relative cursor-pointer transition-colors duration-100",
                        on ? "bg-teal" : "bg-sunken/70 hover:bg-teal-soft",
                        hourLine && !on && "border-t border-line",
                        on && !above && "rounded-t-xl",
                        on && !below && "rounded-b-xl",
                        !on && "first:rounded-t-xl last:rounded-b-xl",
                      )}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
