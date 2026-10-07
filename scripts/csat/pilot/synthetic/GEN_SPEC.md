# G6-S 합성 학습자 생성 지시 (페르소나 1명 = 서브에이전트 1개)

입력: `.pilot-private/synthetic/items.json`(두 시험 · 문항 원문 · 선지 · 정답 · 지문 문장 `sentences[k]`) · `scripts/csat/pilot/synthetic/personas.json`(내 페르소나).
출력: `.pilot-private/synthetic/gen/<persona>.json` — 아래 스키마 그대로(JSON 만, 주석 없음).

```json
{
  "persona": "S01",
  "synthetic": true,
  "exams": {
    "M2409": {
      "answers": { "18": 3, "19": 1, "...": 0 },
      "attempts": [
        {
          "no": 31,
          "true_cause": "V.wrong_sense",
          "reason": "학생이 쓴 고른 이유(한국어 1~3문장)",
          "blocked": { "part": "passage", "sentence": 4 },
          "interpretation": { "state": "answered", "text": "학생이 그 부분을 이렇게 읽었다(한국어 1~2문장)" },
          "category": "word",
          "probe_option": "A"
        }
      ]
    },
    "M2406": { "answers": {}, "attempts": [] }
  }
}
```

## 규칙

1. **answers**: 두 시험 각각 18–45번 28문항 전부. 값은 고른 선지 번호(1–5). 정답 수는 페르소나 `level` 범위 안. 틀리는 문항은 난도 · 유형 · 페르소나 경향과 맞게(아무 데나 틀리지 않는다).
2. **attempts**: `personas.json` 의 `targets` 8문항(21 · 24 · 30 · 31 · 32 · 33 · 34 · 40) **모두** — 맞힌 문항도 포함(대상은 정오와 무관하게 정해졌다).
   - 틀린 대상: `true_cause` = 아래 코드 하나. 페르소나 `cause_mix` 비율을 따르되 **그 문항에서 실제로 그 원인으로 그 오답 선지를 고를 수 있어야 한다**(지문 · 선지를 읽고 정한다).
   - 맞힌 대상: `true_cause: null`. 이유 · 해석은 맞게 읽은 학생의 말로.
3. **reason · interpretation** 은 그 원인이 남길 법한 학생 말 — 원인 코드 이름 · 「다의어」 같은 분석 용어를 쓰지 않는다. 진짜 학생처럼 짧고 불완전하게. 이름 · 학교 · 연락처 등 개인정보는 절대 쓰지 않는다.
   - V.wrong_sense: 낱말을 아는 다른 뜻으로 그대로 읽은 해석(「~를 ~라는 뜻으로 읽었다」).
   - R.inference: 낱말 뜻은 맞지만 비유 · 함축을 문자 그대로 / 근거에서 엉뚱한 결론.
   - V/R 경계(특히 S03): 학생 서술만으로는 둘 중 무엇인지 애매하게 — probe 응답이 구별의 열쇠가 되게.
4. **blocked**: 막혔던 곳. `part` 는 `passage`(sentence = 지문 `sentences[k]` 의 k) · `stem`(sentence 0) · `option`(sentence 0, `"option": 1–5` 추가). 정답 문항이나 막힌 곳이 없으면 `null`.
5. **interpretation.state**: `answered`(text 필수) · `unknown`(text 없음) · `skipped`(text 없음). 비율은 페르소나 `habits`(interp_unknown · interp_skipped).
6. **category**(학생이 고르는 범주): `word` · `sentence` · `flow` · `evidence` · `choice` · `time` · `unsure` 또는 `null`(안 고름). 원인과 대체로 맞게(V→word, S→sentence, R→flow, E.evidence_location→evidence, E.option_mismatch/E.task_misread/B.*→choice, X→time) 고르되 `habits.category_mislabel` 비율로 **엉뚱한 범주**를 고른다. 맞힌 문항은 대개 `null`.
7. **probe_option**(시스템이 R6 질문을 띄웠을 때의 응답 — 띄울지는 시스템이 정한다): 질문 「방금 적은 뜻은 어떻게 떠올렸나요?」 A=그 단어가 원래 그런 뜻이라고 생각 · B=기본 뜻에서 문맥이나 비유를 따라가 · C=둘 다 · D=잘 모르겠다 · `null`=건너뜀.
   - true_cause V.* → A 70% · C 15% · D 10% · null 5%
   - true_cause R.* → B 65% · C 20% · A 10% · null 5%
   - 그 밖(정답 포함) → C 30% · D 40% · null 30%
8. 무작위성은 페르소나 key 를 씨앗 삼아 스스로 고르게 섞는다(모든 문항이 같은 패턴이 되지 않게).

## 원인 코드(v0.1 — 정의 원문은 DB `csat_ec_code`)

V.wrong_sense(아는 다른 뜻) · V.unknown_word(뜻 모름) · V.multiword(숙어 · 구동사) · S.core_structure(주어 · 동사 · 절 경계) · S.attachment(수식 연결) · S.operator_scope(부정 · 비교 · 조건 범위) · S.form_rule(어법 형태) · R.reference(지시 대상) · R.relation(문장 사이 논리 관계) · R.inference(함축 · 비유 · 결론 잘못 이끌기) · R.main_point(중심 · 뒷받침 구분) · E.evidence_location(다른 부분 대응) · E.option_mismatch(선지 범위 · 강도 · 방향 차이) · E.task_misread(발문 오해) · B.surface_match(같은 낱말 끌림) · B.no_verification(확인 없이 첫 선지) · B.outside_knowledge(상식) · X.attention(순간 실수) · X.time(시간 부족).

## 끝내기 전 자가 점검

- 두 시험 answers 각 28개 · attempts 각 8개 · 정답 수가 level 범위 · 틀린 대상은 모두 true_cause 있음 · 맞힌 대상은 null
- blocked.sentence 가 그 문항 sentences 범위 안 · answered 해석은 text 있음 · 개인정보 0 · 분석 용어(코드 이름) 0
