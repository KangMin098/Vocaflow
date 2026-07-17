# ACP 콘솔 · 학습자 기사 UI — 접근성/디자인 백로그

> 2026-07-12 심층 감사(12 컴포넌트) 산출. **완료분은 반영**, 나머지는 **시각검증(dev 서버) 권장 트랙**으로 우선순위·파일위치·수정법을 정리.
> 원칙: 색/레이아웃/정체성을 바꾸는 항목은 브라우저로 보면서 해야 회귀를 막을 수 있음 — 블라인드 편집 금지.

## ✅ 완료 (블라인드 안전 — 반영됨)

| 항목 | 커밋 |
|---|---|
| ArticleCard CEFR 배지 `text-white`→틴트 패턴(양 테마·전 레벨 대비) · 학습하기 44px+active · 원문 링크 44px+focus+active | v06.211 `8bf7b1d` |
| ScriptsBrowser 필터해제 X 16→24px · 빈상태 초기화 focus+active | v06.211 `8bf7b1d` |
| ACP 콘솔 focus-visible 14 컨트롤(BulkArticlesTab 9 + CuratedArticlesTab 5) | v06.213 `f54c82f` |

## 🔶 남은 트랙 — 시각검증 권장 (우선순위순)

### P1 · 접근성 defect (색 대비)
- **CuratedArticlesTab:680** — 성공 액션 버튼 `bg-[var(--learn-known)] text-white`. 다크모드에서 `--learn-known`이 밝은 녹색이면 흰 글씨 저대비. **수정법**: dark 모드에서만 어두운 텍스트가 되도록(예 `text-[var(--t1)]`은 테마 반전이라 부적합 → 고정 어두운 녹 or `--ti`/대비 재계산). ⚠️ `--learn-known` 라이트/다크 실값 확인 후 양 테마 스크린샷 필요.
- **BulkArticlesTab:983** — 소스 우선순위 뱃지 `color: active ? 'white'` (하드코딩). 대부분 소스색 위 white 는 판독 가능하나 owid `#0891B2` 등 저채도에서 경계. **수정법**: `'white'`→`'var(--ti)'` 토큰화 + 저대비 소스색 점검.

### P2 · 44px 터치 타겟 (레이아웃 영향)
콘솔 전반 버튼/칩이 h-6~h-9 · min-h-[32~40px] · py-0.5~1.5. **수정법**: 주요 컨트롤 `min-h-[44px]`(액션 버튼) / 밀집 필터칩은 `min-h-[36px]` 절충. ⚠️ 밀집 툴바 높이 변화라 시각 확인 필요.
- BulkArticlesTab: 체크박스 `h-3/h-3.5`(1340·1703), 필터칩 `py-0.5`(1482·1544·1624), 숫자 input `h-6`(1095), fetch `h-9`(이미 focus 보강).
- CuratedArticlesTab: 액션 `h-7`(419·430), 검수/원문 `h-7`(540·554), 선택 아이콘(~15px).
- ScriptsBrowser: 레벨/트랙/reset 칩 `py-1~1.5`(220·295·331). CoverageMatrix 셀 `min-h-[36px]`. GetGuidePanel `min-h-[36px]`.

### P3 · 하드코딩 색 팔레트 → 토큰화 (다크 대응)
- **ArticleCard:31-59** — SOURCE_META 소스 15색 hex + CEFR 잔여 hex(B2/C1/C2). 현재 액센트바/틴트라 양 테마 기능은 OK지만 CSS 변수 규칙 위반 + 다크 미세조정 불가. **수정법**: design-tokens 에 소스/CEFR 스케일 신설 or 컴포넌트 내 다크 변형. ⚠️ 다크 대비 시각 확인.
- **source-map.ts:87-160** — 트랙 액센트 7색 hex(ScriptsBrowser 렌더).

### P4 · 시각 정체성 · 일관성
- **`--admin` 토큰 미채택** — admin/articles 10 컴포넌트 전부 `--p`(deep ink)를 액센트로 사용. 루트 규칙(admin=보라 `--admin` #8B5CF6)·AdminSidebar 와 불일치. ⚠️ **정체성 변경이라 반드시 시각검증** — 의도된 결정인지 사용자 확인 후 일괄 치환.
- **ScoreBar 중복** — CandidateTable:224-237 ↔ SourceFeedList:178-193 동일 로직 2벌. **수정법**: 공용 컴포넌트 추출(파라미터화하면 시각 무변). 점수 색 임계값(BulkArticlesTab 75/55/35 vs 0.7/0.4)·토큰(memory-* vs learn-*) 정합은 시각 결정 필요.
- **active 상태 광범위 부재** — 대부분 커스텀 버튼 `:active` 없음(additive라 저위험이나 다수).
- **GetGuidePanel:59** — `--shadow-sm` 오타(실제 `--sh-sm`) → 그림자 영구 미적용. **저위험 수정 가능**.

## 🟢 모범 사례 (회귀 방지 기준)
- CoverageMatrix:83-105 — 색+빗금패턴+GAP텍스트 3중부호
- CandidateTable:213-222 — Volume2/VolumeX 아이콘 구분(색맹 대응)
- RssFeedTab:177-197 — label+placeholder 병행
- CurationConsole:172 — min-h-[44px] + 완전한 ARIA

## 진행 권장
1. 디스크 확보(`.next` 정리 — 단, 동시 dev 서버 영향 주의) → dev 서버 1개 기동.
2. P4 `--admin` 채택 여부 **사용자 확정**(정체성 결정) → 확정 시 일괄.
3. P1(대비)·P2(44px)를 스크린샷(라이트/다크) 대조하며 컴포넌트 단위로.
4. P3 토큰화 + P4 ScoreBar 추출은 리팩터 단위로.
