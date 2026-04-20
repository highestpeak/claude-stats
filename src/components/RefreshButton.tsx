'use client';
import { useState, useEffect } from 'react';

export default function RefreshButton() {
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(d => setLastUpdated(d.lastUpdated || null))
      .catch(() => {});
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await fetch('/api/collect', { method: 'POST' });
      setLastUpdated(new Date().toISOString());
      window.location.reload();
    } catch (e) {
      console.error('Refresh failed:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 text-sm">
      {lastUpdated && (
        <span className="text-textSecondary text-xs">
          Updated {new Date(lastUpdated).toLocaleString()}
        </span>
      )}
      <button
        onClick={handleRefresh}
        disabled={loading}
        className="px-3 py-1 text-xs rounded border border-border text-textSecondary hover:text-textPrimary hover:border-textSecondary disabled:opacity-50 transition-colors"
      >
        {loading ? 'Refreshing...' : 'Refresh'}
      </button>
    </div>
  );
}
