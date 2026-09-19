---
name: vocaflow-design-loop
description: Design or improve Vocaflow web screens with the existing learning model, rendered references, implementation, browser QA, and revision. Use for substantive UI work, not backend-only changes or isolated copy edits.
---

# Vocaflow 디자인 작업

저장소 루트의 [DESIGN.md](../../../DESIGN.md)를 읽고 작업 화면의 정본을 고른다.
[vocaflow-design](../../../.claude/skills/vocaflow-design/SKILL.md)을 읽어 학습 원칙과 외부 취향 스킬의 충돌을 판정한다.
이 스킬은 작업 절차만 소유하며 별도의 미감·토큰을 만들지 않는다.

1. 라우트와 컴포넌트를 직접 확인한다. 사용자의 목적, 핵심 행동, 기존 동작, 변경 범위를 짧게 적는다.
   현재 화면을 먼저 렌더해 비교 기준을 확보한다. 로딩·로그인·오류 화면을 정상 결과로 취급하지 않는다.
2. 코드 전에 vocaflow-design §G2 세 줄(골격 · 서명 · N4)을 적는다.
   큰 재설계(새 화면·전면 재설계)만 §G3 발산 4안 — 골격(G1 축)이 서로 다른 넷 — 을 `compare.md` 로 만들고
   각 안에 사용자 행동과 학습 효과, 익명성 자기검토를 적는다. **고르는 것은 사람이다**(에이전트가 승자를 정하지 않는다).
   단일 에이전트에서도 순차 수행한다. 이 절차가 추가 에이전트 실행이나 외부 서비스 쓰기를 허가하지 않는다.
3. [레퍼런스 인덱스](../../../docs/design/references.md)에서 해당 화면에 필요한 근거만 읽는다.
   외부 이미지·Figma·이미지 생성은 그 결과가 필요할 때 사용한다. 사용할 수 없는 연동 때문에 로컬 작업을 멈추지 않는다.
4. 기존 컴포넌트·토큰·아이콘·테스트를 재사용해 구현한다. 화면과 TTS가 같은 설명을 표현하면
   문장 선택·강조·발화·취소 상태의 연결도 검증한다. 시각 작업을 이유로 학습 데이터를 바꾸지 않는다.
5. [브라우저 검증 절차](../../../docs/design/06-workflow.md)에 따라 캡처와 상호작용 검증을 실행한다.
   실제 이미지를 열어 보고 비평한다. 스크린샷 파일이 생성됐다는 사실만으로 디자인을 평가하지 않는다.
6. [visual-critic](../vocaflow-visual-critic/SKILL.md)의 (a) 익명성 → (b) 평균 회귀 → (c) 골든 → (d) 포트폴리오 → (e) 규칙 순으로 판정하고,
   가장 나쁜 것 1개를 수정한 뒤 같은 조건에서 다시 검증한다(2회까지, 그 뒤는 사람 판단).
   관찰되지 않은 문제를 개수에 맞춰 지어내거나 근거 없는 무한 수정을 하지 않는다.

완료 시 화면 증거, 해결한 문제, 자동 검사와 수동 확인의 범위, 미검증 항목을 구분한다.
새 화면에 필요한 분석 이벤트·도움말·문서 갱신은 AGENTS.md를 따른다.
