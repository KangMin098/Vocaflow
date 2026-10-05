# FYM 사람 평가 실행기 v2 — 2026-10-05

사람 평가 준비부터 적재 전 검증까지 한 milestone으로 연결했다. [프로토콜](../FYM_HUMAN_VALIDATION_PROTOCOL.md) · [명령과 복구](../../scripts/textbook/frym-validation/README.md).

## 완료 범위

- 4점/8항목별 인용·근거·critical과 5개 최종 보존 차원. 핵심 critical은 평균/중재로 구제할 수 없다.
- 최초 두 독립 리뷰 → 제3 독립 blind 리뷰 → 공개 후 중재를 hash·시각·배정에 묶어 저장한다. 최초 자료를 덮지 않으며 비치명 왜곡 불일치는 최종 중재 결과로 판정한다.
- 프로토콜·anchor·문항/채점·지문/원 연구·배정/노출·제외 명세를 manifest로 봉인한다. 등록 후 패킷을 다시 만들고 실제 응답의 packet_hash를 검사한다. 초안 패킷의 응답을 새 봉인 결과로 인증하지 않는다.
- 학년당15~30명·버전별 완전 측정 최소15명·균형 순서·의미 통과 후 읽기를 검사한다. null/무응답/부분 시각은 보존하고 완전 측정에서 제외한다.
- 학생별 어휘/문장/추론/이해도 분포와 시간/부담, 문항별 반응·순서 위치·전문가 항목별 일치를 나눠 보고한다.
- calibration은 student_validated까지만 가능하다. 완료된 calibration에서 실제 제외 명세를 추출하고 독립 validation/replication만 gold가 될 수 있다.
- importer는 v2 gold와 실제 원 연구 문맥을 최초/batch 직전에 대조한다. v1은 과거 읽기를 보존하지만 새 seed 인증에서는 거절한다.
- production 검증은 후속 독립 주제/원천/연구/학생의 gold 재현과 실제 published 행의 본문·부모·target·저장 인증까지 읽기 전용으로 확인한다.

## 실제 8편 예행

사용한 입력은 기존 F02/F06/F14/F18의 중1/고1 8편이다. 새 로컬 출력은 `.agent-logs/frym-validation-v2-sealed-packets-20261005/`에 보존했다. 기존 v1 파일과 이전 예행을 덮지 않았다.

| 확인 | 실제 결과 |
|---|---:|
| 전문가 패킷 / 학생 패킷 | 8 / 8 |
| 문항 초안 | 96 |
| 미확정 학년별 band | 20 |
| 실제 전문가 / 중재 / 학생 응답 | 0 / 0 / 0 |
| 사전 등록 완료 | 없음 |
| candidate / expert_validated / student_validated | 8 / 0 / 0 |
| gold / production | 0 / 0 |
| DB 쓰기 / 발송 | 0 / 0 |

register --prepare는 미봉인 요청만 만들었다. 빈 batch를 collect한 뒤 원 입력과 결과의 데이터 동일성, receipt의 입력/응답/출력 SHA256 일치, 모든 측정값 null을 확인했다. null 책임자/시각/증빙으로 실제 등록을 시도하는 음성 예행은 거절됐으며 등록 결과 파일은 생성되지 않았다.

현재 protocol SHA256: `89de1ef8af39be5484691e0ce779fb2dfdcae01ba924b48eb2142a37804f462f`. instrument SHA256: `829207805a5698d9b2f52bd9455fc01aae12a5b243559dba74ae958f8e0cae0f`. 이 해시는 초안 식별자이며 사람의 승인/등록 증빙이 아니다.

## 검증과 한계

라이브러리 전체 테스트 2,935개/165파일, 타입 검사, 관리자 도움말63개, 도움말 ESLint, 에이전트 검사11개를 통과했다. v2 회귀61개에는 적재 인증·학년 표본·새 독립 표본 export도 포함했다. 모든 테스트의 사람/점수는 synthetic이며 실제 연구 결과로 포함하지 않았다. 교차 리뷰가 찾은 등록 형식·중재 전 skip·분포 단위·비치명 왜곡 중재·부분 시각·미완료 calibration·새 회차의 taxonomy 참조·재현의 현재 confidence 대조를 수정했다. 최종 목적 대조 리뷰에서 추가된 봉인 후 패킷 재발급/응답 hash·재현 전문가 재사용·고정 calibration identity 재사용 문제도 수정하고 회귀에 포함했다. 교차 리뷰는 P1/P2 없음이며 focused115개(v1 54/v2 61)를 재확인했다.

사람 책임자, 실제 전문가/학생, band·근거·운영 규칙은 아직 확보/확정하지 않았다. 코드 리뷰는 전문가 의미 인증을 대신하지 않으며 calibration8에서 플랫폼 성능을 일반화하지 않는다. 새 독립 validation 원천·문항과 production 재현 자료도 실제로 만들거나 평가하지 않았다. 실제 DB seed·발행·마이그레이션은 수행하지 않았다.
