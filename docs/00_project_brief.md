# Vocaflow — 프로젝트 브리프

> 이 문서는 Claude가 모든 세션에서 가장 먼저 읽는 컨텍스트 파일입니다.
> 상세 디자인 기준은 **CLAUDE.md** (Single Source of Truth)를 참조합니다.
> 문서 버전: **v06.2** (서비스명 LexiVault → Vocaflow / 단어장 모듈 LexiVault → WordVault)

---

## 서비스 정의

- **이름**: Vocaflow
- **목적**: 영어 원문 기반 종합 학습 웹 + 앱 서비스
- **타겟**: 한국 고등학생~성인 영어 학습자
- **현황**: 디자인 시스템 완성 / Parts Kit v06 완성 / 모노레포 구조 확정 / 개발 착수 단계

---

## 기술 스택

| 레이어 | 기술 | 비고 |
|--------|------|------|
| 모노레포 관리 | Turborepo + pnpm workspace | apps/ + packages/ 구조 |
| Web Frontend | Next.js 14 (App Router) + Tailwind CSS | SSR + PWA |
| App | React Native (Expo) + Expo Router | 웹 컴포넌트 최대 공유 |
| Backend | Node.js + Express | REST API |
| Database | Supabase PostgreSQL | RLS 적용 |
| Auth | Supabase Auth | OAuth 콜백 라우트 포함 |
| 상태 관리 | Zustand | 전역 클라이언트 상태 |
| 서버 상태 | React Query (예정) | API 캐싱 |
| AI — 단어 추출 | OpenAI gpt-4o-mini | |
| AI — 퀴즈 생성 | OpenAI gpt-4o-mini | ScriptQuiz 전용 |
| AI — 음성 | OpenAI TTS-1 | Supabase Storage 캐싱 |
| 웹 배포 | Vercel | |
| API 배포 | Railway | |
| 모바일 빌드 | EAS Build | iOS / Android |

---

## 입력 방식 (3가지)

1. 영어 스크립트 직접 붙여넣기 (텍스트)
2. 파일 업로드 — PDF · DOCX · TXT
3. URL 입력 → 본문 자동 추출 (Phase 2 예정)

---

## 학습 모듈 (7종)

| 모듈명 | 설명 | 상태 |
|--------|------|------|
| **TextViewer** | 원문 입력 · 전체/Step 듣기 | 설계 완료 |
| **WordVault** | 단어장 — AI 분석 → 단어/뜻/예문/TTS | 설계 완료 |
| **Flashcard** | SM-2 SRS 플래시카드 · 하늘 배경 환경 | HTML 완성 |
| **SpellForge** | 스펠링 타이핑 게임 · 파란 패널 테마 | HTML 완성 |
| **WordBlitz** | 타임어택 선택 게임 · 정글 어드벤처 테마 | HTML 완성 |
| **ScriptQuiz** | 원문 독해 퀴즈 · AI 자동 생성 · 3-screen flow | HTML 완성 |
| **Dashboard** | 학습 통계 · 진행률 · 점수 · 히트맵 | **설계 완료** |

---

## 브랜드 네이밍 (확정)

| 구분 | 이름 | 구버전 |
|------|------|--------|
| 서비스 전체 | **Vocaflow** | LexiVault |
| 단어장 모듈 | **WordVault** | LexiVault (단어장) / Vocabulary |
| 스펠링 게임 | SpellForge | Crossword |
| 타임어택 게임 | WordBlitz | Starwords |
| 독해 퀴즈 | ScriptQuiz | Quiz |
| 플래시카드 | Flashcard | — |
| 원문 뷰어 | TextViewer | — |
| 학습 통계 | Dashboard | — |

---

## 모노레포 구조 (요약)

```
vocaflow/                       ← 모노레포 루트
├── apps/
│   ├── web/                    ← Next.js 14 (App Router)
│   └── mobile/                 ← React Native (Expo)
├── packages/
│   ├── design-tokens/          ← @vocaflow/design-tokens (CSS Var + RN)
│   ├── ui-shared/              ← @vocaflow/ui-shared (스코어 계산 등)
│   ├── types/                  ← @vocaflow/types (DB·API 타입)
│   └── eslint-config/          ← 공통 린트 규칙
├── supabase/                   ← migrations / functions / seed
├── docs/                       ← 운영 문서 (ONBOARDING·DEPLOY·API 등)
├── .github/workflows/          ← CI/CD
└── CLAUDE.md                   ← 디자인 시스템 SSoT
```

