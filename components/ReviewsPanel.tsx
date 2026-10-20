'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { fetchReviews, fetchReviewStats, insertReview, type ReviewRow, type ReviewStats } from '@/lib/db';

interface ReviewsPanelProps {
  defaultAuthor: string;
}

function Stars({ value, onChange, size = 'text-xl' }: { value: number; onChange?: (v: number) => void; size?: string }) {
  return (
    <div className={`flex gap-0.5 ${size}`} role={onChange ? 'radiogroup' : undefined}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={`transition ${n <= value ? 'text-neon-yellow' : 'text-line'} ${onChange ? 'hover:scale-110' : 'cursor-default'}`}
          aria-label={`${n}점`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function ReviewsPanel({ defaultAuthor }: ReviewsPanelProps) {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [author, setAuthor] = useState(defaultAuthor);
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (defaultAuthor) setAuthor(defaultAuthor);
  }, [defaultAuthor]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, s] = await Promise.all([fetchReviews(50), fetchReviewStats()]);
      setRows(list);
      setStats(s);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const a = author.trim();
    const c = content.trim();
    if (!a) return setFormError('작성자 이름을 입력하세요.');
    if (a.length > 20) return setFormError('이름은 20자 이내여야 합니다.');
    if (!c) return setFormError('리뷰 내용을 입력하세요.');
    if (c.length > 300) return setFormError('리뷰는 300자 이내여야 합니다.');
    setFormError(null);
    setSubmitting(true);
    try {
      await insertReview({ author: a, rating, content: c });
      setContent('');
      setRating(5);
      setDone(true);
      setTimeout(() => setDone(false), 2500);
      await load();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="neon-text-yellow text-sm font-black tracking-widest">💬 REVIEWS</h3>
        {stats && stats.total_reviews > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <Stars value={Math.round(stats.avg_rating)} size="text-sm" />
            <span className="font-mono text-neon-yellow">{stats.avg_rating.toFixed(1)}</span>
            <span>({stats.total_reviews})</span>
          </div>
        )}
      </div>

      <form onSubmit={submit} className="space-y-2 rounded-lg border border-line bg-panel-2/60 p-3">
        <div className="flex items-center gap-2">
          <input
            className="neon-input flex-1"
            placeholder="작성자"
            value={author}
            maxLength={20}
            onChange={(e) => setAuthor(e.target.value)}
          />
          <Stars value={rating} onChange={setRating} />
        </div>
        <textarea
          className="neon-input min-h-[72px] resize-none"
          placeholder="게임은 어땠나요? (300자 이내)"
          value={content}
          maxLength={300}
          onChange={(e) => setContent(e.target.value)}
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted">{content.length}/300</span>
          <div className="flex items-center gap-2">
            {done && <span className="text-xs text-neon-green">등록 완료!</span>}
            <button type="submit" className="neon-btn !px-4 !py-1.5 text-sm" disabled={submitting}>
              {submitting ? '등록 중…' : '리뷰 남기기'}
            </button>
          </div>
        </div>
        {formError && <p className="text-xs text-neon-magenta">{formError}</p>}
      </form>

      {error && <p className="text-xs text-neon-magenta">{error}</p>}
      {loading && rows.length === 0 && <p className="text-center text-xs text-muted">불러오는 중…</p>}
      {!loading && !error && rows.length === 0 && (
        <p className="py-4 text-center text-sm text-muted">아직 리뷰가 없습니다. 첫 리뷰를 남겨주세요!</p>
      )}

      <ul className="thin-scroll max-h-[360px] space-y-2 overflow-y-auto pr-1">
        {rows.map((r) => (
          <li key={r.id} className="rounded-lg bg-panel-2/60 px-3 py-2.5">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold">{r.author}</span>
              <div className="flex items-center gap-2">
                <Stars value={r.rating} size="text-xs" />
                <span className="font-mono text-[11px] text-muted">{formatDate(r.created_at)}</span>
              </div>
            </div>
            <p className="whitespace-pre-wrap break-words text-sm leading-5 text-text/90">{r.content}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
