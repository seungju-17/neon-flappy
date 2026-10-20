'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GameAudio } from '@/lib/audio';

export type GameStatus = 'idle' | 'running' | 'paused' | 'over';

export interface GameResult {
  score: number;
  level: number;
  durationSec: number;
}

interface FlappyGameProps {
  /** 이름이 없으면 시작할 수 없음 */
  canStart: boolean;
  muted: boolean;
  onStatusChange?: (status: GameStatus) => void;
  onHudChange?: (score: number, level: number, lives: number) => void;
  onGameOver: (result: GameResult) => void;
}

// ---- 게임 상수 (논리 좌표계) ----
const W = 400;
const H = 560;
const GROUND_H = 56;
const BIRD_X = 92;
const BIRD_R = 14;
const GRAVITY = 1500; // px/s^2
const FLAP_VY = -430; // px/s
const MAX_VY = 650;
const PIPE_W = 62;
const PIPES_PER_LEVEL = 10; // 10개마다 난이도 상승
const PIPES_PER_LIFE = 20; // 20개마다 목숨 +1
const INVINCIBLE_SEC = 1.6; // 피격 후 무적 시간
const START_LIVES = 1;

interface Pipe {
  x: number;
  gapY: number; // gap 중심
  gapH: number;
  passed: boolean;
}

interface World {
  status: GameStatus;
  birdY: number;
  birdVy: number;
  pipes: Pipe[];
  score: number;
  level: number;
  lives: number;
  invincibleUntil: number; // elapsed 기준
  toast: { text: string; until: number; color: string } | null;
  startedAt: number;
  elapsed: number; // 일시정지 제외 누적 초
  lastTs: number;
  scrollX: number;
  wingT: number;
}

function levelOf(score: number) {
  return Math.floor(score / PIPES_PER_LEVEL) + 1;
}
// 평균적으로 30개 전후까지 갈 수 있도록 완만하게 상승
function speedOf(level: number) {
  return 150 + (level - 1) * 10;
}
function gapOf(level: number) {
  return Math.max(130, 178 - (level - 1) * 6);
}
function spacingOf(level: number) {
  return Math.max(205, 250 - (level - 1) * 8);
}

function freshWorld(): World {
  return {
    status: 'idle',
    birdY: H / 2 - 20,
    birdVy: 0,
    pipes: [],
    score: 0,
    level: 1,
    lives: START_LIVES,
    invincibleUntil: 0,
    toast: null,
    startedAt: 0,
    elapsed: 0,
    lastTs: 0,
    scrollX: 0,
    wingT: 0,
  };
}

function spawnPipe(x: number, level: number): Pipe {
  const gapH = gapOf(level);
  const margin = 70;
  const minY = margin + gapH / 2;
  const maxY = H - GROUND_H - margin - gapH / 2;
  return { x, gapY: minY + Math.random() * (maxY - minY), gapH, passed: false };
}