> 상세 트리는 **CLAUDE.md §"프로젝트 모노레포 구조"** 참조.

---

## 디자인 시스템 파일 현황

| 파일 | 역할 | 상태 |
|------|------|------|
| `CLAUDE.md` | 디자인 시스템 기준 (SSoT) | **v06.2 최신** |
| `00_project_brief.md` | 프로젝트 개요 (이 문서) | **v06.2 최신** |
| `ELA_PartsKit_v05.html` | 컴포넌트 시각 레퍼런스 (13섹션) | 최신 |
| `Flashcard.html` | Flashcard 완전 동작 레퍼런스 | 완성 |
| `SpellForge.html` | SpellForge 완전 동작 레퍼런스 | 완성 |
| `WordBlitz_Jungle.html` | WordBlitz 완전 동작 레퍼런스 | 완성 |
| `ScriptQuiz.html` | ScriptQuiz 완전 동작 레퍼런스 | 완성 |

---

## Parts Kit 섹션 구성 (v06 기준)

```
01 Typography       — 4종 폰트 · Desktop/Mobile 8단계
02 Colors           — CSS Variables (--p 축약형) · 다크모드
03 Tokens           — Spacing · Shadow · Radius · Motion
04 Buttons          — 8종 변형 · 3크기 · RN StyleSheet 포함
05 Selectors        — Radio · Checkbox(indeterminate) · Toggle
06 Form Fields      — 6가지 상태 · Alt Form
07 Dropdowns        — Select · Popover · Bottom Sheet
08 Tooltips         — 4방향 · 4색 변형
09 Extras           — Progress · Toast · Modal · Audio · Icons · Loading
10 Game UI          — Flashcard · SpellForge · WordBlitz · ScriptQuiz · Score
11 WordVault        — WordVault 단어장 전용 컴포넌트 전체
12 ScriptQuiz       — 3-screen flow · 선택지 5상태 · O/X 피드백
13 Dashboard ★NEW   — StatCard · WeeklyHeatmap · AccuracyRing · ScoreTrend · Activity
```

---

## DB 스키마 핵심 테이블

```
texts            — 원문 저장 (제목 · 내용 · 소스)
vocabularies     — 단어장 (word · meaning · example · difficulty)
learning_records — 학습 기록 (module · is_correct · response_time)
scores           — 게임 점수 (module · score · accuracy · duration)
quiz_questions   — ScriptQuiz 문제 (type · options · correct_index · source_snippet)
```
모든 테이블: Supabase RLS — `auth.uid() = user_id` 정책 적용

> 참고: DB 테이블명 `vocabularies`는 영어 학습 도메인 일반명사로 유지
> (모듈명 WordVault와 별개 — UI 계층과 데이터 계층 분리 원칙)

---

## 개발 진행 상황

```
완료
  ✅ 디자인 시스템 (CLAUDE.md v06.2)
  ✅ Parts Kit v06 (13섹션 · HTML 시각 레퍼런스)
  ✅ Flashcard 완전 동작 HTML
  ✅ SpellForge 완전 동작 HTML
  ✅ WordBlitz 정글 테마 완전 동작 HTML
  ✅ ScriptQuiz 완전 동작 HTML
  ✅ Dashboard 설계 (CLAUDE.md §13)
  ✅ DB 스키마 설계
  ✅ 모노레포 구조 확정 (Turborepo)
  ✅ 브랜드 네이밍 확정 (Vocaflow / WordVault)

진행 중
  🔄 폴더 구조 생성

진행 예정
  ⬜ globals.css 디자인 토큰 이식
  ⬜ Tailwind + CSS Variables 설정
  ⬜ 공통 UI 컴포넌트 React 구현 (apps/web)
  ⬜ packages/design-tokens 구축
  ⬜ Supabase 스키마 적용 + Auth 연동
  ⬜ OpenAI API 파이프라인 (단어 추출 · TTS · 퀴즈 생성)
  ⬜ 각 학습 모듈 페이지 구현
  ⬜ React Native (Expo) 앱 초기 세팅
  ⬜ Vercel + Railway 배포
  ⬜ EAS Build (iOS / Android)
```
