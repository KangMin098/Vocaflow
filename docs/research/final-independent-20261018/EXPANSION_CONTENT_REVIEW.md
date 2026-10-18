<!-- docs/research/final-independent-20261018/EXPANSION_CONTENT_REVIEW.md -->
# TASK 확장 6세트 독립 내용 검토

고정 내용/채점기 `4655e9be45fd0a75e354421c3465ffbbb5537fd7`. 현재 **PARTIAL · REWORK**. 신규 세트36문항은 사람 Gold·권리·출시·실제 효과 승인 대상이며 Codex가 승인하지 않았다.

## 판독과 채점의 분리

[본문 패킷](./expansion-body-packet.json)은 Gold·교수 단계·힌트·작성자 리뷰를 제외했다. SHA-256 `c017245c8e14dcdce29f8fa1af144cb03459443a45be4f418cbca59de71fbe33`. 승인 패키지의 쟁점 요약을 먼저 보았으므로 완전히 정보가 없는 맹검이라고 주장하지 않는다.

Gold 대조 전에 [독립 풀이36건](./expansion-codex-reading.json)을 봉인했다(SHA-256 `94ab434ab46e436712ad5751aa05a490aa14676838d5fb8e2f6fa8ad58fe8c8b`). 선택/근거/문장 관계/문법 이유와 각 판단의 이유를 포함한다. 문법 의미 라벨 subject_verb_agreement/participle_voice/passive_voice는 실제 UI 열거형 agreement/participle/voice로 명시 변환했다. 봉인 원본은 바꾸지 않았다.

[현재 채점 대조](./expansion-reading-comparison.json)와 [실행기](../../../apps/web/scripts/final-independent/probe-expansion-reading.mjs): 실제 후보 형식 검증에서36건 오류0, 선택지가 있는30건의 선택 정답 전부 일치, 문장 관계6건/18쌍 수용. 전체 응답은31/36 수용이고5건은 아래처럼 갈렸다. 채점 결과 일치가 전체 내용의 사실성·평가 타당성·사람 승인/효과를 입증하지 않는다.

| 세트 | 문항 | 전체 응답 수용 | 주요 관찰 |
|---|---:|---:|---|
| e.evidence_location | 6 | 6 | 원문/요약문 범위와 결정 근거 선택을 분리. 단일 작물=유전적 동일성/항상 저항성은 실제 과학 설명으로 쓰기 전 내용 검토 필요 |
| e.option_correspondence | 6 | 4 | 내용 판단은 일치. opt-ind-1/opt-delayed-1에서 distorted와 reversed 분류가 갈림 |
| r.inference | 6 | 4 | 선택은 일치. inf-teach-1/inf-guided-1의 충분한 설명 근거를 골라도 지정 결론 문장이 없으면 오답 |
| r.relation | 6 | 6 | 인과/대조/부연/예시/순서/결론의18쌍 수용. 허용 대체 관계가 작동함 |
| s.form_scope | 6 | 5 | gs-guided-1 명사절/관계절 범주 겹침. gs-transfer-1은 정답을 추정했으나 유효한 단수 선행사 해석 때문에 내용 REWORK |
| v.contextual_sense | 6 | 6 | yield/sound/figure/address/command/bear의 문맥 뜻과 단서 수용 |

## FI-012 기존 결함에 실제 세트 사례 추가

`inf-guided-1`의 4번 문장은 “수치는 계속 좋아지지만 고객의 문제는 해결되지 않는다”를 직접 진술한다. 정답 선택지4(서류상 성과 개선이 실무의 정체를 가림)를 지지한다. 독립 응답은 문장3·4와 선택지4를 골랐으나 choiceOk=true/extra0/decisiveOk=false로 오답이었다. Gold는 문장4를 evidence에 포함하고도 별도 문장6의 단일 decisive 포함을 요구한다.

이는 [기존 형식 반례](./AUTHORED_FORMATS_REVIEW.md)의 FI-012(#305)와 같은 설계다. 새 이슈를 만들지 않는다. `inf-teach-1`도 대체 근거가 허용 범위인데 고정 decisive 때문에 갈렸다. 모든 evidenceAlt를 무조건 완전 정답으로 만들지 말고 실제로 충분한 근거 집합을 표현·수용해야 한다.

## FI-013 · 핵심 P2 · 문법 전이 문항의 단수 선행사 대안

`gs-transfer-1`의 첫 문장에 **the simple irrigation ditch**가 등장하고 다음 문장은 **The rivers ... have shifted its course ...**다. Gold는 its가 반드시 복수 The rivers를 가리킨다고 단정하여 their로 고치게 한다. 그러나 its가 바로 앞 문장의 단수 ditch를 가리키면 강들이 도랑의 물길을 바꾸었다는 해석이 성립한다. 주어가 복수라는 이유만으로 목적어 내부 소유사의 선행사를 그 주어로 확정할 수 없다.

독립 판독은 작성자가 의도한 답을 맞혔지만 Gold를 보기 전에 이 대안을 별도로 기록했다. 문법적으로 틀린 부분 하나를 고르는 문제에서 의도 추정 성공은 단일 정답 타당성 증거가 아니다. 본문에서 그 단수 선행사를 제거하거나 rivers의 재귀적 물길 변화만 가능한 구조로 다시 쓰고, 설명·Gold·revision·사람 검토 대상을 함께 갱신해야 한다. 기존 승인 패키지도 its/their 반론 가능성을 적었으나 후보 원문/Gold에 남아 있어 실제 평가 출시를 보류한다. 이는 FI-012의 근거 채점 코드와 다른 내용 결함이다.

## 분류 불일치와 남은 검토

- `opt-ind-1`의 학교 instead-of/while, `opt-delayed-1`의 most/all 및 구역 있음/없음은 내용 일치/불일치와 대응 문장이 모두 맞았다. reversed와 distorted의 경계 분류가 갈린 사실만으로 두 Gold를 오답이라고 단정하지 않는다. 독립 채점의 필수값으로 쓸 경우 범주 정의/예시를 명확히 하거나 실제로 겹치는 허용 분류를 표현해야 한다.
- `gs-guided-1`의 That→What은 독립 풀이와 Gold가 일치했다. 목적어가 빠진 절이 주어 자리에 오는 문제를 명사절 관점과 관계사 관점으로 분류한 차이가 오답으로 이어졌다. 이름만 고르게 하는 이유 분류가 올바른 교정/구조 이해를 배제하지 않는지 사람 루브릭 검토가 필요하다.
- 본문 패킷은 새로운 자체 창작으로 등록된 초안이다. 기출로 취급하지 않는다. 연구·역사·과학을 사실 서술하는 모든 문장의 원전 사실성이나 저작권 비파생성을 이 판독으로 확인했다고 주장하지 않는다. 교수 단계/힌트·모든 해설의 교육 일관성·실제 TASK별 화면·독립/지연/전이/PLAN 환류는 추가 검증 대상이다.
- 전체30 TASK의 현재 코드는 [확장 대조](./TASK_EXPANSION_COVERAGE.md).45문항/7 TASK로 초안이 늘었지만 실제 개발 DB의 적격 공급/납품/결속 근거는0이다. A~H 전체 수용은 계속 진행한다.
