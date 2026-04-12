"use client";

import { useMemo } from "react";
import { format, subWeeks, addDays, startOfWeek, isSameDay, getMonth } from "date-fns";

interface DailyActivity {
  date: string;
  messageCount: number;
  sessionCount: number;
  toolCallCount: number;
}

interface Props {
  dailyActivity: DailyActivity[];
}

const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getColor(count: number, max: number): string {
  if (count === 0) return "#161b22";
  const ratio = count / max;
  if (ratio < 0.25) return "#0e4429";
  if (ratio < 0.5) return "#006d32";
  if (ratio < 0.75) return "#26a641";
  return "#39d353";
}

export default function ActivityHeatmap({ dailyActivity }: Props) {
  const { weeks, maxCount, monthLabels } = useMemo(() => {
    const activityMap = new Map<string, number>();
    let max = 1;
    for (const d of dailyActivity) {
      activityMap.set(d.date, d.messageCount);
      if (d.messageCount > max) max = d.messageCount;
    }

    const today = new Date();
    const numWeeks = 16;
    const start = startOfWeek(subWeeks(today, numWeeks - 1), { weekStartsOn: 0 });

    const weeksArr: { date: Date; count: number }[][] = [];
    const labels: { label: string; col: number }[] = [];
    let lastMonth = -1;

    for (let w = 0; w < numWeeks; w++) {
      const week: { date: Date; count: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const date = addDays(start, w * 7 + d);
        const key = format(date, "yyyy-MM-dd");
        const count = activityMap.get(key) || 0;
        week.push({ date, count });

        if (d === 0) {
          const m = getMonth(date);
          if (m !== lastMonth) {
            labels.push({ label: MONTH_NAMES[m], col: w });
            lastMonth = m;
          }
        }
      }
      weeksArr.push(week);
    }

    return { weeks: weeksArr, maxCount: max, monthLabels: labels };
  }, [dailyActivity]);

  const cellSize = 14;
  const gap = 3;
  const leftPad = 32;
  const topPad = 20;

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h3 className="text-textPrimary font-semibold mb-4">Activity Heatmap</h3>
      <div className="overflow-x-auto">
        <svg
          width={leftPad + weeks.length * (cellSize + gap)}
          height={topPad + 7 * (cellSize + gap)}
        >
          {/* Month labels */}
          {monthLabels.map((m, i) => (
            <text
              key={i}
              x={leftPad + m.col * (cellSize + gap)}
              y={12}
              fontSize={10}
              fill="#8b949e"
            >
              {m.label}
            </text>
          ))}
          {/* Day labels */}
          {DAY_LABELS.map((label, i) => (
            <text
              key={i}
              x={0}
              y={topPad + i * (cellSize + gap) + cellSize - 2}
              fontSize={10}
              fill="#8b949e"
            >
              {label}
            </text>
          ))}
          {/* Cells */}
          {weeks.map((week, wi) =>
            week.map((day, di) => (
              <rect
                key={`${wi}-${di}`}
                x={leftPad + wi * (cellSize + gap)}
                y={topPad + di * (cellSize + gap)}
                width={cellSize}
                height={cellSize}
                rx={2}
                fill={getColor(day.count, maxCount)}
              >
                <title>
                  {format(day.date, "MMM d, yyyy")}: {day.count} messages
                </title>
              </rect>
            ))
          )}
        </svg>
      </div>
    </div>
  );
}
