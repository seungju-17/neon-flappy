'use client';

import React, { useCallback, useState } from 'react';
import FlappyGame, { type GameResult, type GameStatus } from '@/components/FlappyGame';
import RankingPanel from '@/components/RankingPanel';
import ReviewsPanel from '@/components/ReviewsPanel';
import StatsPanel from '@/components/StatsPanel';
import { fetchRankOf, insertScore } from '@/lib/db';
import { useLocalStorage } from '@/lib/useLocalStorage';

type Tab = 'ranking' | 'reviews' | 'stats';

const NAME_KEY = 'neon-flappy:name';
const BEST_KEY = 'neon-flappy:best';
const MUTE_KEY = 'neon-flappy:muted';

interface LastResult extends GameResult {
  rank?: number;
  saved: 'saving' | 'ok' | 'error';
  message?: string;
}

export default function GameApp() {
  const [name, setName] = useLocalStorage(NAME_KEY);
  const [bestStr, setBestStr] = useLocalStorage(BEST_KEY, '0');
  const best = Number(bestStr) || 0;
  const [nameInput, setNameInput] = useState<string | null>(null);
  const nameValue = nameInput ?? name;
  const [mutedStr, setMutedStr] = useLocalStorage(MUTE_KEY, '0');
  const muted = mutedStr === '1';
  const [status, setStatus] = useState<GameStatus>('idle');
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(1);
  const [tab, setTab] = useState<Tab>('ranking');
  const [refreshKey, setRefreshKey] = useState(0);
  const [last, setLast] = useState<LastResult | null>(null);

  const commitName = () => {
    const n = nameValue.trim().slice(0, 20);
    setName(n);
    setNameInput(null);
  };

  const onHudChange = useCallback((s: number, l: number, lv: number) => {
    setScore(s);
    setLevel(l);
    setLives(lv);
  }, []);

  const onGameOver = useCallback(
    async (result: GameResult) => {
      setLast({ ...result, saved: 'saving' });
      if (result.score > best) setBestStr(String(result.score));
      try {
        await insertScore({
          player_name: name,
          score: result.score,
          level: result.level,
          duration_sec: result.durationSec,
        });
        const rank = await fetchRankOf(result.score);
        setLast({ ...result, rank, saved: 'ok' });
        setRefreshKey((k) => k + 1);
      } catch (e) {
        setLast({ ...result, saved: 'error', message: (e as Error).message });
      }
    },
    [name, best, setBestStr],
  );

  const onStatusChange = useCallback((s: GameStatus) => {
    setStatus(s);
    if (s === 'running' || s === 'idle') setLast(null);
  }, []);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:py-8">
      <header className="mb-6 text-center">
        <h1 className="neon-text-cyan text-4xl font-black tracking-[0.3em] md:text-5xl">NEON FLAPPY</h1>
        <p className="mt-2 text-xs tracking-widest text-muted">
          점수는 Supabase에 저장되며 모든 플레이어와 랭킹을 겨룹니다 · 🔊 소리를 켜고 플레이하세요
        </p>
      </header>

      <div className="grid gap-5 md:grid-cols-[180px_minmax(0,1fr)_320px] md:items-start">
        {/* 왼쪽: 상태 */}
        <aside className="neon-panel order-2 space-y-3 p-4 md:order-1">
          <div>
            <div className="text-[11px] tracking-widest text-muted">PLAYER</div>
            <div className="truncate font-semibold">{name || <span className="text-muted">—</span>}</div>
          </div>
          <div>
            <div className="text-[11px] tracking-widest text-muted">SCORE</div>
            <div className="neon-text-yellow font-mono text-3xl font-black">{score}</div>
          </div>
          <div>
            <div className="text-[11px] tracking-widest text-muted">LEVEL</div>
            <div className="font-mono text-2xl font-bold text-neon-green">{level}</div>
          </div>
          <div>
            <div className="text-[11px] tracking-widest text-muted">LIVES</div>
            <div className="neon-text-magenta font-mono text-2xl font-bold">{'♥'.repeat(Math.min(lives, 6)) || '—'}</div>
          </div>
          <div>
            <div className="text-[11px] tracking-widest text-muted">MY BEST</div>
            <div className="neon-text-magenta font-mono text-2xl font-bold">{best}</div>
          </div>
          <div className="border-t border-line pt-3 text-[11px] leading-5 text-muted">
            <div>
              상태: <span className="text-text">{statusLabel(status)}</span>
            </div>
            <div>10개마다 레벨 ↑ (속도·BGM 템포 ↑)</div>
            <div>20개마다 목숨 +1</div>
          </div>
          <button
            className={`neon-btn w-full !px-3 !py-1.5 text-xs ${muted ? 'magenta' : ''}`}
            onClick={() => setMutedStr(muted ? '0' : '1')}
            aria-pressed={muted}
          >
            {muted ? '🔇 BGM 꺼짐' : '🔊 BGM 켜짐'}
          </button>
        </aside>

        {/* 가운데: 게임 */}
        <section className="order-1 md:order-2">
          <div className="neon-panel p-4">
            <div className="mb-3 flex gap-2">
              <input
                className="neon-input"
                placeholder="닉네임을 입력하세요 (최대 20자)"
                value={nameValue}
                maxLength={20}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commitName();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                disabled={status === 'running' || status === 'paused'}
              />
              <button
                className="neon-btn shrink-0 whitespace-nowrap !px-3 !py-1.5 text-sm"
                onClick={commitName}
                disabled={status === 'running' || status === 'paused' || nameValue.trim() === name}
              >
                확정
              </button>
            </div>

            <FlappyGame
              canStart={name.length > 0}
              muted={muted}
              onStatusChange={onStatusChange}
              onHudChange={onHudChange}
              onGameOver={onGameOver}
            />

            {last && (
              <div className="mt-3 rounded-lg border border-neon-magenta/50 bg-panel-2/70 p-3 text-center">
                <div className="neon-text-magenta text-lg font-black tracking-widest">GAME OVER</div>
                <div className="mt-1 font-mono text-sm">
                  점수 <span className="text-neon-yellow">{last.score}</span> · Lv{last.level} · {last.durationSec}s
                </div>
                <div className="mt-1 text-xs text-muted">
                  {last.saved === 'saving' && '점수 저장 중…'}
                  {last.saved === 'ok' && (
                    <>
                      저장 완료 · 전체 <span className="font-mono text-neon-cyan">{last.rank}위</span>
                    </>
                  )}
                  {last.saved === 'error' && <span className="text-neon-magenta">저장 실패: {last.message}</span>}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 오른쪽: 탭 */}
        <aside className="neon-panel order-3 p-4">
          <div className="mb-4 flex gap-1 border-b border-line pb-3">
            {(
              [
                ['ranking', 'RANKING'],
                ['reviews', 'REVIEWS'],
                ['stats', 'STATS'],
              ] as [Tab, string][]
            ).map(([key, label]) => (
              <button key={key} className={`tab-btn ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
                {label}
              </button>
            ))}
          </div>
          {tab === 'ranking' && <RankingPanel refreshKey={refreshKey} highlightName={name} />}
          {tab === 'reviews' && <ReviewsPanel defaultAuthor={name} />}
          {tab === 'stats' && <StatsPanel refreshKey={refreshKey} playerName={name} />}
        </aside>
      </div>

      <footer className="mt-8 text-center text-[11px] text-muted">
        Next.js · Supabase · Vercel
      </footer>
    </main>
  );
}

function statusLabel(s: GameStatus) {
  switch (s) {
    case 'idle':
      return '대기 중';
    case 'running':
      return '플레이 중';
    case 'paused':
      return '일시정지';
    case 'over':
      return '게임 오버';
  }
}
