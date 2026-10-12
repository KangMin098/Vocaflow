# v3.1 현황 감사 — 사실 · 판단 · 미확인

## 1. 조사 기준

- 기준: main `521944f227c9cf5b957cb8b366fb27a6d81a3d42`, PR #235 병합 확인. 공유 루트 작업트리는 미커밋·충돌 변경이 있어 수정하지 않고 별도 docs 작업트리를 사용했다.
- 입력: 2026-10-12 사용자 첨부 v3.1 보완안(Pasted text), 기존 vocaflow-csat-analysis-claude-instructions.md, vNext2 실행 지시문, 이전 v3 설계 작업트리, 현재 계약·코드·공개 정적 자료. 실제 로컬 경로는 비공개 인수인계에 둔다.
- 첨부가 언급한 223줄 별도 문서 본문은 없다. 이전 v3 설계는 PR #223/설계 작업트리에서 읽었다. 최초 #235에는 v3 폴더가 없었고 최종 #236에는 `docs/csat-learner/v3/M5_RELEASE_CHECK.md`만 추가되었다. PR #223 전체 설계는 여전히 draft/open이며 그 경로만 전달하는 방식으로 Claude 작업을 시작시키지 않는다.
- DB 직접 질의, 인증된 화면 재실행, TTS 청취, 실제 학습자 효과 측정은 이번 작업에서 수행하지 않았다.
- CUA 연결 표면은 apps 0/browsers 0. 로딩·로그인 화면을 정상 학습 화면으로 대체하지 않았다.
- 로컬 M5 기존 캡처 `compare-selected_1280.png`, `note-failed_1440.png`는 열어 보았다. 원문 판에 ‘문제지 여는 중’이 있고 meaning 장면 캡처가 아니므로 정상 원문 이해 baseline/현재 커밋 인증으로 채택하지 않았다. 좁은 분석 판에 새 장문 카드를 누적하지 않는 설계 참고만 했다.
- 이번 계수는 **커밋된 공개 JSON의 구조 감사**다. DB 최신 상태·실제 접근 가능한 문항 수·전량 의미 정확성 인증으로 해석하지 않는다.

## 2. 전량 계수

[corpus-audit.json](corpus-audit.json)은 공개 inquiry/compare/skeleton JSON을 읽어 계산했다. 재현: `node docs/csat-learner/v31/audit-corpus.mjs`(읽기 전용, 저장 파일 변경 없음).

| 실계수 | 결과 | 해석 한계 |
|---|---:|---|
| inquiry 문항 / v3 포함 / review=verified | 각각 786 | 기존 공개 검수 라벨. v3.1 새 설명의 검수 아님 |
| 유형 | 26 | 상세 분모는 JSON의 types |
| 의미 주석 | 3,971 | 정확한 문맥 설명인지 전량 내용 검수한 것은 아님 |
| 의미 필드 | id, sentences, expression, meaning_ko, scope 각 3,971 | 쉬운 재구성·구문 결합·관계 설명·전체 통합 전용 계약은 없음 |
| meaning_ids가 있는 선택지 | 3,812 / 총 3,930 | 나머지 118개의 의미 연결이 필수인지 유형별 내용 판단 필요 |
| 선택지 meaning_ids의 끊긴 참조 | 0 | 기존 v3 의미→문항 성립 연결을 활용 가능 |
| 새 readingSupport/v31 칸 | 0 | 신규 설계 대상 |
| 비교 쌍 / 연결 문항 / principle 보유 쌍 | 749 / 477 / 110 | 교차 유형 사례와 교육 효과의 증거 아님 |

scope 실계수: agent 361, none 1,028, condition 444, contrast 411, quantity 356, negation 323, reference 685, time 363. `none`을 설명 결함으로 일괄 분류하거나 다른 scope를 기계적으로 추가하지 않는다.

### 교수 영역별 현재 제공 정도

