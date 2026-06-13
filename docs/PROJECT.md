# Project

> Vocaflow — 영어 학습 종합 플랫폼. 미션 · 타겟 · 범위 · 핵심 모듈 요약.
> 작성 시점: 2026-06-08.

---

## 미션

> **사용자가 영어 스크립트을 만나고, 이해하고, 부호화하고, 능동적으로 재인·생성하며, 정복·완성하기까지의 전 과정을 하나의 플로우로 묶는다.**

7 학습 과학 원칙 + 4 디자인 철학을 도구로, 9 학습 모듈을 한 사이클로 연결.

---

## 타겟 사용자

- 한국 고등학생 ~ 성인 영어 학습자
- 입시 (수능/모의고사) · TOEFL/TOEIC/IELTS · 비즈니스 · 학술 · 일반 교양 등 다양한 학습 목적
- 진단 4종 (base V-Level · CSAT Korean · Business · Academic) + 1 통합 (comprehensive)

---

## 핵심 가치

1. **Calm UI** — 학습 중 자극 최소화. 비난 X, 격려 ✓
2. **Asset Management** — 학습은 단어를 외우는 게 아니라 자산을 쌓는 것 (Endowment Effect)
3. **i+1 Krashen** — 현재 V-Level + 1 단계 추천 (V-Level Centroid + Lexical Coverage)
4. **단일 통합 학습 모델** — 9 모듈이 한 사이클 (L0~L7 + L4 4 sub-layers)
5. **Memory Decay 색 체계** — FSRS R(t) 동적 계산으로 4색 표현 (stable/shaky/risk/new)

---

## 핵심 모듈 (요약)

[MODULES.md](./MODULES.md) 상세.

| 모듈 | 계층 | 인지 |
|---|---|---|
| TextViewer | L0~L2 | 획득·이해 |
| WordVault | L3 | 능동 부호화 |
| Flashcard | L4a | 재인 + 메타인지 |
| WordBlitz | L4a | 재인 + 자동화 |
| PairFlip | L4a | 재인 + 공간 기억 |
| SpellForge | L4b | 시각 생성 |
| EchoMatch ⭐v06.33 | L4c | 청각 생성 |
| ScriptQuiz | L5 | 정복 (의미 통합) |
| Dictation | L6 | 완성 (다중 채널 재생산) |
| Dashboard | L7 | 회고 |

---

## 모노레포 구조

```
vocaflow/                              ← 루트
├── apps/
│   ├── web/                           ← Next.js 14 App Router (실 구현)
│   └── mobile/                        ← React Native / Expo (기획)
├── packages/
│   ├── design-tokens/                 ← CSS Variables + RN tokens
│   ├── ui-shared/                     ← 플랫폼 무관 로직
│   ├── types/                         ← 공유 TypeScript 타입
│   ├── library-pipeline/              ← LCP fetchers + normalize/segment/analyze
│   ├── vcb-core/                      ← VCB 핵심
│   ├── vcb-curate-core/               ← VCB curation
│   └── wlp/                           ← Word Learning Pipeline
├── supabase/
│   ├── migrations/                    ← 57 SQL migrations 누적
│   └── functions/                     ← Edge Functions
├── scripts/                           ← 워크스페이스 유틸
│   ├── vcb/                           ← VCB CLI (01~08 step)
│   ├── dict-*.mjs                     ← Dictionary fill helpers
│   ├── seed-dictionary.mjs            ← 외부 시드 → shared_dictionary
│   ├── cefrj-import.mjs               ← CEFR-J Wordlist v1.6
│   └── book-readability.mjs           ← F-K 산정
├── docs/                              ← 본 .md 문서들 (Claude attachment)
│   ├── PROJECT.md                     ← 이 파일
│   ├── STACK.md                       ← 기술 스택
│   ├── DESIGN_SYSTEM.md               ← 토큰 · 컴포넌트 · 모션
│   ├── LEARNING_MODEL.md              ← 9계층 모델 + FSRS
│   ├── MODULES.md                     ← 9 모듈 (목적·라우트·상태)
│   ├── ROUTES.md                      ← 전체 라우트 맵
│   ├── DB_SCHEMA.md                   ← 테이블 · RPC · view
│   ├── LIBRARY_PIPELINE.md            ← LCP + VCB + VRL + ACP
│   ├── ADMIN_CONSOLE.md               ← /admin/*
│   ├── CONVENTIONS.md                 ← 코딩 패턴 · 안티패턴
│   ├── CHANGELOG.md                   ← v06.32~34 + 현재 세션
│   ├── ARCHITECTURE.md
│   ├── DESIGN_DECISIONS.md
│   ├── proposals/                     ← 점진 제안서 (시점 기록)
│   └── adr/                           ← ADR (append-only)
├── CLAUDE.md                          ← 프로젝트 인덱스 (always-on)
├── README.md                          ← 1-page intro
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

---

## 배포 환경

| 영역 | 서비스 |
|---|---|
| Web (Next.js) | Vercel |
| Backend Worker | Railway (예정 — pg_cron 대체 옵션) |
| DB / Auth / Storage | Supabase Cloud |
| Mobile build | EAS Build/Submit (예정) |

---

## 현황 (v06.34 시점)

### 완료
- 9 핵심 모듈 MVP 또는 완성 (Flashcard / SpellForge / WordVault / Dictation / PairFlip / ScriptQuiz / Dashboard / TextViewer / EchoMatch)
- LCP v2.0 — 9 외부 소스 ingest + auto_curate + LibriVox 매핑
- VCB cast-2000 — 7,488 단어 lineage 보존
- VRL v3.0 — 전체 38,598 row 100% Claude Code 분류
- `shared_dictionary` 45,292 row · meaning_ko 100%
- 4축 도서 난이도 (V-Level type-based + CEFR + CEFR-J + F-K)
- 진단 5종 (base + 3 track + comprehensive) + Frontend wire-up
- /admin/curation 다중 선택 + 일괄 액션 + dev 큐 드레인
- `/text/new` 책 (챕터별) 모드

### 진행 중
- WordBlitz 3D 정글 (3D 디자인 반복)
- Pirate Quest 베타 (R3F)

### Phase 2+ 예정
- Mobile Expo 실 구현
- WordVault Zustand 스토어 (sessionStorage 대체)
- EchoMatch Cloud TTS + Storage 캐싱 (synthetic ref 한계 해결)
- DTW Web Worker 분리 (100+ 문장 chapter)
- pg_cron alternative (Railway worker)
- VCB Cast-2000 결과 dict-fill 9-25k tier 완성
- VRL Phase 3 word_register 배지 UI 연동
- 사용자 학습 누적 → daily_activity / achievements 가시화

---

## 사용자 수

현재 0명 (실 사용자 없음). 모든 설계는:
- Phase 1 (현재): mock/seed 데이터 + 단일 admin/curator 시나리오
- Phase 2: 베타 사용자 (~30명) 도입 후 임계값/threshold 데이터 수집
- Phase 3: 일반 출시

---

## License

ISC (package.json). 사전 cefrj wordlist v1.6 Citation 별도.

---

## Repository

https://github.com/KangMin098/Vocaflow