export default function FlappyGame({
  canStart,
  muted,
  onStatusChange,
  onHudChange,
  onGameOver,
}: FlappyGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World>(freshWorld());
  const rafRef = useRef<number>(0);
  const audioRef = useRef<GameAudio | null>(null);
  const [status, setStatus] = useState<GameStatus>('idle');

  const canStartRef = useRef(canStart);
  const onGameOverRef = useRef(onGameOver);
  const onHudRef = useRef(onHudChange);
  const onStatusRef = useRef(onStatusChange);
  useEffect(() => {
    canStartRef.current = canStart;
    onGameOverRef.current = onGameOver;
    onHudRef.current = onHudChange;
    onStatusRef.current = onStatusChange;
  });

  const audio = useCallback(() => {
    if (!audioRef.current) audioRef.current = new GameAudio();
    return audioRef.current;
  }, []);

  useEffect(() => {
    audio().setMuted(muted);
  }, [muted, audio]);

  useEffect(() => {
    const a = audioRef;
    return () => a.current?.dispose();
  }, []);

  const setWorldStatus = useCallback((s: GameStatus) => {
    worldRef.current.status = s;
    setStatus(s);
    onStatusRef.current?.(s);
  }, []);

  const reset = useCallback(() => {
    audio().stopBgm();
    worldRef.current = freshWorld();
    setStatus('idle');
    onStatusRef.current?.('idle');
    onHudRef.current?.(0, 1, START_LIVES);
  }, [audio]);

  const start = useCallback(() => {
    if (!canStartRef.current) return;
    const w = freshWorld();
    w.status = 'running';
    w.startedAt = performance.now();
    w.lastTs = w.startedAt;
    w.birdVy = FLAP_VY;
    w.pipes = [spawnPipe(W + 120, 1), spawnPipe(W + 120 + spacingOf(1), 1)];
    worldRef.current = w;
    setStatus('running');
    onStatusRef.current?.('running');
    onHudRef.current?.(0, 1, START_LIVES);
    const a = audio();
    a.init();
    a.setLevel(1);
    a.startBgm();
    a.sfxFlap();
  }, [audio]);

  const flap = useCallback(() => {
    const w = worldRef.current;
    if (w.status === 'idle' || w.status === 'over') {
      start();
      return;
    }
    if (w.status === 'paused') {
      w.lastTs = performance.now();
      audio().resume();
      setWorldStatus('running');
      return;
    }
    w.birdVy = FLAP_VY;
    w.wingT = 0;
    audio().sfxFlap();
  }, [start, setWorldStatus, audio]);

  const togglePause = useCallback(() => {
    const w = worldRef.current;
    if (w.status === 'running') {
      audio().suspend();
      setWorldStatus('paused');
    } else if (w.status === 'paused') {
      w.lastTs = performance.now();
      audio().resume();
      setWorldStatus('running');
    }
  }, [setWorldStatus, audio]);

  // ---- 입력 ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        if (!e.repeat) flap();
      } else if (e.code === 'KeyP' || e.code === 'Escape') {
        e.preventDefault();
        togglePause();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flap, togglePause]);

  // ---- 메인 루프 ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const showToast = (w: World, text: string, color: string, sec = 1.3) => {
      w.toast = { text, until: w.elapsed + sec, color };
    };

    const update = (now: number) => {
      const w = worldRef.current;
      if (w.status !== 'running') return;
      let dt = (now - w.lastTs) / 1000;
      w.lastTs = now;
      if (dt > 0.05) dt = 0.05; // 탭 전환 등으로 큰 dt 방지
      w.elapsed += dt;
      w.wingT += dt;

      const speed = speedOf(w.level);
      w.scrollX += speed * dt;

      // 새
      w.birdVy = Math.min(MAX_VY, w.birdVy + GRAVITY * dt);
      w.birdY += w.birdVy * dt;

      // 파이프 이동 & 점수
      for (const p of w.pipes) {
        p.x -= speed * dt;
        if (!p.passed && p.x + PIPE_W < BIRD_X - BIRD_R) {
          p.passed = true;
          w.score += 1;
          const a = audioRef.current;
          a?.sfxScore();

          // 20개마다 목숨 +1
          if (w.score % PIPES_PER_LIFE === 0) {
            w.lives += 1;
            a?.sfxLife();
            showToast(w, '+1 LIFE ♥', '#4dff9a', 1.6);
          }
          // 10개마다 레벨 업 (속도↑, 틈↓, 간격↓, BGM 템포↑)
          const nl = levelOf(w.score);
          if (nl !== w.level) {
            w.level = nl;
            a?.setLevel(nl);
            if (w.score % PIPES_PER_LIFE !== 0) {
              a?.sfxLevelUp();
              showToast(w, `LEVEL ${nl}`, '#22e6ff');
            }
          }
          onHudRef.current?.(w.score, w.level, w.lives);
        }
      }
      // 화면 밖 제거 / 새 파이프
      if (w.pipes.length && w.pipes[0].x + PIPE_W < -10) w.pipes.shift();
      const spacing = spacingOf(w.level);
      const last = w.pipes[w.pipes.length - 1];
      if (!last || last.x < W - spacing + PIPE_W) {
        w.pipes.push(spawnPipe((last ? last.x : W) + spacing, w.level));
      }

      // 충돌
      const invincible = w.elapsed < w.invincibleUntil;
      if (invincible) {
        // 무적 중에는 화면 밖으로 나가지만 않게
        w.birdY = Math.max(BIRD_R, Math.min(H - GROUND_H - BIRD_R, w.birdY));
        if (w.birdY >= H - GROUND_H - BIRD_R) w.birdVy = Math.min(w.birdVy, 0);
        return;
      }

      const top = w.birdY - BIRD_R;
      const bottom = w.birdY + BIRD_R;
      let dead = bottom >= H - GROUND_H || top <= 0;
      if (!dead) {
        const bx1 = BIRD_X - BIRD_R * 0.8;
        const bx2 = BIRD_X + BIRD_R * 0.8;
        const by1 = w.birdY - BIRD_R * 0.8;
        const by2 = w.birdY + BIRD_R * 0.8;
        for (const p of w.pipes) {
          if (bx2 < p.x || bx1 > p.x + PIPE_W) continue;
          const gapTop = p.gapY - p.gapH / 2;
          const gapBot = p.gapY + p.gapH / 2;
          if (by1 < gapTop || by2 > gapBot) {
            dead = true;
            break;
          }
        }
      }
      if (!dead) return;

      if (w.lives > 1) {
        // 목숨 소모 후 재시작 (주변 파이프 제거 + 무적)
        w.lives -= 1;
        w.birdY = H / 2 - 20;
        w.birdVy = 0;
        w.invincibleUntil = w.elapsed + INVINCIBLE_SEC;
        w.pipes = w.pipes.filter((p) => p.x + PIPE_W < BIRD_X - 120 || p.x > BIRD_X + 180);
        audioRef.current?.sfxHit();
        showToast(w, '-1 LIFE', '#ff3cac');
        onHudRef.current?.(w.score, w.level, w.lives);
        return;
      }

      w.birdY = Math.min(w.birdY, H - GROUND_H - BIRD_R);
      w.lives = 0;
      w.status = 'over';
      setStatus('over');
      onStatusRef.current?.('over');
      onHudRef.current?.(w.score, w.level, 0);
      const a = audioRef.current;
      a?.stopBgm();
      a?.sfxHit();
      a?.sfxGameOver();
      onGameOverRef.current({
        score: w.score,
        level: w.level,
        durationSec: Math.round(w.elapsed),
      });
    };

    const draw = () => {
      const w = worldRef.current;
      // 배경
      ctx.clearRect(0, 0, W, H);
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0a0b24');
      bg.addColorStop(1, '#120b2e');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // 격자 (느리게 스크롤)
      ctx.strokeStyle = 'rgba(34, 230, 255, 0.07)';
      ctx.lineWidth = 1;
      const gridOff = (w.scrollX * 0.3) % 40;
      for (let x = -gridOff; x < W; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H - GROUND_H);
        ctx.stroke();
      }
      for (let y = 0; y < H - GROUND_H; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      // 파이프
      for (const p of w.pipes) {
        const gapTop = p.gapY - p.gapH / 2;
        const gapBot = p.gapY + p.gapH / 2;
        drawPipe(ctx, p.x, 0, PIPE_W, gapTop, true);
        drawPipe(ctx, p.x, gapBot, PIPE_W, H - GROUND_H - gapBot, false);
      }

      // 바닥
      ctx.fillStyle = '#0b0a22';
      ctx.fillRect(0, H - GROUND_H, W, GROUND_H);
      ctx.save();
      ctx.shadowColor = '#ff3cac';
      ctx.shadowBlur = 14;
      ctx.strokeStyle = '#ff3cac';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, H - GROUND_H + 1);
      ctx.lineTo(W, H - GROUND_H + 1);
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = 'rgba(255, 60, 172, 0.25)';
      const gOff = w.scrollX % 28;
      for (let x = -gOff; x < W + 28; x += 28) {
        ctx.beginPath();
        ctx.moveTo(x, H - GROUND_H + 8);
        ctx.lineTo(x - 14, H);
        ctx.stroke();
      }

      // 새 (무적 중엔 깜빡임)
      const invincible = w.status === 'running' && w.elapsed < w.invincibleUntil;
      const blinkHidden = invincible && Math.floor(w.elapsed * 12) % 2 === 0;
      if (!blinkHidden) drawBird(ctx, BIRD_X, w.birdY, w.birdVy, w.wingT, w.status);

      // HUD
      if (w.status !== 'idle') {
        ctx.save();
        ctx.font = 'bold 44px ui-monospace, Menlo, monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#22e6ff';
        ctx.shadowBlur = 16;
        ctx.fillStyle = '#e6f1ff';
        ctx.fillText(String(w.score), W / 2, 64);

        // 목숨
        ctx.textAlign = 'left';
        ctx.font = 'bold 18px ui-monospace, Menlo, monospace';
        ctx.shadowColor = '#ff3cac';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#ff3cac';
        ctx.fillText('♥'.repeat(Math.max(0, Math.min(w.lives, 6))) + (w.lives > 6 ? ` ×${w.lives}` : ''), 12, 28);

        // 레벨
        ctx.textAlign = 'right';
        ctx.font = 'bold 14px ui-monospace, Menlo, monospace';
        ctx.shadowColor = '#4dff9a';
        ctx.fillStyle = '#4dff9a';
        ctx.fillText(`LV ${w.level}`, W - 12, 26);
        ctx.restore();
      }

      // 토스트
      if (w.toast && w.elapsed < w.toast.until) {
        const remain = w.toast.until - w.elapsed;
        const alpha = Math.min(1, remain / 0.4);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.textAlign = 'center';
        ctx.font = 'bold 30px ui-monospace, Menlo, monospace';
        ctx.fillStyle = w.toast.color;
        ctx.shadowColor = w.toast.color;
        ctx.shadowBlur = 18;
        ctx.fillText(w.toast.text, W / 2, H / 2 - 60);
        ctx.restore();
      }

      // 오버레이
      if (w.status === 'paused') {
        overlay(ctx, 'PAUSED', 'Space 또는 P 로 계속');
      }
    };

    const loop = (now: number) => {
      update(now);
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    flap();
  };

  return (
    <div className="relative mx-auto w-full max-w-[400px]">
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        className="block w-full rounded-xl border border-neon-cyan/50 shadow-[0_0_24px_rgba(34,230,255,0.25)]"
        style={{ aspectRatio: `${W} / ${H}` }}
        aria-label="플래피 버드 게임 화면"
      />

      {status === 'idle' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-xl bg-bg/70 p-6 text-center backdrop-blur-[2px]">
          <div className="text-5xl">🐥</div>
          <h2 className="neon-text-cyan text-3xl font-black tracking-widest">NEON FLAPPY</h2>
          <p className="text-sm leading-6 text-muted">
            <b className="text-text">Space / ↑ / 클릭</b> — 점프
            <br />
            <b className="text-text">P / Esc</b> — 일시정지
            <br />
            10개마다 난이도 ↑ · <span className="text-neon-magenta">20개마다 목숨 +1</span>
          </p>
          <button className="neon-btn" onClick={start} disabled={!canStart}>
            ▶ START GAME
          </button>
          {!canStart && <p className="text-xs text-neon-magenta">먼저 닉네임을 입력하세요</p>}
        </div>
      )}

      {status === 'over' && (
        <div className="absolute inset-x-0 bottom-20 flex justify-center">
          <button className="neon-btn magenta" onClick={reset}>
            ↻ 다시 하기
          </button>
        </div>
      )}
    </div>
  );
}

