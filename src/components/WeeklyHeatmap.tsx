"use client";

import { useMemo, useState, useCallback, type MouseEvent } from "react";

interface DailyActivity {
  date: string;
  messageCount: number;
}

interface Props {
  dailyActivity: DailyActivity[];
  hourCounts: Record<string, number>;
}

// Calendar order: Mon–Sun
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
// Map JS getDay() (0=Sun..6=Sat) to our column index (0=Mon..6=Sun)
const JS_DOW_TO_COL = [6, 0, 1, 2, 3, 4, 5];

/** Convert UTC hour (from API) to local hour, accounting for timezone offset. */
function utcHourToLocal(utcHour: number): number {
  // new Date().getTimezoneOffset() returns minutes, negative for east of UTC
  // e.g. UTC+8 → -480, so localHour = utcHour - (-480/60) = utcHour + 8
  const offsetHours = -(new Date().getTimezoneOffset() / 60);
  return ((utcHour + offsetHours) % 24 + 24) % 24;
}

/** Build local hourCounts from UTC hourCounts. */
function toLocalHourCounts(utcCounts: Record<string, number>): Record<string, number> {
  const local: Record<string, number> = {};
  for (const [utcH, count] of Object.entries(utcCounts)) {
    const localH = utcHourToLocal(Number(utcH));
    local[String(localH)] = (local[String(localH)] || 0) + count;
  }
  return local;
}

const RANGES = ['7d', '30d', '90d', 'all'] as const;
type Range = (typeof RANGES)[number];

const RANGE_LABELS: Record<Range, string> = {
  '7d': '7 Days',
  '30d': '30 Days',
  '90d': '90 Days',
  all: 'All',
};

function heatColor(intensity: number): string {
  if (intensity === 0) return '#161b22';
  if (intensity < 0.2) return '#0e4429';
  if (intensity < 0.4) return '#006d32';
  if (intensity < 0.65) return '#26a641';
  return '#39d353';
}

function activityLabel(intensity: number): string {
  if (intensity === 0) return 'No activity';
  if (intensity < 0.2) return 'Low activity';
  if (intensity < 0.65) return 'Medium activity';
  return 'High activity';
}

export default function WeeklyHeatmap({ dailyActivity, hourCounts }: Props) {
  const [range, setRange] = useState<Range>('all');
  const [startHour, setStartHour] = useState(0);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  // Convert UTC hourCounts to local timezone
  const localHourCounts = useMemo(() => toLocalHourCounts(hourCounts), [hourCounts]);

  // Build ordered hour list starting from startHour
  const orderedHours = useMemo(
    () => Array.from({ length: 24 }, (_, i) => (startHour + i) % 24),
    [startHour],
  );

  const { grid, maxCell } = useMemo(() => {
    // Filter dailyActivity by range
    const now = Date.now();
    const cutoff: Record<Range, number> = {
      '7d': now - 7 * 86400_000,
      '30d': now - 30 * 86400_000,
      '90d': now - 90 * 86400_000,
      all: 0,
    };
    const threshold = cutoff[range];
    const filtered = threshold
      ? dailyActivity.filter((d) => new Date(d.date + 'T12:00:00').getTime() >= threshold)
      : dailyActivity;

    // Accumulate message counts per day-of-week (mapped to Mon=0..Sun=6)
    const dayTotals = new Array<number>(7).fill(0);
    for (const d of filtered) {
      const jsDow = new Date(d.date + 'T12:00:00').getDay();
      dayTotals[JS_DOW_TO_COL[jsDow]] += d.messageCount;
    }

    const totalDayMsgs = dayTotals.reduce((s, v) => s + v, 0) || 1;
    const totalHourMsgs = Object.values(localHourCounts).reduce((s, v) => s + v, 0) || 1;

    // Build grid keyed by orderedHours index → [dayCol]
    let mx = 0;
    const g: number[][] = [];
    for (const h of orderedHours) {
      const row: number[] = [];
      for (let col = 0; col < 7; col++) {
        const val =
          (dayTotals[col] / totalDayMsgs) *
          ((localHourCounts[String(h)] ?? 0) / totalHourMsgs);
        if (val > mx) mx = val;
        row.push(val);
      }
      g.push(row);
    }
    return { grid: g, maxCell: mx || 1 };
  }, [dailyActivity, localHourCounts, range, orderedHours]);

  const handleMouseEnter = useCallback(
    (e: MouseEvent<HTMLDivElement>, hour: number, col: number, intensity: number) => {
      const container = (e.currentTarget as HTMLDivElement).closest(
        '.weekly-heatmap-container',
      ) as HTMLElement | null;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top - 10;
      const dayName = DAYS[col];
      const text = `${dayName} ${hour}:00 \u2014 ${activityLabel(intensity)}`;
      setTooltip({ x, y, text });
    },
    [],
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h3 className="text-textPrimary font-semibold mb-4">Activity by Day &amp; Hour</h3>

      {/* Controls: time range + start hour */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 text-xs rounded ${
                range === r
                  ? 'bg-blue-600 text-white'
                  : 'text-textSecondary hover:text-textPrimary'
              }`}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-textSecondary">Start</span>
          <select
            value={startHour}
            onChange={(e) => setStartHour(Number(e.target.value))}
            className="bg-bg border border-border rounded px-2 py-0.5 text-xs text-textPrimary focus:outline-none focus:border-blue-500"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>{`${i}:00`}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="weekly-heatmap-container overflow-x-auto relative">
        {/* Day labels (top) */}
        <div className="flex gap-1 mb-1 ml-10">
          {DAYS.map((day) => (
            <div
              key={day}
              className="w-5 text-center text-textSecondary"
              style={{ fontSize: 10 }}
            >
              {day.charAt(0)}
            </div>
          ))}
        </div>

        {/* Rows = hours (from startHour), Cols = days */}
        {orderedHours.map((h, rowIdx) => (
          <div key={h} className="flex items-center gap-1 mb-1">
            <span className="text-xs text-textSecondary w-9 shrink-0 text-right pr-1">
              {h % 3 === 0 ? `${h}:00` : ''}
            </span>
            {DAYS.map((_, col) => {
              const raw = grid[rowIdx][col];
              const intensity = raw / maxCell;
              return (
                <div
                  key={col}
                  className="w-5 h-5 rounded-sm cursor-default"
                  style={{ backgroundColor: heatColor(intensity) }}
                  onMouseEnter={(e) => handleMouseEnter(e, h, col, intensity)}
                  onMouseLeave={handleMouseLeave}
                />
              );
            })}
          </div>
        ))}

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute bg-[#161b22] border border-[#30363d] text-[#e6edf3] text-xs px-2 py-1 rounded shadow-lg pointer-events-none whitespace-pre-line z-50"
            style={{
              left: tooltip.x,
              top: tooltip.y,
              transform: 'translate(-50%, -100%)',
            }}
          >
            {tooltip.text}
          </div>
        )}
      </div>
    </div>
  );
}
