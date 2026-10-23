# 근거 위치와 재현 범위

제품 소스 커밋 `3f437e9b65e06c00a96f64890402500417377c92`. 아래 경로는 저장소 루트 기준이다. 소스가 있다는 사실을 교육적 적합성·내용 검수·정상 계정 접근 가능성으로 치환하지 않는다.

| 기능 | 근거 경로 | 이번 설계에 사용하는 사실 |
|---|---|---|
| F01/F04 | apps/web/src/components/csat/theater/AnalysisTheater.tsx | v3 judgment 및 기존 해설 블록, 실제 격리 1280/1440 화면 |
| F02 | apps/web/src/lib/csat/meaning-support/data.ts · apps/web/src/lib/csat/reflow/types.ts | 의미 schema/criteria/hash/version, 기기 reflow의 원문/선지/needsOriginal 구조 |
| F03 | apps/web/src/lib/csat/teaching-contract.ts | 26 teaching models와 근거 단위·visual guard; DB 유형26과 별도 차원 |
| F05 | apps/web/src/components/csat/theater/SystemLearningSummary.tsx | 조건 적용/한계 탐색 구조. 정확성/효과는 별도 |
| F06 | apps/web/src/app/(app)/csat/item/[slug]/page.tsx:181~202 · apps/web/src/lib/csat/inquiry/compare-v3.ts | 서버 공개집합 투영·held/missing·양쪽 결속 검사. 계정별 RLS는 별도 |
| F07/F08 | apps/web/src/components/csat/theater/AnalysisTheater.tsx:846~852 · apps/web/src/components/csat/lecture/LectureStage.tsx | liveScene에 따른 selectScene 및 active.scrollIntoView. 학생 소유 계약과 충돌하는 현재 코드 |
| F07 | apps/web/src/lib/csat/lecture-data/2026.json · apps/web/src/lib/csat/lecture/player.ts | 원본37cue·target/order/role/est_sec·재생 상태. TTS 실청취 미실행 |
| F09 | item route query 맥락 및 S0 S1_ADAPTER_PLAN.md | 지도/TASK/Workspace 진입·복귀 후보. 학습기록/숙달 전후 실행은 미검증 |
| F10 | scripts/csat/data/classified.json · S0 TYPE_REGISTRY.md | 로컬 관측 듣기248/18/14. 원음·전사·화자·시간·권리는 미확인 |

원본 DB SELECT/보존 메타데이터는 AI-Control `verification/reviews/T-0131-codex-s0-20261023/ITEM_METADATA.json`, 신규 최소 SELECT는 `verification/reviews/T-0131-v6-recheck-20261023/snapshot.json` 및 `appendix-metadata.json`, 독립 재수용은 같은 폴더 `INDEPENDENT_REVIEW.md`다. DB 값은 측정 시점의 사실이며 현재 접근 권한을 보증하지 않는다.

샘플 판단 구조는 main-serving의 보존 `tmp/csat-item-review-20261023/samples.json`에서 대조한다. 격리 캡처 생성기는 `tmp/csat-v6-browser-evidence-20261023.mjs`; 실제 컴포넌트와 원본 강의 데이터로 격리 렌더하고 쓰기 요청을 차단했다. 별도 로컬 강의 fixture API는 정상 서비스 인증/RLS 검증이 아니다. 브라우저 결과와 캡처10개는 이 폴더에 해시 결속하여 보존했다.

문서 검증 재현:

```powershell
node docs/csat-learner/skeleton-v4/s1-v6/validate.mjs --source-root D:/workspace/Vocaflow-main-serving --samples D:/workspace/Vocaflow-main-serving/tmp/csat-item-review-20261023/samples.json
```

순수 테스트25개는 같은 제품 원천 해시의 기존 결과를 재사용한다. `s0/CHECKS.json`의 재개 검증 기록은 별도로25개를 다시 실행한 증거다. 이번 S1 문서 검증이 이를 새로 실행했다고 하지 않는다. 인증 실패·전수 blind 함수 timeout은 해소되지 않았다.
