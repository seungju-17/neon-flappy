# Neon Flappy 🐥

네온 스타일의 **플래피 버드** 게임입니다. Next.js + Supabase 로 만들었고 Vercel 에 배포됩니다.

- 모든 플레이어의 게임 점수가 **Supabase 에 저장**됩니다 (`game_scores`)
- 게임에 대한 **리뷰(별점 + 내용) 작성** 기능이 있습니다 (`game_reviews`)
- 추가 데이터 관리: TOP 10 랭킹, 전체 통계(총 플레이/플레이어 수/평균·최고 점수), 평균 별점, 닉네임별 내 기록 조회

## 조작

| 키 | 동작 |
| --- | --- |
| Space / ↑ / W / 클릭(터치) | 점프 (시작) |
| P / Esc | 일시정지 / 재개 |

- 파이프 **10개**를 통과할 때마다 레벨이 오릅니다. 속도가 빨라지고, 파이프 틈과 간격이 좁아지며, BGM 템포가 올라갑니다.
- 파이프 **20개**를 통과할 때마다 목숨이 1개 늘어납니다. 목숨이 남아 있으면 부딪혀도 잠시 무적 상태로 이어서 플레이합니다.
- BGM 과 효과음은 Web Audio API 로 실시간 생성됩니다 (외부 음원 파일 없음). 왼쪽 패널의 버튼으로 끌 수 있습니다.

## 설정

### 1. Supabase 테이블 생성
Supabase Dashboard → **SQL Editor** 에서 [`supabase/schema.sql`](supabase/schema.sql) 전체를 실행합니다.
(테이블 2개 + 통계 뷰 2개 + 익명 읽기/쓰기 RLS 정책이 만들어집니다.)

### 2. 환경 변수
`.env.local` (로컬) 과 Vercel 프로젝트 설정에 아래 두 값을 넣습니다.

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 3. 실행

```bash
npm install
npm run dev
```

## 구조

```
app/page.tsx              → GameApp 렌더
components/GameApp.tsx    → 닉네임, 상태 패널, 탭(랭킹/리뷰/통계) 조합
components/FlappyGame.tsx → 캔버스 게임 엔진 (물리, 충돌, 렌더링)
components/RankingPanel.tsx / ReviewsPanel.tsx / StatsPanel.tsx
lib/supabase.ts           → Supabase 클라이언트
lib/db.ts                 → 점수/리뷰/통계 쿼리 함수
lib/audio.ts              → Web Audio 칩튠 BGM/효과음
supabase/schema.sql       → 테이블·뷰·RLS 정의
```

## 기술 스택
Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · Supabase (PostgreSQL) · Vercel
