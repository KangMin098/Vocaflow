# Architecture

```
[Browser / Expo App]
   ↓
apps/web (Next.js 14 App Router)        apps/mobile (Expo Router)
   │                                       │
   ├── components/ui (Parts Kit 원자)       ├── components/ui (RN 버전)
   ├── components/{도메인}                  ├── components/{도메인}
   ├── stores (Zustand)                     ├── stores (공유)
   ├── lib/supabase | openai | parsers      ├── lib (RN 변형 일부)
   └── api routes                           └── (서버 API 는 web 사용)
        ↓ HTTP
   ┌──────────────────────────────┐
   │ Supabase (DB + Auth + Storage)│
   │ + Edge Functions              │
   └──────────────────────────────┘
        ↓
   OpenAI (단어 추출 / TTS / 퀴즈 생성)

공유: @vocaflow/design-tokens · @vocaflow/types · @vocaflow/ui-shared
```