// ---- 그리기 헬퍼 ----
function drawPipe(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, isTop: boolean) {
  if (h <= 0) return;
  ctx.save();
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, '#0f3d4a');
  g.addColorStop(0.5, '#15616f');
  g.addColorStop(1, '#0f3d4a');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  // 캡
  const capH = 16;
  const capY = isTop ? y + h - capH : y;
  ctx.fillStyle = '#1a7f91';
  ctx.fillRect(x - 4, capY, w + 8, capH);
  // 네온 테두리
  ctx.shadowColor = '#22e6ff';
  ctx.shadowBlur = 12;
  ctx.strokeStyle = '#22e6ff';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.strokeRect(x - 4, capY, w + 8, capH);
  ctx.restore();
}

function drawBird(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  vy: number,
  wingT: number,
  status: GameStatus,
) {
  ctx.save();
  ctx.translate(x, y);
  const tilt = status === 'idle' ? 0 : Math.max(-0.5, Math.min(1.2, vy / 600));
  ctx.rotate(tilt);

  // 몸통
  ctx.shadowColor = '#ffe14d';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#ffe14d';
  ctx.beginPath();
  ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // 날개 (펄럭임)
  const flapAmt = status === 'running' ? Math.sin(wingT * 22) : 0;
  ctx.fillStyle = '#ffb347';
  ctx.beginPath();
  ctx.ellipse(-4, 2 + flapAmt * 4, 8, 5, -0.4, 0, Math.PI * 2);
  ctx.fill();

  // 눈
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(6, -5, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0a0b24';
  ctx.beginPath();
  ctx.arc(7.5, -5, 2, 0, Math.PI * 2);
  ctx.fill();

  // 부리
  ctx.fillStyle = '#ff3cac';
  ctx.beginPath();
  ctx.moveTo(12, -1);
  ctx.lineTo(21, 2);
  ctx.lineTo(12, 5);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function overlay(ctx: CanvasRenderingContext2D, title: string, sub: string) {
  ctx.save();
  ctx.fillStyle = 'rgba(7, 7, 26, 0.65)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#22e6ff';
  ctx.shadowColor = '#22e6ff';
  ctx.shadowBlur = 16;
  ctx.font = 'bold 36px ui-monospace, Menlo, monospace';
  ctx.fillText(title, W / 2, H / 2 - 10);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#8b93c7';
  ctx.font = '14px sans-serif';
  ctx.fillText(sub, W / 2, H / 2 + 22);
  ctx.restore();
}
