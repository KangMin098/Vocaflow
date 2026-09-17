# Vocaflow 디자인 작업의 시작점

Vocaflow는 영어 원문과 학습 근거를 읽고 조작하는 도구다. 정보의 위계, 원문 위의 표식,
읽기 흐름으로 정체성을 만든다. 제품 전체의 학습 모델을 CSAT 분석 흐름 하나로 바꾸지 않는다.

이 문서는 기존 정본을 연결하는 입구다. 토큰·학습 원칙·도메인 결정을 복제하지 않는다.

| 결정할 것 | 정본 |
|---|---|
| 학습 효과와 디자인 제약 | [vocaflow-design](.claude/skills/vocaflow-design/SKILL.md), [AGENTS.md](AGENTS.md) |
| 현재 판면과 서체 | [주묵 판면](docs/design/03-system.md), [디자인 시스템](docs/DESIGN_SYSTEM.md) |
| 실제 토큰·글꼴 구현 | [tokens.css](packages/design-tokens/src/tokens.css), [Tailwind](apps/web/tailwind.config.ts) |
| 제품의 학습 계층 | [학습 모델](docs/LEARNING_MODEL.md) |
| CSAT 예측·대조·근거·공식·전이 | [학습자 결정](docs/csat-learner/DECISIONS.md), [통합 경험](docs/csat-learner/integrated-experience.md) |
| 조사 → 구현 → 캡처 → 비평 → 수정 | [디자인 작업 절차](docs/design/06-workflow.md) |
| 레퍼런스를 선택하는 이유 | [레퍼런스 인덱스](docs/design/references.md) |

큰 재설계에서는 A(명확한 동선), B(학습 자산을 활용한 새 조작), C(통합)를 비교한다.
기존 화면의 작은 수정에는 세 가지 시안을 강제하지 않는다. 선택은 학습 효과와 실제 렌더 결과로 설명한다.

디자인 완료 보고에는 변경 전후 화면, 주요 비평과 해결 여부, 실행한 검증, 남은 제약을 남긴다.
테스트 통과는 시각적 품질의 증거를 대체하지 않는다. 사용자 피드백은 해당 도메인의 결정 문서에
날짜·화면·근거와 함께 기록하고, 반복 적용되는 원칙만 디자인 정본에 반영한다.
