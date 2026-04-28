# apps/web — 웹 전용 가이드

루트 `CLAUDE.md` 가 SSoT. 본 문서는 Next.js 14 App Router 한정 보충만 기록.

## 토큰 로드

`src/app/globals.css` 첫 줄에 `@import '@vocaflow/design-tokens/tokens.css';` — 이 한 줄로 `--p`, `--bg`, `--t1` 등 모든 CSS Variables 가 등록됨. Tailwind 는 `var(--p)` 식으로 참조.

## 인증 보호

서버 컴포넌트는 `lib/supabase/server.ts`, 클라이언트 컴포넌트는 `lib/supabase/client.ts` 사용. 라우트 보호는 `src/middleware.ts` 에서 처리.

## App Router 그룹

- `(auth)` — 인증 라우트 (헤더 없음)
- `(marketing)` — 공개 랜딩
- `(main)` — 로그인 후 앱 (BottomTabBar 포함)

각 그룹은 자체 `layout.tsx` 보유. 그룹 간 컴포넌트 공유는 `src/components/` 의 도메인 폴더로.
