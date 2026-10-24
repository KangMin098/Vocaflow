# Drain 후속 제품 개선 — 공통 지시 (2026-10-24)

작업 공간 `D:/workspace/Vocaflow-csat-drain-p1` · 브랜치 `feat/csat-drain-product-20261024` = 로컬 main `7f11a8538`(node_modules 설치됨). 근거 연구: `docs/csat-learner/drain-followup-20261024/`(F3 2015#25 · F4a 강의 규칙 · F4b 서수 155 · F6 S2 판단 도구) · 원 drain `git show 3d0079043:docs/csat-learner/all-types-research-20261024/drain-20261024/<f>`.

## 소유권 — 수정 금지(읽기만)
- T-0140 · T-0146 · T-0147 owner `csat-lecture-disclosure`: `apps/web/src/components/csat/lecture/` · `components/csat/theater/AnalysisTheater.tsx` · `theater.module.css` · `app/api/csat/lecture/` · `app/(app)/csat/item/[slug]/page.tsx` · `app/api/csat/item/[slug]/judgment/` · `lib/csat/lecture/` · `lib/csat/theater.ts` · `lib/csat/judgment-reveal.ts`
- T-0145 owner `csat-v4-s0`: `lib/csat/inquiry/` · `lib/csat/meaning-support/` · `lib/csat/learner.ts` · `components/csat/theater/InquiryV3Panels.tsx` · `components/csat/theater/inquiry/`
- 강의 원본 `apps/web/src/lib/csat/lecture-data/` · 분석(DB `csat_item_analyses`) · `supabase/migrations/` · 다른 세션 워크트리
## 규칙
1. DB 는 `mcp__supabase__execute_sql` SELECT 만. 쓰기 SQL 은 **작성만** 하고 실행하지 않는다(사용자 승인 대상).
2. 콘텐츠(강의·분석·정답) 수정은 「후보 패치」 파일로만 — 실제 원본·DB 반영·발행 금지.
3. 자기 산출물 파일만 쓴다(`docs/csat-learner/drain-product-20261024/<배정>` 및 배정된 스크래치). 커밋·`git add` 금지(총괄이 한다).
4. 지문·선지 원문은 40자 이하로만 인용. 학평 원문 PDF 내용은 커밋 문서에 옮기지 않는다(대조 결과·해시·위치만).
5. 확인 못 한 것은 NOT_VERIFIED / BLOCKED_AUTH. 실행 안 한 검사를 PASS 로 쓰지 않는다.
6. 끝나면 12줄 이내로: 산출물 경로 · 실제 결과 수치 · 승인 필요 항목 · owner 에게 넘길 항목.