| 영역 | 현재 확인된 제공 | 새 계약이 필요한 부분 |
|---|---|---|
| 정확한 문맥 의미 | meaning_ko 3,971개 | 구문 결합→전체 명제 형성 과정을 일관되게 탐구하는 방식 |
| 쉬운 재구성 | 의미 설명 일부가 이미 쉬운 한국어일 수 있음 | exact/simple 분리와 의미 보존 대조의 전용 필드·UI는 없음 |
| 명제 이해·보존 | scope 3,971개·발문 조건·선지 decisive | 주체/가능성/부정/범위 등을 명제에 묶고 원문 대조하는 계약 |
| 문장 관계 | 역할 사슬·단서·scope.note에 연결 설명이 있을 수 있음 | before/after/change 명제와 양쪽 근거를 잇는 명시적 관계 계약 |
| 전체 통합 | passage_design의 패턴·선택 이유·변환 설명 | 유형별 핵심 생각/사건/안내를 선택 의미와 연결하는 전용 모델 |
| 추론 검증 | v3.design의 공식/관찰/가설 구별 | 원문 이해 안에서 명시/연결 추론/설명용 확장과 한계를 구별 |

전용 필드가 없다고 기존 한국어 설명이 무가치하거나 학습자가 이해하지 못한다고 판정하지 않는다. 각 설명의 실제 품질/재사용 판단은 대표 원문 대조와 후속 내용 감사의 몫이다. DB의 구문 자산 양은 이번 정적 감사가 측정하지 않았다.

## 3. 기존 자산과 보완 판단

| 실제 파일·자산 | 확인된 동작 | 유지 / 보완 |
|---|---|---|
| `apps/web/src/lib/csat/inquiry/labels.ts` InquiryV3.meanings | 짧은 영어 표현, 문맥 뜻, 범위, 문장 번호 | 유지. 새 교수 모델은 별도 sidecar, 기존 v3 구조/해시 보존 |
| `apps/web/src/components/csat/theater/InquiryV3Panels.tsx` V3Meaning | 의미·범위 목록과 근거 버튼 | fallback 유지. 파일럿 공개 문항에는 선택 문장의 교수 작업면 제공 |
| `apps/web/src/components/csat/theater/SceneDiagrams.tsx` StructureDiagram | 역할 라벨 사슬, 구조 패턴, 단서; 대응 불확실 시 번호 제거 | 기존 설계 가설 유지. 실제 명제 간 변화 설명을 별도 독해 관계로 추가 |
| `apps/web/src/components/csat/PassageMap.tsx` | 근거 칩 선택, 문장 강조, 강의 focus | 문장 선택 콜백은 현재 없음. 근거 칩 콜백과 새 문장 선택을 분리해야 함 |
| `apps/web/src/components/csat/theater/AnalysisTheater.tsx` | meaning 패널·구조 도식 나란히 렌더, ItemPaper.onPassageChange의 currentPassage 활용 가능 | 한 선택 상태와 같은 evidence adapter로 묶음. 문장 수 동일만으로 구절 매핑 정확성을 인정하지 않음 |
| `apps/web/src/components/csat/theater/ItemPaper.tsx` | 기기 PDF/원문 경로 | 권한·저작권·기기 원문 재사용. 공용 JSON에 원문 복제 금지 |
| `apps/web/src/lib/csat/session/passage-model.ts` | 인용 매칭, 골격→reflow 길이 정렬 fallback, unplaced 표시 | 화면 위치 후보 재사용. 길이 정렬만으로 새 의미 구절 정확 강조를 확정하지 않음 |
| `apps/web/src/components/csat/theater/ReasoningNoteForm.tsx` | 원리·근거·적용 조건·한계, 실제 저장 성공/실패 | 그대로 유지. 원문 이해 초안을 원리 노트로 오저장하지 않음 |
| `apps/web/src/lib/csat/inquiry/data.ts` | 현재 분석 버전과 inquiry 일치 검사 | 서버 sidecar lookup도 같은 현재 버전·해시에 결속 |
| inquiry export/validate/hash/review/build 공정 | 원문 입력은 gitignore, 해시 결속 독립 검수, v3 verified 공개 | 검수·해시 함수를 재사용. 신규 sidecar 공개 가드는 기존 pass와 분리 |
| `apps/web/src/lib/csat/lecture/types.ts` | schema3 장면/주대상 타입 | 이번에는 강의 콘텐츠 생성/target 확장 안 함. 수동 탐구가 재생을 시작하지 않게 회귀 |
| `MeaningAnnotation` | 현재 csat 코드에서 타입/컴포넌트/직렬화 자산 발견 안 됨 | 기존 설계 개념. 구문 DB 자산이 구현되어 있다는 전제로 호출하지 않음 |
| `scripts/csat/data/blueprint-registry.json` | 유형별 설계/생성 기준 | 유형 처리 참고. 출제자의 실제 내부 과정·독해의 보편 법칙으로 노출하지 않음 |

