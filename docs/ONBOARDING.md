# Onboarding

신규 개발자 셋업 가이드.

## 사전 요구

- Node 20+ (`.nvmrc` 참조)
- pnpm 9 (`corepack enable && corepack prepare pnpm@9 --activate`)
- Supabase CLI / Expo CLI

## 셋업

```bash
git clone https://github.com/KangMin098/Vocaflow.git
cd Vocaflow
pnpm install

cp apps/web/.env.example apps/web/.env.local   # 키 채우기

pnpm --filter @vocaflow/web dev
```

## 디자인 SSoT

- 토큰 변경 → `packages/design-tokens/` (CLAUDE.md 별도)
- 컴포넌트 규칙 → 루트 `CLAUDE.md`
