# 기출분석 학습 환경 v3.0 설계 패키지

작성 2026-10-12 · Codex · T-0021 · 설계 버전 3.0-design.1 · 반대 Claude 최종 리뷰 `NO_FINDINGS`. **설계·감사 산출물이며 구현·배포·교육 효과의 완료 보고가 아니다.**

사용자 입력: 2026-10-12 첨부 `13e761f0…/Pasted text.txt`(연구 검토)와 `9a5ef43e…/Pasted text.txt`(이번 작업 명세). 이전 외부 실행 지시문은 원본을 보존했다. 최신 사용자 요청과 AGENTS/승인 정본을 함께 따른다.

| 문서 | 소유하는 내용 |
|---|---|
| [CURRENT_STATE_AUDIT](CURRENT_STATE_AUDIT.md) | main·공유 작업트리·진행 중 브랜치·DB의 관찰과 미검증 사항 |
| [CSAT_LEARNING_PROCESS_V3](CSAT_LEARNING_PROCESS_V3.md) | 7장면의 교육 계약·선수 의미 이해·제한된 일반화·효과 검증 |
| [CSAT_LEARNER_UX_V3](CSAT_LEARNER_UX_V3.md) | 화면·이벤트·상태·복귀·TTS·비교·자기 설명 |
| [CSAT_REASONING_DATA_V3](CSAT_REASONING_DATA_V3.md) | 식별자·근거·유형·버전·공개·검수·저장 계약 |
| [CSAT_V3_IMPLEMENTATION_PLAN](CSAT_V3_IMPLEMENTATION_PLAN.md) | M/N/F 통합·의존성·소유권·배치·회귀·복구·PR |
| [CLAUDE_CODE_CSAT_V3_INSTRUCTIONS](CLAUDE_CODE_CSAT_V3_INSTRUCTIONS.md) | 후속 구현 에이전트의 실행 순서와 완료 기준 |

기존 [전달 모델](../../CSAT_LEARNER_DELIVERY.md)을 문서 진입점으로 유지한다. 이 패키지는 v3 구현의 목표 계약이며 기존 코드 사실의 정본을 중복 선언하지 않는다. 기존 `DECISIONS.md`·`ITEM_INQUIRY_V2_CONTRACT.md`의 승인/구현 이력을 지우지 않고, 구현된 부분만 그 문서에 개정한다. 최종 원격 재조회에서 PR #222의 inquiry 통합을 확인했다. [기존 inquiry 계약](https://github.com/KangMin098/Vocaflow/blob/c206b405dd0b44e54989f0bfdc6ef3c2cecac8c2/docs/csat-learner/ITEM_INQUIRY_V2_CONTRACT.md)은 그 main 커밋에서 참고한다. 이 docs worktree의 초기 기준선에는 아직 그 파일이 없으므로 끊어진 상대 링크를 만들지 않는다.

핵심 흐름은 **평가 과제 → 원문 의미 → 문항 성립 → 설계 재구성 → 기출 비교 → 조건부 원리 → 선택적 자기 설명**이다. 순서는 추천이고 접근 자격이나 진도가 아니다. `내 학습 지도 / 기출 탐구` 두 메뉴 제안을 유지한다. 진단 엔진과 읽기 능력 7단계는 새 탐구 장면 7개로 교체하지 않는다.

교차 리뷰와 조치 기록은 [REVIEW](REVIEW.md)에 남긴다. 교육적 효과는 아직 검증하지 않았다. 브라우저 연결이 없어 실제 localhost 화면 검증도 수행하지 않았다.