## 4. PR #234 이후 중복 방지

PR #235 코드·PR 본문 확인: 비교 변경/해제 시 강조 초기화, 주소 pair 복원, 양쪽 analysis_version/units_hash, 공개 정본 가드 CI 편입이 있다. 이를 v3.1 신규 개발 목록으로 다시 잡지 않는다. 최종 main `b691cb7f2d93df46725c2bd87483b2b49f1998c6`(PR #236)의 diff는 E2E3파일·문서3파일이며 앱·공개 데이터 diff는 0이다. M5 출시 검수표는 학습 루프13개 통과를 보고해 옛 미검증1개를 갱신했다. 새 패널 참조 미확보·도표 원본·밑줄 영역·embargo 실화면·실사용자 효과는 따로 남아 있다. 본 감사는 해당 테스트를 재실행하거나 화면·효과를 재인증하지 않았다.

## 5. 대표 원문 대조

기기 로컬 원문 inputRef `inquiry-origin:chunk-inq-15`(2026#22·23·25·29·34·36·38), `inquiry-origin:chunk-inq-16`(2026#43)을 읽었다. 실제 경로는 비공개 인수인계에 둔다. 공개 v3 analysis_version은 #36=4, 나머지=5다. 원문 입력은 문서에 통째로 복제/커밋하지 않는다.

- #34: 법의 이상적 조건, 이성적 선택, 부정 범위. 기존 ‘선택하지 않을 행동’을 ‘원하지 않는 행동’으로 단순화할 때 의미 변화가 생길 수 있어 별도 검수해야 한다. 원래 If 명제를 ‘모든 금지는 오직 이런 것뿐’이라는 주장으로 강화하지 않는다.
- #36: 인쇄된 A/B/C 순서와 실제 논리적 읽기 순서가 다르다. 원문 ID를 재번호하지 않고 관계 순서를 따로 둔다.
- #38: 주어진 문장이 입력 1번이다. 1이 지문의 첫 문장이라는 전제로 앞뒤 관계를 만들면 안 된다.
- #22·23: 권고의 가능성, 예외 범위, 두 축의 균형을 보존해야 한다. 요약을 강한 보편 명제로 바꾸지 않는다.
- #29: 원문에 어법 오류 being이 있다. 의도된 의미와 실제 문법 결함·교정안을 구별해야 한다.
- #25: 언어상 배수·범주 의미는 설명 가능하나 원본 도표를 이번에 독립 확인하지 않았다. 기존 주석 수치를 새 검수된 사실로 승격하지 않는다.
- #43: 35개 입력 문장과 공통 지문, 대화 화자/지시 대상, 책 속 이야기와 Mia 가족 이야기의 층위를 구별해야 한다.

## 6. 정책 우선순위

사용자 대화의 다크 제외·PC 범위·3B 방향·보류 목록을 적용한다. 사용자 제공 AGENTS.md는 main 병합 확인과 반대 에이전트 계획 리뷰를 요구하고, 현재 main AGENTS.md에는 AUTO_CONTINUE와 자동 Codex 리뷰 폐지가 있다. 이번 설계는 사용자 명시 지시를 우선해 반대 Claude 계획 검토를 수행하고, 문서 PR만 준비하며 main 병합하지 않는다. Claude 후속 작업도 정책 차이를 목적 파일에 남겨 사용자 대화의 승인을 임의로 만들어 내지 않는다.
