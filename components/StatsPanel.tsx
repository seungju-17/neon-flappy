'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { fetchGameStats, fetchMyScores, type GameStats, type ScoreRow } from '@/lib/db';

interface StatsPanelProps {
  refreshKey: number;
  playerName: string;
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg bg-panel-2/60 px-3 py-2.5">
      <div className="text-[11px] tracking-wider text-muted">{label}</div>
      <div className={`font-mono text-xl font-bold ${accent ?? 'text-text'}`}>{value}</div>
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function StatsPanel({ refreshKey, playerName }: StatsPanelProps) {
  const [stats, setStats] = useState<GameStats | null>(null);
  const [mine, setMine] = useState<ScoreRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, m] = await Promise.all([
        fetchGameStats(),
        playerName ? fetchMyScores(playerName, 10) : Promise.resolve([] as ScoreRow[]),
      ]);
      setStats(s);
      setMine(m);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [playerName]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const myBest = mine.reduce((b, r) => Math.max(b, r.score), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="neon-text-yellow text-sm font-black tracking-widest">📊 STATS</h3>
        <button className="text-xs text-muted hover:text-neon-cyan" onClick={load} disabled={loading}>
          {loading ? '불러오는 중…' : '↻ 새로고침'}
        </button>
      </div>

      {error && <p className="text-xs text-neon-magenta">{error}</p>}

      {stats && (
        <div className="grid grid-cols-2 gap-2">
          <Stat label="총 플레이" value={stats.total_plays.toLocaleString()} />
          <Stat label="플레이어 수" value={stats.total_players.toLocaleString()} />
          <Stat label="평균 점수" value={stats.avg_score.toLocaleString()} accent="text-neon-cyan" />
          <Stat label="최고 점수" value={stats.best_score.toLocaleString()} accent="text-neon-yellow" />
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-bold tracking-wider text-neon-cyan">
            내 기록 {playerName && <span className="text-muted">— {playerName}</span>}
          </h4>
          {mine.length > 0 && (
            <span className="text-[11px] text-muted">
              최고 <span className="font-mono text-neon-yellow">{myBest}</span>
            </span>
          )}
        </div>
        {!playerName && <p className="text-xs text-muted">닉네임을 입력하면 내 기록을 볼 수 있습니다.</p>}
        {playerName && !loading && mine.length === 0 && (
          <p className="text-xs text-muted">아직 저장된 기록이 없습니다.</p>
        )}
        <ul className="thin-scroll max-h-[260px] space-y-1 overflow-y-auto pr-1">
          {mine.map((r) => (
            <li key={r.id} className="flex items-center gap-2 rounded-md bg-panel-2/60 px-2.5 py-1.5 text-xs">
              <span className="font-mono text-muted">{formatDate(r.created_at)}</span>
              <span className="flex-1" />
              <span className="font-mono text-neon-green">Lv{r.level}</span>
              <span className="font-mono text-muted">{r.duration_sec}s</span>
              <span className="w-12 text-right font-mono text-sm font-bold text-neon-yellow">{r.score}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
