// apps/web/src/lib/csat/map/v4/definition.data.ts
// 생성물 — 손으로 고치지 않는다. 원천 docs/csat-learner/v4/*.json → node scripts/csat/map/v4/gen-definition.mjs
// 최신 여부: definition.test.ts 가 --check 와 같은 비교를 한다.

import type { V4Data } from './types'

export const V4_DATA: V4Data = {
 "version": "rev4.0-draft-1",
 "domains": [
  {
   "axis": "V",
   "name": "어휘·표현 의미"
  },
  {
   "axis": "S",
   "name": "문장 이해"
  },
  {
   "axis": "R",
   "name": "글 이해"
  },
  {
   "axis": "E",
   "name": "근거·선지 판단"
  },
  {
   "axis": "L",
   "name": "듣기"
  },
  {
   "axis": "X",
   "name": "실전"
  }
 ],
 "tasks": [
  {
   "id": "v.core_meaning",
   "display": "V1",
   "axis": "V",
   "kind": "atomic",
   "status": "canon_candidate",
   "name": "기본 의미 접근",
   "goal": "시험 빈도 낱말의 기본 의미를 문맥 없이도 바로 꺼낸다",
   "conditions": "고등 기출 빈도 어휘 · 시간 제한 없음",
   "evidence": "낱말 → 뜻 인출 정답(독립 첫 시도)",
   "criterion": "도움 없이 맞히고, 다른 날 다시 맞힌다",
   "quantity_policy": "모르는 낱말 수 기준 간격 반복 분량(FSRS due)",
   "direct_check": "content_needed",
   "methods": [
    "I6",
    "A1-2"
   ],
   "assets": [
    "shared_dictionary",
    "WordVault·Flashcard(FSRS)"
   ]
  },
  {
   "id": "v.contextual_sense",
   "display": "V2",
   "axis": "V",
   "kind": "atomic",
   "status": "canon_candidate",
   "name": "문맥 의미 선택",
   "goal": "다의어에서 이 문장에 맞는 의미를 고른다",
   "conditions": "기출 지문 문장 안",
   "evidence": "문맥 의미 선택 정답 + 근거 낱말 지목",
   "criterion": "서로 다른 문맥 2개 이상에서 맞힌다",
   "quantity_policy": "확인 문항 묶음 단위",
   "direct_check": "content_needed",
   "methods": [
    "I6-3",
    "B9-2"
   ],
   "assets": [
    "csat_items(어휘 문항)"
   ]
  },
  {
   "id": "v.multiword",
   "display": "V3",
   "axis": "V",
   "kind": "atomic",
   "status": "canon_candidate",
   "name": "덩어리 표현",
   "goal": "구·숙어·연어를 한 의미 단위로 읽는다",
   "conditions": "기출 지문",
   "evidence": "덩어리 경계·의미 정답",
   "criterion": "낱낱 해석으로 바꾸지 않고 의미를 말한다",
   "quantity_policy": "표현 목록 간격 반복",
   "direct_check": "content_needed",
   "methods": [
    "I6"
   ],
   "assets": []
  },
  {
   "id": "v.semantic_relation",
   "display": "V4",
   "axis": "V",
   "kind": "atomic",
   "status": "canon_candidate",
   "name": "표현 사이 의미 관계",
   "goal": "유의·반의·상하위 표현의 의미 동등성을 판단한다",
   "conditions": "본문 표현 ↔ 다른 표현",
   "evidence": "두 표현이 같은 뜻인지 판정 + 이유",
   "criterion": "재진술 쌍을 가려낸다",
   "quantity_policy": "확인 문항 묶음",
   "direct_check": "content_needed",
   "methods": [
    "A4-2"
   ],
   "assets": []
  },
  {
   "id": "s.sentence_core",
   "display": "S1",
   "axis": "S",
   "kind": "atomic",
   "status": "canon_candidate",
   "name": "문장 뼈대",
   "goal": "주어·서술어·목적어·보어를 찾는다",
   "conditions": "기출 긴 문장",
   "evidence": "뼈대 표시 정답",
   "criterion": "3문장 이상 연속 정확",
   "quantity_policy": "막힌 문장 수집량 기준",
   "direct_check": "content_needed",
   "methods": [
    "I2",
    "A2-2"
   ],
   "assets": [
    "csat_item_units"
   ]
  },
  {
   "id": "s.chunk_boundary",
   "display": "S2",
   "axis": "S",
   "kind": "atomic",
   "status": "canon_candidate",
   "name": "의미 단위 경계",
   "goal": "구·절 경계를 끊어 읽는다",
   "conditions": "기출 문장",
   "evidence": "경계 표시",
   "criterion": "경계 오류 없이 풀어 쓴다",
   "quantity_policy": "문장 묶음",
   "direct_check": "content_needed",
   "methods": [
    "I2"
   ],
   "assets": [
    "csat_item_units"
   ]
  },
  {
   "id": "s.attachment",
   "display": "S3",
   "axis": "S",
   "kind": "atomic",
   "status": "canon_candidate",
   "name": "수식 관계",
   "goal": "무엇이 무엇을 꾸미는지 정한다",
   "conditions": "수식어가 긴 문장",
   "evidence": "피수식어 지목",
   "criterion": "다른 문장에서도 맞힌다",
   "quantity_policy": "문장 묶음",
   "direct_check": "content_needed",
   "methods": [
    "I2"
   ],
   "assets": []
  },
  {
   "id": "s.structural_relation",
   "display": "S4",
   "axis": "S",
   "kind": "atomic",
   "status": "canon_candidate",
   "name": "구조 관계",
   "goal": "병렬·종속·삽입·생략·도치를 풀어낸다",
   "conditions": "복합 구조 문장",
   "evidence": "구조 복원 정답",
   "criterion": "풀어 쓰기가 원문 의미와 같다",
   "quantity_policy": "문장 묶음",
   "direct_check": "content_needed",
   "methods": [
    "I2",
    "A2-3"
   ],
   "assets": []
  },
  {
   "id": "s.form_scope",
   "display": "S5",
   "axis": "S",
   "kind": "atomic",
   "status": "canon_candidate",
   "name": "형태·의미 범위",
   "goal": "문법 형태와 부정·비교·조건의 범위를 판단한다",
   "conditions": "어법 문항 + 독해 문장",
   "evidence": "어법 판정 + 이유",
   "criterion": "포인트별 서로 다른 문항 2개 이상",
   "quantity_policy": "포인트별 기출 반복",
   "direct_check": "content_needed",
   "methods": [
    "A8-2",
    "B9-1"
   ],
   "assets": [
    "csat_items(어법)"
   ]
  },
  {
   "id": "s.o.sentence_meaning_model",
   "display": "S-O1",
   "axis": "S",
   "kind": "integrated",
   "status": "canon_candidate",
   "name": "문장 의미 구성(통합 관찰)",
   "goal": "한 문장의 명제와 핵심·부가 정보를 우리말로 구성한다",
   "conditions": "기출 문장 · 도움 없이",
   "evidence": "명제 풀어 쓰기",
   "criterion": "숙달도 계산 없음 — 관찰 기록만",
   "quantity_policy": "없음(통합 관찰)",
   "direct_check": "content_needed",
   "methods": [
    "A2-4"
   ],
   "assets": []
  },
  {
   "id": "r.reference",
   "display": "R1",
   "axis": "R",
   "kind": "atomic",
   "status": "canon_candidate",
   "name": "지시·응집 추적",
   "goal": "대명사·지시어·같은 개념의 연결을 추적한다",
   "conditions": "기출 지문",
   "evidence": "지시 대상 지목",
   "criterion": "서로 다른 지문 2개",
   "quantity_policy": "확인 문항 묶음",
   "direct_check": "ready",
   "methods": [
    "B11-1"
   ],
   "assets": [
    "cohesion-link"
   ]
  },
  {
   "id": "r.relation",
   "display": "R2",
   "axis": "R",
   "kind": "atomic",
   "status": "canon_candidate",
   "name": "문장 사이 관계",
   "goal": "인접 문장의 관계(인과·대조·예시·재진술 …)를 구성한다",
   "conditions": "기출 지문 · relation facet 기록",
   "evidence": "관계 종류 + 근거 단서",
   "criterion": "facet 별 막대 없음 — 관찰 근거 내역만",
   "quantity_policy": "확인 문항 묶음",
   "direct_check": "ready",
   "methods": [
    "A3-1"
   ],
   "assets": [
    "cohesion-link"
   ]
  },
  {
   "id": "r.discourse_function",
   "display": "R3",
   "axis": "R",
   "kind": "atomic",
   "status": "canon_candidate",
   "name": "문장·문단 기능",
   "goal": "이 문장이 지금 하는 역할(근거·예시·반론 …)을 말한다",
   "conditions": "기출 지문",
   "evidence": "역할 표시",
   "criterion": "§20-2 하향 조건 — Gold tagging 에서 R4 와 독립 관찰 확인 전 잠정",
   "quantity_policy": "확인 문항 묶음",
   "direct_check": "live",
   "methods": [
    "A3-2"
   ],
   "assets": [
    "claim-support",
    "passage_design.roles"
   ]
  },
  {
   "id": "r.discourse_structure",
   "display": "R4",
   "axis": "R",
   "kind": "atomic",
   "status": "canon_candidate",
   "name": "글 전개 구조",
   "goal": "역할들이 모여 만드는 전개 방식을 재구성한다",
   "conditions": "기출 지문",
   "evidence": "구조 유형 + 근거",
   "criterion": "R3 와 다른 근거로 관찰될 때만 독립",
   "quantity_policy": "확인 문항 묶음",
   "direct_check": "live",
   "methods": [
    "I1"
   ],
   "assets": [
    "claim-support",
    "passage_design.pattern"
   ]
  },
  {
   "id": "r.central_meaning",
   "display": "R5",
   "axis": "R",
   "kind": "atomic",
   "status": "canon_candidate",
   "name": "중심 의미",
   "goal": "중심과 부연을 가르고 핵심 주장을 한 줄로 압축한다",
   "conditions": "주제·요지·제목 지문",
   "evidence": "한 줄 요지 + 중심 문장",
   "criterion": "서로 다른 지문 2개 독립 확인 + 다른 날 재확인",
   "quantity_policy": "확인 9문항 묶음(claim-support) 기준",
   "direct_check": "live",
   "methods": [
    "I1-3",
    "I5-1"
   ],
   "assets": [
    "claim-support"
   ]
  },
  {
   "id": "r.inference",
   "display": "R6",
   "axis": "R",
   "kind": "atomic",
   "status": "canon_candidate",
   "name": "추론",
   "goal": "쓰이지 않은 의미를 글 근거로 도출한다",
   "conditions": "함축·빈칸 지문",
   "evidence": "추론 + 근거 문장",
   "criterion": "근거 없는 추론은 실패",
   "quantity_policy": "확인 문항 묶음",
   "direct_check": "content_needed",
   "methods": [
    "B7-1"
   ],
   "assets": []
  },
  {
   "id": "r.o.global_meaning_model",
   "display": "R-O1",
   "axis": "R",
   "kind": "integrated",
   "status": "canon_candidate",
   "name": "글 전체 의미 모델(통합 관찰)",
   "goal": "글 전체의 일관된 의미를 구성한다",
   "conditions": "장문·고난도",
   "evidence": "구조도 + 요지",
   "criterion": "숙달도 계산 없음",
   "quantity_policy": "없음",
   "direct_check": "content_needed",
   "methods": [
    "I1"
   ],
   "assets": []
  },
  {
   "id": "e.task_demand",
   "display": "E1",
   "axis": "E",
   "kind": "atomic",
   "status": "canon_candidate",
   "name": "발문 요구 파악",
   "goal": "발문이 요구하는 판단을 정확히 말한다",
   "conditions": "모든 유형",
   "evidence": "요구 진술",
   "criterion": "유형 2개 이상",
   "quantity_policy": "확인 문항",
   "direct_check": "content_needed",
   "methods": [
    "B1-1"
   ],
   "assets": []
  },
  {
   "id": "e.evidence_location",
   "display": "E2",
   "axis": "E",
   "kind": "atomic",
   "status": "canon_candidate",
   "name": "근거 위치",
   "goal": "판단을 정하는 본문 근거 문장을 특정한다",
   "conditions": "빈칸 지문 등",
   "evidence": "근거 문장 지목(Evidence Anchor 결속)",
   "criterion": "서로 다른 확인 문항 2개 독립 정답 → 다른 날 재확인",
   "quantity_policy": "확인 5문항 묶음",
   "direct_check": "live",
   "methods": [
    "A5-1"
   ],
   "assets": [
    "evidence-locate",
    "answer_locus"
   ]
  },
  {
   "id": "e.option_correspondence",
   "display": "E3",
   "axis": "E",
   "kind": "atomic",
   "status": "canon_candidate",
   "name": "선지-본문 대응",
   "goal": "선지가 본문의 어떤 의미를 다시 말했는지(또는 바꿨는지) 판단한다",
   "conditions": "주제·제목·요지 지문 · judgment facet 기록",
   "evidence": "대응 본문 문장 지목",
   "criterion": "facet 별 막대 없음 · 함정 선택만으로 약함 판정 금지",
   "quantity_policy": "확인 6문항 묶음",
   "direct_check": "live",
   "methods": [
    "A5-2",
    "B6-3"
   ],
   "assets": [
    "option-restate",
    "choice_analysis.how_to_reject"
   ]
  },
  {
   "id": "e.o.final_judgment",
   "display": "E-O1",
   "axis": "E",
   "kind": "integrated",
   "status": "canon_candidate",
   "name": "최종 판단(통합 관찰)",
   "goal": "정답 선택과 배제 이유를 함께 낸다",
   "conditions": "정답 + 과정 근거",
   "evidence": "선택 + 근거 + 배제 이유",
   "criterion": "추측 정답은 근거 아님",
   "quantity_policy": "없음",
   "direct_check": "content_needed",
   "methods": [
    "I9"
   ],
   "assets": [
    "reveal-gate GateCommit"
   ]
  },
  {
   "id": "l.sound",
   "display": "L1",
   "axis": "L",
   "kind": "atomic",
   "status": "hold",
   "name": "소리 인식",
   "goal": "(보류) 연음·약음을 낱말로 인식",
   "conditions": "—",
   "evidence": "—",
   "criterion": "—",
   "quantity_policy": "—",
   "direct_check": "blocked",
   "methods": [
    "I7"
   ],
   "assets": []
  },
  {
   "id": "l.sentence",
   "display": "L2",
   "axis": "L",
   "kind": "atomic",
   "status": "hold",
   "name": "들은 문장 이해",
   "goal": "(보류)",
   "conditions": "—",
   "evidence": "—",
   "criterion": "—",
   "quantity_policy": "—",
   "direct_check": "blocked",
   "methods": [
    "I7"
   ],
   "assets": []
  },
  {
   "id": "l.retain",
   "display": "L3",
   "axis": "L",
   "kind": "atomic",
   "status": "hold",
   "name": "정보 유지",
   "goal": "(보류)",
   "conditions": "—",
   "evidence": "—",
   "criterion": "—",
   "quantity_policy": "—",
   "direct_check": "blocked",
   "methods": [
    "B3-1"
   ],
   "assets": []
  },
  {
   "id": "l.respond",
   "display": "L4",
   "axis": "L",
   "kind": "atomic",
   "status": "hold",
   "name": "응답 판단",
   "goal": "(보류)",
   "conditions": "—",
   "evidence": "—",
   "criterion": "—",
   "quantity_policy": "—",
   "direct_check": "blocked",
   "methods": [
    "B4-1"
   ],
   "assets": []
  },
  {
   "id": "x.time_allocation",
   "display": "X1",
   "axis": "X",
   "kind": "atomic",
   "status": "hold",
   "name": "시간 배분",
   "goal": "(보류 §20-4) 영역·문항 시간 배분을 지킨다",
   "conditions": "실전 70분",
   "evidence": "문항별 시간(유효 데이터 0)",
   "criterion": "—",
   "quantity_policy": "—",
   "direct_check": "blocked",
   "methods": [
    "J1"
   ],
   "assets": [
    "csat_session_attempts.sec"
   ]
  },
  {
   "id": "x.sequence",
   "display": "X2",
   "axis": "X",
   "kind": "atomic",
   "status": "hold",
   "name": "풀이 순서",
   "goal": "(보류)",
   "conditions": "—",
   "evidence": "—",
   "criterion": "—",
   "quantity_policy": "—",
   "direct_check": "blocked",
   "methods": [
    "J2"
   ],
   "assets": []
  },
  {
   "id": "x.recovery_adaptation",
   "display": "X3",
   "axis": "X",
   "kind": "atomic",
   "status": "hold",
   "name": "막힘 회복",
   "goal": "(보류)",
   "conditions": "—",
   "evidence": "—",
   "criterion": "—",
   "quantity_policy": "—",
   "direct_check": "blocked",
   "methods": [
    "J3"
   ],
   "assets": []
  },
  {
   "id": "x.attention_stamina",
   "display": "X4",
   "axis": "X",
   "kind": "atomic",
   "status": "hold",
   "name": "집중 유지",
   "goal": "(보류)",
   "conditions": "—",
   "evidence": "—",
   "criterion": "—",
   "quantity_policy": "—",
   "direct_check": "blocked",
   "methods": [
    "J5"
   ],
   "assets": []
  },
  {
   "id": "x.o.whole_test_stability",
   "display": "X-O1",
   "axis": "X",
   "kind": "integrated",
   "status": "hold",
   "name": "전체 시험 안정성(통합 관찰)",
   "goal": "(보류)",
   "conditions": "—",
   "evidence": "—",
   "criterion": "숙달도 계산 없음",
   "quantity_policy": "—",
   "direct_check": "blocked",
   "methods": [
    "I4"
   ],
   "assets": []
  }
 ],
 "lines": {
  "A1": {
   "crosswalk_status": "retain_core",
   "decision": "유지",
   "layer": "domain",
   "v4": [
    "v.core_meaning",
    "v.contextual_sense",
    "v.multiword",
    "v.semantic_relation"
   ],
   "performance_goal": true
  },
  "A2": {
   "crosswalk_status": "retain_core",
   "decision": "분할",
   "layer": "domain",
   "v4": [
    "s.sentence_core",
    "s.chunk_boundary",
    "s.attachment",
    "s.structural_relation",
    "s.o.sentence_meaning_model"
   ],
   "performance_goal": true
  },
  "A3": {
   "crosswalk_status": "retain_core",
   "decision": "분할",
   "layer": "domain",
   "v4": [
    "r.reference",
    "r.relation",
    "r.discourse_function",
    "r.discourse_structure"
   ],
   "performance_goal": true
  },
  "A4": {
   "crosswalk_status": "retain_as_facet",
   "decision": "분할",
   "layer": "facet",
   "v4": [
    "v.semantic_relation",
    "r.relation",
    "e.option_correspondence"
   ],
   "performance_goal": false
  },
  "A5": {
   "crosswalk_status": "retain_core",
   "decision": "유지",
   "layer": "domain",
   "v4": [
    "e.task_demand",
    "e.evidence_location",
    "e.option_correspondence",
    "e.o.final_judgment"
   ],
   "performance_goal": true
  },
  "A6": {
   "crosswalk_status": "move_layer",
   "decision": "재분류",
   "layer": "k.context_resource",
   "v4": [],
   "performance_goal": false
  },
  "A7": {
   "crosswalk_status": "retain_core",
   "decision": "보류",
   "layer": "domain",
   "v4": [
    "l.sound",
    "l.sentence",
    "l.retain",
    "l.respond"
   ],
   "performance_goal": true
  },
  "A8": {
   "crosswalk_status": "retain_core",
   "decision": "재분류",
   "layer": "domain",
   "v4": [
    "s.form_scope"
   ],
   "performance_goal": true
  },
  "A9": {
   "crosswalk_status": "retain_core",
   "decision": "분할",
   "layer": "domain",
   "v4": [
    "x.attention_stamina",
    "x.o.whole_test_stability"
   ],
   "performance_goal": true
  },
  "B1": {
   "crosswalk_status": "move_layer",
   "decision": "재분류",
   "layer": "lens.question_type",
   "v4": [
    "l.respond",
    "l.sentence"
   ],
   "performance_goal": false
  },
  "B2": {
   "crosswalk_status": "move_layer",
   "decision": "재분류",
   "layer": "lens.question_type",
   "v4": [
    "l.retain"
   ],
   "performance_goal": false
  },
  "B3": {
   "crosswalk_status": "move_layer",
   "decision": "재분류",
   "layer": "lens.question_type",
   "v4": [
    "l.retain"
   ],
   "performance_goal": false
  },
  "B4": {
   "crosswalk_status": "move_layer",
   "decision": "재분류",
   "layer": "lens.question_type",
   "v4": [
    "l.respond"
   ],
   "performance_goal": false
  },
  "B5": {
   "crosswalk_status": "move_layer",
   "decision": "재분류",
   "layer": "lens.question_type",
   "v4": [
    "l.retain"
   ],
   "performance_goal": false
  },
  "B6": {
   "crosswalk_status": "move_layer",
   "decision": "재분류",
   "layer": "lens.question_type",
   "v4": [
    "r.central_meaning",
    "e.option_correspondence"
   ],
   "performance_goal": false
  },
  "B7": {
   "crosswalk_status": "move_layer",
   "decision": "재분류",
   "layer": "lens.question_type",
   "v4": [
    "r.inference",
    "v.contextual_sense"
   ],
   "performance_goal": false
  },
  "B8": {
   "crosswalk_status": "move_layer",
   "decision": "재분류",
   "layer": "lens.question_type",
   "v4": [
    "e.evidence_location",
    "e.option_correspondence"
   ],
   "performance_goal": false
  },
  "B9": {
   "crosswalk_status": "move_layer",
   "decision": "재분류",
   "layer": "lens.question_type",
   "v4": [
    "s.form_scope",
    "v.contextual_sense"
   ],
   "performance_goal": false
  },
  "B10": {
   "crosswalk_status": "move_layer",
   "decision": "재분류",
   "layer": "lens.question_type",
   "v4": [
    "r.central_meaning",
    "r.inference",
    "e.evidence_location"
   ],
   "performance_goal": false
  },
  "B11": {
   "crosswalk_status": "move_layer",
   "decision": "재분류",
   "layer": "lens.question_type",
   "v4": [
    "r.reference",
    "r.relation",
    "r.discourse_structure"
   ],
   "performance_goal": false
  },
  "B12": {
   "crosswalk_status": "move_layer",
   "decision": "재분류",
   "layer": "lens.question_type",
   "v4": [
    "r.central_meaning",
    "v.semantic_relation"
   ],
   "performance_goal": false
  },
  "B13": {
   "crosswalk_status": "move_layer",
   "decision": "재분류",
   "layer": "lens.question_type",
   "v4": [
    "r.o.global_meaning_model",
    "x.time_allocation"
   ],
   "performance_goal": false
  },
  "C1": {
   "crosswalk_status": "move_layer",
   "decision": "재분류",
   "layer": "feature.choice_trap",
   "v4": [],
   "performance_goal": false
  },
  "C2": {
   "crosswalk_status": "move_layer",
   "decision": "재분류",
   "layer": "feature.choice_trap",
   "v4": [],
   "performance_goal": false
  },
  "C3": {
   "crosswalk_status": "move_layer",
   "decision": "재분류",
   "layer": "feature.choice_trap",
   "v4": [],
   "performance_goal": false
  },
  "C4": {
   "crosswalk_status": "move_layer",
   "decision": "재분류",
   "layer": "feature.choice_trap",
   "v4": [],
   "performance_goal": false
  },
  "C5": {
   "crosswalk_status": "move_layer",
   "decision": "재분류",
   "layer": "feature.choice_trap",
   "v4": [],
   "performance_goal": false
  },
  "C6": {
   "crosswalk_status": "move_layer",
   "decision": "재분류",
   "layer": "feature.choice_trap",
   "v4": [],
   "performance_goal": false
  },
  "C7": {
   "crosswalk_status": "move_layer",
   "decision": "재분류",
   "layer": "feature.choice_trap",
   "v4": [],
   "performance_goal": false
  },
  "C8": {
   "crosswalk_status": "legacy_alias",
   "decision": "보류",
   "layer": "feature.choice_trap",
   "v4": [],
   "performance_goal": false
  },
  "D1": {
   "crosswalk_status": "retire_from_vnext",
   "decision": "보류",
   "layer": "retired",
   "v4": [],
   "performance_goal": false
  },
  "D2": {
   "crosswalk_status": "retire_from_vnext",
   "decision": "보류",
   "layer": "retired",
   "v4": [],
   "performance_goal": false
  },
  "D3": {
   "crosswalk_status": "legacy_alias",
   "decision": "보류",
   "layer": "legacy.alias",
   "v4": [],
   "performance_goal": false
  },
  "D4": {
   "crosswalk_status": "retire_from_vnext",
   "decision": "보류",
   "layer": "retired",
   "v4": [],
   "performance_goal": false
  },
  "D5": {
   "crosswalk_status": "move_layer",
   "decision": "재분류",
   "layer": "domain",
   "v4": [
    "x.time_allocation",
    "x.attention_stamina"
   ],
   "performance_goal": false
  },
  "D6": {
   "crosswalk_status": "move_layer",
   "decision": "재분류",
   "layer": "pedagogy.method",
   "v4": [],
   "performance_goal": false
  },
  "D7": {
   "crosswalk_status": "retire_from_vnext",
   "decision": "보류",
   "layer": "retired",
   "v4": [],
   "performance_goal": false
  },
  "D8": {
   "crosswalk_status": "move_layer",
   "decision": "재분류",
   "layer": "pedagogy.method",
   "v4": [],
   "performance_goal": false
  },
  "D9": {
   "crosswalk_status": "move_layer",
   "decision": "재분류",
   "layer": "plan.allocation",
   "v4": [],
   "performance_goal": false
  },
  "I1": {
   "crosswalk_status": "move_layer",
   "decision": "재분류",
   "layer": "pedagogy.method",
   "v4": [],
   "performance_goal": false
  },
  "I2": {
   "crosswalk_status": "move_layer",
   "decision": "재분류",
   "layer": "pedagogy.method",
   "v4": [],
   "performance_goal": false
  },
  "I3": {
   "crosswalk_status": "move_layer",
   "decision": "재분류",
   "layer": "pedagogy.method",
   "v4": [],
   "performance_goal": false
  },
  "I4": {
   "crosswalk_status": "move_layer",
   "decision": "재분류",
   "layer": "pedagogy.method",
   "v4": [],
   "performance_goal": false
  },
  "I5": {
   "crosswalk_status": "move_layer",
   "decision": "재분류",
   "layer": "pedagogy.method",
   "v4": [],
   "performance_goal": false
  },
  "I6": {
   "crosswalk_status": "move_layer",
   "decision": "재분류",
   "layer": "pedagogy.method",
   "v4": [],
   "performance_goal": false
  },
  "I7": {
   "crosswalk_status": "move_layer",
   "decision": "재분류",
   "layer": "pedagogy.method",
   "v4": [],
   "performance_goal": false
  },
  "I8": {
   "crosswalk_status": "move_layer",
   "decision": "재분류",
   "layer": "pedagogy.method",
   "v4": [],
   "performance_goal": false
  },
  "I9": {
   "crosswalk_status": "move_layer",
   "decision": "재분류",
   "layer": "pedagogy.method",
   "v4": [],
   "performance_goal": false
  },
  "I10": {
   "crosswalk_status": "move_layer",
   "decision": "재분류",
   "layer": "pedagogy.method",
   "v4": [],
   "performance_goal": false
  },
  "J1": {
   "crosswalk_status": "move_layer",
   "decision": "통합",
   "layer": "domain",
   "v4": [
    "x.time_allocation"
   ],
   "performance_goal": true
  },
  "J2": {
   "crosswalk_status": "move_layer",
   "decision": "통합",
   "layer": "domain",
   "v4": [
    "x.sequence"
   ],
   "performance_goal": true
  },
  "J3": {
   "crosswalk_status": "move_layer",
   "decision": "통합",
   "layer": "domain",
   "v4": [
    "x.recovery_adaptation"
   ],
   "performance_goal": true
  },
  "J4": {
   "crosswalk_status": "move_layer",
   "decision": "재분류",
   "layer": "context.performance",
   "v4": [],
   "performance_goal": false
  },
  "J5": {
   "crosswalk_status": "move_layer",
   "decision": "분할",
   "layer": "domain",
   "v4": [
    "x.attention_stamina"
   ],
   "performance_goal": true
  }
 },
 "activityClass": {
  "A1-1": "DC",
  "A1-2": "LM",
  "A1-3": "DC",
  "A2-1": "DC",
  "A2-2": "LA",
  "A2-3": "LA",
  "A2-4": "DC",
  "A3-1": "LA",
  "A3-2": "LA",
  "A3-3": "DC",
  "A3-4": "DC",
  "A4-1": "LA",
  "A4-2": "LA",
  "A4-3": "DC",
  "A4-4": "DC",
  "A5-1": "LA",
  "A5-2": "LA",
  "A5-3": "DC",
  "A5-4": "DC",
  "A6-1": "DC",
  "A6-2": "MC",
  "A6-3": "MC",
  "A7-1": "DC",
  "A7-2": "LM",
  "A7-3": "LM",
  "A8-1": "DC",
  "A8-2": "LA",
  "A8-3": "MC",
  "A9-1": "DC",
  "A9-2": "LM",
  "A9-3": "LA",
  "B1-1": "LM",
  "B1-2": "MC",
  "B1-3": "DC",
  "B2-1": "LA",
  "B2-2": "MC",
  "B2-3": "LA",
  "B2-4": "DC",
  "B3-1": "LM",
  "B3-2": "MC",
  "B3-3": "LA",
  "B4-1": "LM",
  "B4-2": "LM",
  "B4-3": "DC",
  "B4-4": "DC",
  "B5-1": "LM",
  "B5-2": "MC",
  "B5-3": "DC",
  "B6-1": "LA",
  "B6-2": "MC",
  "B6-3": "DC",
  "B7-1": "LA",
  "B7-2": "MG",
  "B7-3": "DC",
  "B7-4": "DC",
  "B8-1": "LA",
  "B8-2": "LA",
  "B8-3": "MC",
  "B8-4": "DC",
  "B9-1": "MC",
  "B9-2": "LM",
  "B9-3": "DC",
  "B10-1": "LM",
  "B10-2": "DC",
  "B10-3": "MG",
  "B11-1": "LA",
  "B11-2": "LA",
  "B11-3": "MG",
  "B11-4": "DC",
  "B12-1": "LM",
  "B12-2": "LA",
  "B12-3": "MG",
  "B12-4": "DC",
  "B13-1": "LM",
  "B13-2": "LM",
  "B13-3": "LM",
  "B13-4": "DC",
  "C1-1": "LA",
  "C1-2": "MC",
  "C1-3": "DC",
  "C2-1": "LA",
  "C2-2": "MC",
  "C2-3": "DC",
  "C3-1": "LA",
  "C3-2": "MC",
  "C3-3": "DC",
  "C4-1": "LA",
  "C4-2": "MC",
  "C4-3": "DC",
  "C5-1": "LA",
  "C5-2": "MC",
  "C5-3": "DC",
  "C6-1": "LA",
  "C6-2": "MC",
  "C6-3": "DC",
  "C7-1": "LA",
  "C7-2": "MC",
  "C7-3": "DC",
  "C8-1": "LA",
  "C8-2": "MC",
  "C8-3": "MG",
  "C8-4": "DC",
  "D1-1": "LM",
  "D1-2": "LM",
  "D1-3": "DC",
  "D1-4": "DC",
  "D2-1": "MG",
  "D2-2": "MG",
  "D2-3": "DC",
  "D3-1": "LA",
  "D3-2": "MC",
  "D3-3": "LM",
  "D3-4": "DC",
  "D4-1": "DC",
  "D4-2": "MG",
  "D4-3": "DC",
  "D5-1": "MG",
  "D5-2": "MG",
  "D5-3": "LM",
  "D6-1": "LM",
  "D6-2": "LA",
  "D6-3": "MG",
  "D7-1": "MG",
  "D7-2": "MC",
  "D7-3": "MG",
  "D8-1": "DC",
  "D8-2": "LM",
  "D8-3": "MC",
  "D9-1": "MG",
  "D9-2": "MG",
  "D9-3": "DC",
  "D9-4": "DC",
  "I1-1": "LA",
  "I1-2": "LM",
  "I1-3": "LA",
  "I2-1": "LA",
  "I2-2": "LA",
  "I2-3": "LA",
  "I3-1": "LM",
  "I3-2": "MG",
  "I3-3": "MG",
  "I4-1": "LM",
  "I4-2": "MG",
  "I4-3": "LM",
  "I5-1": "LA",
  "I5-2": "MC",
  "I5-3": "LA",
  "I5-4": "DC",
  "I6-1": "MG",
  "I6-2": "LM",
  "I6-3": "LA",
  "I7-1": "LM",
  "I7-2": "LM",
  "I7-3": "LM",
  "I7-4": "DC",
  "I8-1": "MG",
  "I8-2": "MC",
  "I8-3": "LA",
  "I9-1": "LM",
  "I9-2": "DC",
  "I9-3": "LA",
  "I10-1": "LM",
  "I10-2": "LA",
  "I10-3": "LA",
  "I10-4": "DC",
  "J1-1": "MG",
  "J1-2": "LA",
  "J1-3": "MG",
  "J1-4": "DC",
  "J2-1": "MG",
  "J2-2": "LA",
  "J2-3": "MG",
  "J2-4": "DC",
  "J3-1": "MG",
  "J3-2": "MC",
  "J3-3": "MG",
  "J4-1": "DC",
  "J4-2": "MG",
  "J4-3": "DC",
  "J5-1": "LA",
  "J5-2": "MG",
  "J5-3": "DC",
  "J5-4": "DC"
 },
 "activityTaskOverride": {
  "A2-4": [
   "s.o.sentence_meaning_model"
  ],
  "A3-1": [
   "r.relation"
  ],
  "A3-2": [
   "r.discourse_function"
  ],
  "A3-4": [
   "r.reference",
   "r.relation"
  ],
  "A4-4": [
   "e.option_correspondence"
  ],
  "A5-1": [
   "e.evidence_location"
  ],
  "A5-2": [
   "e.option_correspondence"
  ],
  "A5-4": [
   "e.evidence_location"
  ],
  "B6-3": [
   "r.central_meaning",
   "r.discourse_structure"
  ],
  "I1-3": [
   "r.central_meaning"
  ],
  "I2-2": [
   "s.sentence_core"
  ],
  "I2-3": [
   "s.structural_relation"
  ],
  "I5-1": [
   "r.central_meaning"
  ],
  "I6-2": [
   "v.core_meaning"
  ],
  "I6-3": [
   "v.contextual_sense"
  ],
  "I9-1": [
   "e.o.final_judgment"
  ],
  "I10-2": [
   "e.task_demand"
  ]
 },
 "inAppExecution": {
  "B6-3": "live",
  "A4-4": "live",
  "A5-4": "live",
  "A3-4": "draft"
 },
 "relations": [
  {
   "id": "rel-001",
   "type": "PART_OF",
   "from": "s.sentence_core",
   "to": "s.o.sentence_meaning_model",
   "basis": "canon_rev2.1",
   "ref": "§3 S",
   "status": "approved"
  },
  {
   "id": "rel-002",
   "type": "PART_OF",
   "from": "s.chunk_boundary",
   "to": "s.o.sentence_meaning_model",
   "basis": "canon_rev2.1",
   "ref": "§3 S",
   "status": "approved"
  },
  {
   "id": "rel-003",
   "type": "PART_OF",
   "from": "s.attachment",
   "to": "s.o.sentence_meaning_model",
   "basis": "canon_rev2.1",
   "ref": "§3 S",
   "status": "approved"
  },
  {
   "id": "rel-004",
   "type": "PART_OF",
   "from": "s.structural_relation",
   "to": "s.o.sentence_meaning_model",
   "basis": "canon_rev2.1",
   "ref": "§3 S",
   "status": "approved"
  },
  {
   "id": "rel-005",
   "type": "PART_OF",
   "from": "s.form_scope",
   "to": "s.o.sentence_meaning_model",
   "basis": "canon_rev2.1",
   "ref": "§3 S",
   "status": "approved"
  },
  {
   "id": "rel-006",
   "type": "PART_OF",
   "from": "r.reference",
   "to": "r.o.global_meaning_model",
   "basis": "canon_rev2.1",
   "ref": "§3 R",
   "status": "approved"
  },
  {
   "id": "rel-007",
   "type": "PART_OF",
   "from": "r.relation",
   "to": "r.o.global_meaning_model",
   "basis": "canon_rev2.1",
   "ref": "§3 R",
   "status": "approved"
  },
  {
   "id": "rel-008",
   "type": "PART_OF",
   "from": "r.discourse_function",
   "to": "r.o.global_meaning_model",
   "basis": "canon_rev2.1",
   "ref": "§3 R",
   "status": "approved"
  },
  {
   "id": "rel-009",
   "type": "PART_OF",
   "from": "r.discourse_structure",
   "to": "r.o.global_meaning_model",
   "basis": "canon_rev2.1",
   "ref": "§3 R",
   "status": "approved"
  },
  {
   "id": "rel-010",
   "type": "PART_OF",
   "from": "r.central_meaning",
   "to": "r.o.global_meaning_model",
   "basis": "canon_rev2.1",
   "ref": "§3 R",
   "status": "approved"
  },
  {
   "id": "rel-011",
   "type": "PART_OF",
   "from": "r.inference",
   "to": "r.o.global_meaning_model",
   "basis": "canon_rev2.1",
   "ref": "§3 R",
   "status": "approved"
  },
  {
   "id": "rel-012",
   "type": "PART_OF",
   "from": "e.task_demand",
   "to": "e.o.final_judgment",
   "basis": "canon_rev2.1",
   "ref": "§3 E",
   "status": "approved"
  },
  {
   "id": "rel-013",
   "type": "PART_OF",
   "from": "e.evidence_location",
   "to": "e.o.final_judgment",
   "basis": "canon_rev2.1",
   "ref": "§3 E",
   "status": "approved"
  },
  {
   "id": "rel-014",
   "type": "PART_OF",
   "from": "e.option_correspondence",
   "to": "e.o.final_judgment",
   "basis": "canon_rev2.1",
   "ref": "§3 E",
   "status": "approved"
  },
  {
   "id": "rel-015",
   "type": "PART_OF",
   "from": "x.time_allocation",
   "to": "x.o.whole_test_stability",
   "basis": "canon_rev2.1",
   "ref": "§3 X",
   "status": "proposed"
  },
  {
   "id": "rel-016",
   "type": "PART_OF",
   "from": "x.sequence",
   "to": "x.o.whole_test_stability",
   "basis": "canon_rev2.1",
   "ref": "§3 X",
   "status": "proposed"
  },
  {
   "id": "rel-017",
   "type": "PART_OF",
   "from": "x.recovery_adaptation",
   "to": "x.o.whole_test_stability",
   "basis": "canon_rev2.1",
   "ref": "§3 X",
   "status": "proposed"
  },
  {
   "id": "rel-018",
   "type": "PART_OF",
   "from": "x.attention_stamina",
   "to": "x.o.whole_test_stability",
   "basis": "canon_rev2.1",
   "ref": "§3 X",
   "status": "proposed"
  },
  {
   "id": "rel-019",
   "type": "PREREQUISITE",
   "from": "v.core_meaning",
   "to": "s.o.sentence_meaning_model",
   "basis": "canon_rev2.1",
   "ref": "§5 LP1→LP2 · §6 dominant_dependency(잠금 아님)",
   "status": "proposed"
  },
  {
   "id": "rel-020",
   "type": "PREREQUISITE",
   "from": "s.o.sentence_meaning_model",
   "to": "r.relation",
   "basis": "canon_rev2.1",
   "ref": "§5 LP2→LP3 · ORM 2024-79-3 「문장 구조 → 문단 구조」",
   "status": "proposed"
  },
  {
   "id": "rel-021",
   "type": "SUPPORTS",
   "from": "r.relation",
   "to": "r.discourse_structure",
   "basis": "canon_rev2.1",
   "ref": "§5 LP3→LP4",
   "status": "proposed"
  },
  {
   "id": "rel-022",
   "type": "SUPPORTS",
   "from": "r.discourse_structure",
   "to": "r.central_meaning",
   "basis": "canon_rev2.1",
   "ref": "§5 LP4→LP5(처리 모델 가정 — 공식 위계 아님)",
   "status": "proposed"
  },
  {
   "id": "rel-023",
   "type": "SUPPORTS",
   "from": "r.discourse_function",
   "to": "r.discourse_structure",
   "basis": "canon_rev2.1",
   "ref": "§3 R3 local → R4 global",
   "status": "proposed"
  },
  {
   "id": "rel-024",
   "type": "SUPPORTS",
   "from": "r.reference",
   "to": "r.relation",
   "basis": "hypothesis",
   "ref": "§20-1 R1↔R2 보류 — 사람 dry run 뒤",
   "status": "proposed"
  },
  {
   "id": "rel-025",
   "type": "SUPPORTS",
   "from": "r.central_meaning",
   "to": "e.option_correspondence",
   "basis": "canon_rev2.1",
   "ref": "§5 LP5→LP6",
   "status": "proposed"
  },
  {
   "id": "rel-026",
   "type": "SUPPORTS",
   "from": "e.evidence_location",
   "to": "e.option_correspondence",
   "basis": "canon_rev2.1",
   "ref": "§3 E",
   "status": "proposed"
  },
  {
   "id": "rel-027",
   "type": "INTEGRATES_WITH",
   "from": "r.relation",
   "to": "e.option_correspondence",
   "basis": "canon_rev2.1",
   "ref": "§7 relation facet ↔ E3 relation_consistency",
   "status": "proposed"
  },
  {
   "id": "rel-028",
   "type": "INTEGRATES_WITH",
   "from": "v.semantic_relation",
   "to": "e.option_correspondence",
   "basis": "canon_rev2.1",
   "ref": "§8 paraphrase 세 층",
   "status": "proposed"
  },
  {
   "id": "rel-029",
   "type": "INTEGRATES_WITH",
   "from": "v.semantic_relation",
   "to": "r.relation",
   "basis": "canon_rev2.1",
   "ref": "§8 restatement",
   "status": "proposed"
  },
  {
   "id": "rel-030",
   "type": "TRANSFERS_TO",
   "from": "v.core_meaning",
   "to": "v.contextual_sense",
   "basis": "literature_hypothesis",
   "ref": "다의어 선택은 기본 의미 위에서",
   "status": "proposed"
  },
  {
   "id": "rel-031",
   "type": "TRANSFERS_TO",
   "from": "s.o.sentence_meaning_model",
   "to": "r.inference",
   "basis": "hypothesis",
   "ref": "함축 밑줄 = 문장 명제 + 추론",
   "status": "proposed"
  },
  {
   "id": "rel-032",
   "type": "ALTERNATIVE_PATH",
   "from": "r.central_meaning",
   "to": "e.evidence_location",
   "basis": "hypothesis",
   "ref": "빈칸: 요지에서 내려오기 vs 근거 문장에서 올라가기",
   "status": "proposed"
  },
  {
   "id": "rel-033",
   "type": "PREREQUISITE",
   "from": "e.task_demand",
   "to": "e.evidence_location",
   "basis": "literature_hypothesis",
   "ref": "요구를 알아야 근거를 찾는다",
   "status": "proposed"
  },
  {
   "id": "rel-034",
   "type": "SUPPORTS",
   "from": "r.o.global_meaning_model",
   "to": "x.o.whole_test_stability",
   "basis": "canon_rev2.1",
   "ref": "§5 LP7 — X 보류",
   "status": "proposed"
  }
 ],
 "templates": [
  {
   "id": "ws.central-meaning",
   "name": "글의 핵심 잡기",
   "goal": "주제·요지·제목 지문에서 중심 주장을 한 줄로 압축하고 근거 문장을 댄다",
   "core": [
    "r.central_meaning"
   ],
   "support": [
    "r.discourse_function",
    "r.discourse_structure"
   ],
   "relations": [
    "rel-022",
    "rel-023"
   ],
   "method": [
    "I1",
    "I5"
   ],
   "protocol": [
    3,
    4,
    5
   ],
   "content_keys": [
    "claim-support"
   ],
   "criterion": "서로 다른 지문 2개 독립 정답 → 120일 안 재확인 2연속 정답(resolved)",
   "readiness": "live",
   "hold": false
  },
  {
   "id": "ws.option-match",
   "name": "선지와 본문 맞대기",
   "goal": "선지가 본문의 어떤 의미를 다시 말했는지 지목한다",
   "core": [
    "e.option_correspondence"
   ],
   "support": [
    "v.semantic_relation",
    "r.central_meaning"
   ],
   "relations": [
    "rel-025",
    "rel-028"
   ],
   "method": [
    "I9",
    "I10"
   ],
   "protocol": [
    4,
    6,
    7
   ],
   "content_keys": [
    "option-restate"
   ],
   "criterion": "skill-diagnosis 와 같다",
   "readiness": "live",
   "hold": false
  },
  {
   "id": "ws.evidence-locate",
   "name": "근거 문장 찾기",
   "goal": "빈칸·판단을 정하는 본문 근거 문장을 특정한다",
   "core": [
    "e.evidence_location"
   ],
   "support": [
    "e.task_demand"
   ],
   "relations": [
    "rel-033",
    "rel-026"
   ],
   "method": [
    "I10",
    "A5-1"
   ],
   "protocol": [
    1,
    6,
    7
   ],
   "content_keys": [
    "evidence-locate"
   ],
   "criterion": "skill-diagnosis",
   "readiness": "live",
   "hold": false
  },
  {
   "id": "ws.cohesion",
   "name": "문장 잇기",
   "goal": "지시·연결 단서로 앞뒤 문장 관계를 구성한다",
   "core": [
    "r.relation"
   ],
   "support": [
    "r.reference"
   ],
   "relations": [
    "rel-024"
   ],
   "method": [
    "A3-1",
    "B11-1"
   ],
   "protocol": [
    2,
    1
   ],
   "content_keys": [
    "cohesion-link"
   ],
   "criterion": "skill-diagnosis",
   "readiness": "ready",
   "hold": false
  },
  {
   "id": "ws.sentence-core",
   "name": "긴 문장 뼈대",
   "goal": "긴 문장의 뼈대·경계·구조를 풀어 명제를 만든다",
   "core": [
    "s.o.sentence_meaning_model"
   ],
   "support": [
    "s.sentence_core",
    "s.chunk_boundary",
    "s.structural_relation"
   ],
   "relations": [
    "rel-001",
    "rel-002",
    "rel-004",
    "rel-020"
   ],
   "method": [
    "I2"
   ],
   "protocol": [
    1
   ],
   "content_keys": [],
   "criterion": "미정 — 직접 확인 도구 필요",
   "readiness": "content_needed",
   "hold": false
  },
  {
   "id": "ws.vocab-context",
   "name": "문맥 속 어휘",
   "goal": "기출 어휘의 기본·문맥 의미를 꺼낸다",
   "core": [
    "v.contextual_sense"
   ],
   "support": [
    "v.core_meaning",
    "v.multiword"
   ],
   "relations": [
    "rel-030"
   ],
   "method": [
    "I6"
   ],
   "protocol": [
    1
   ],
   "content_keys": [],
   "criterion": "미정",
   "readiness": "content_needed",
   "hold": false
  },
  {
   "id": "ws.grammar-scope",
   "name": "어법 포인트",
   "goal": "출제 포인트별 형태·범위를 판단한다",
   "core": [
    "s.form_scope"
   ],
   "support": [],
   "relations": [
    "rel-005"
   ],
   "method": [
    "A8-2",
    "B9-1"
   ],
   "protocol": [
    1
   ],
   "content_keys": [],
   "criterion": "미정",
   "readiness": "content_needed",
   "hold": false
  },
  {
   "id": "ws.inference",
   "name": "함축·추론",
   "goal": "밑줄 함축과 쓰이지 않은 의미를 근거로 도출한다",
   "core": [
    "r.inference"
   ],
   "support": [
    "s.o.sentence_meaning_model",
    "v.contextual_sense"
   ],
   "relations": [
    "rel-031"
   ],
   "method": [
    "B7-1"
   ],
   "protocol": [
    1,
    4
   ],
   "content_keys": [],
   "criterion": "미정",
   "readiness": "content_needed",
   "hold": false
  },
  {
   "id": "ws.timed",
   "name": "실전 운영(보류 템플릿)",
   "goal": "(보류) 시간 배분·순서·회복·집중",
   "core": [
    "x.o.whole_test_stability"
   ],
   "support": [
    "x.time_allocation",
    "x.sequence"
   ],
   "relations": [
    "rel-015",
    "rel-016"
   ],
   "method": [
    "I4",
    "J1"
   ],
   "protocol": [],
   "content_keys": [],
   "criterion": "—",
   "readiness": "blocked",
   "hold": true
  }
 ]
}
