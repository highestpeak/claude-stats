"use client";
import { formatNumber } from "@/lib/utils";

interface CurrentStatusData {
  latestWindow: {
    start_time: string;
    window_close_time: string;
    total_tokens: number;
    request_count: number;
    active_duration_sec: number;
  } | null;
  peakWindowTokens: number;
  weeklyTokens: number;
  weeklyRequests: number;
  weeklyWindows: number;
  peakWeeklyTokens: number;
  rateLimitHits: number;
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full h-2 bg-border rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

function timeRemaining(closeTime: string): string {
  const diff = new Date(closeTime).getTime() - Date.now();
  if (diff <= 0) return "expired";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m`;
}

export default function CurrentStatus({ data }: { data: CurrentStatusData }) {
  const w = data.latestWindow;
  const windowActive = w && new Date(w.window_close_time).getTime() > Date.now();

  return (
    <div className="bg-card rounded-xl p-4 space-y-4">
      <h2 className="text-sm font-medium text-textSecondary">Current Status</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 5h Window */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-textSecondary">5-Hour Window</span>
            {windowActive && (
              <span className="text-xs text-blue-400">
                resets in {timeRemaining(w!.window_close_time)}
              </span>
            )}
            {!windowActive && w && (
              <span className="text-xs text-green-400">idle</span>
            )}
          </div>
          <ProgressBar
            value={w?.total_tokens ?? 0}
            max={data.peakWindowTokens || 1}
            color={windowActive ? "#3b82f6" : "#22c55e"}
          />
          <div className="flex justify-between text-xs text-textSecondary">
            <span>{formatNumber(w?.total_tokens ?? 0)} tokens</span>
            <span>{w?.request_count ?? 0} requests</span>
            <span>peak: {formatNumber(data.peakWindowTokens)}</span>
          </div>
        </div>

        {/* Weekly */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-textSecondary">This Week (7 days)</span>
            <span className="text-xs text-textSecondary">
              {data.weeklyWindows} windows
            </span>
          </div>
          <ProgressBar
            value={data.weeklyTokens}
            max={data.peakWeeklyTokens || 1}
            color="#a855f7"
          />
          <div className="flex justify-between text-xs text-textSecondary">
            <span>{formatNumber(data.weeklyTokens)} tokens</span>
            <span>{formatNumber(data.weeklyRequests)} requests</span>
            <span>peak wk: {formatNumber(data.peakWeeklyTokens)}</span>
          </div>
        </div>
      </div>

      {data.rateLimitHits > 0 && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-yellow-500">Rate limited {data.rateLimitHits} time{data.rateLimitHits > 1 ? 's' : ''} (all time)</span>
        </div>
      )}
    </div>
  );
}
