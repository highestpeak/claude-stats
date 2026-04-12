"use client";

interface DailyActivity {
  date: string;
  messageCount: number;
}

interface Props {
  dailyActivity: DailyActivity[];
  hourCounts: Record<string, number>;
}

const DAYS  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function heatColor(intensity: number): string {
  if (intensity === 0)    return '#161b22';
  if (intensity < 0.2)    return '#0e4429';
  if (intensity < 0.4)    return '#006d32';
  if (intensity < 0.65)   return '#26a641';
  return '#39d353';
}

export default function WeeklyHeatmap({ dailyActivity, hourCounts }: Props) {
  // Accumulate message counts per day-of-week
  const dayTotals = new Array<number>(7).fill(0);
  for (const d of dailyActivity) {
    const dow = new Date(d.date + 'T12:00:00').getDay();
    dayTotals[dow] += d.messageCount;
  }
  const totalDayMsgs = dayTotals.reduce((s, v) => s + v, 0) || 1;
  const totalHourMsgs = Object.values(hourCounts).reduce((s, v) => s + v, 0) || 1;

  // Compute max joint probability for normalization
  let maxCell = 0;
  for (let dow = 0; dow < 7; dow++) {
    for (const h of HOURS) {
      const val = (dayTotals[dow] / totalDayMsgs) * ((hourCounts[String(h)] ?? 0) / totalHourMsgs);
      if (val > maxCell) maxCell = val;
    }
  }
  if (maxCell === 0) maxCell = 1;

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h3 className="text-textPrimary font-semibold mb-4">Activity by Day &amp; Hour</h3>
      <div className="overflow-x-auto">
        {/* Hour labels */}
        <div className="flex gap-1 mb-1 ml-10">
          {HOURS.map((h) => (
            <div key={h} className="w-5 text-center text-textSecondary" style={{ fontSize: 9 }}>
              {h % 6 === 0 ? h : ''}
            </div>
          ))}
        </div>
        {DAYS.map((day, dow) => (
          <div key={day} className="flex items-center gap-1 mb-1">
            <span className="text-xs text-textSecondary w-9 shrink-0">{day}</span>
            {HOURS.map((h) => {
              const raw = (dayTotals[dow] / totalDayMsgs) * ((hourCounts[String(h)] ?? 0) / totalHourMsgs);
              return (
                <div
                  key={h}
                  className="w-5 h-5 rounded-sm"
                  style={{ backgroundColor: heatColor(raw / maxCell) }}
                  title={`${day} ${h}:00`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <p className="text-textSecondary text-xs mt-3">Approximate — derived from day-of-week and hour distributions independently</p>
    </div>
  );
}
