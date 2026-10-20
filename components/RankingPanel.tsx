'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { fetchTopScores, type ScoreRow } from '@/lib/db';

interface RankingPanelProps {
  /** 값이 바뀌면 다시 불러옴 */
  refreshKey: number;
  highlightName?: string;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function RankingPanel({ refreshKey, highlightName }: RankingPanelProps) {
  const [rows, setRows] = useState<ScoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchTopScores(10));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="neon-text-yellow text-sm font-black tracking-widest">🏆 TOP 10</h3>
        <button className="text-xs text-muted hover:text-neon-cyan" onClick={load} disabled={loading}>
          {loading ? '불러오는 중…' : '↻ 새로고침'}
        </button>
      </div>

      {error && <p className="text-xs text-neon-magenta">{error}</p>}

      {!error && !loading && rows.length === 0 && (
        <p className="py-6 text-center text-sm text-muted">아직 기록이 없습니다. 첫 번째 기록을 남겨보세요!</p>
      )}

      <ol className="space-y-1.5">
        {rows.map((r, i) => {
          const mine = highlightName && r.player_name === highlightName;
          return (
            <li
              key={r.id}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm ${
                mine ? 'bg-neon-cyan/10 ring-1 ring-neon-cyan/50' : 'bg-panel-2/60'
              }`}
            >
              <span className="w-7 text-center font-mono text-xs text-muted">
                {i < 3 ? MEDALS[i] : i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium" title={r.player_name}>
                {r.player_name}
              </span>
              <span className="font-mono text-base font-bold text-neon-yellow">{r.score.toLocaleString()}</span>
              <span className="w-10 text-right font-mono text-[11px] text-neon-green">Lv{r.level}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
