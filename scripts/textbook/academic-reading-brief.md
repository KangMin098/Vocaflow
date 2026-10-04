# Academic Reading 집필 계약

`adapt-drain-export.mjs --target <JSON>`의 한 행을 읽고 같은 파일명의 `.out.json` 배열로 채운다. 입력 메타데이터·원문·target을 유지하고 `title`, `text`, `reading.source_rights`, `reading.reading_analysis`만 채운다. 내용·권리 증거가 부족하면 해당 행의 `title/text`를 비워 두고 이유를 별도 작업 기록에 남긴다. 이미 끝낸 out 파일을 덮지 않는다.

`reading.reading_directives`가 이번 독자·언어·사고·제품 목적을 정한다. `reading.target.words`는 요청한 각색문의 분량이다. `passage_v_level`은 요청값이며, 실제 VRL은 기존 분석 공정에서 별도로 계산한다. 원문이 길다는 이유로 거절하거나 수능의 어수창으로 먼저 자르지 않는다.

`reading.source_rights`의 필수 키:

| 키 | 형식·확인 방식 |
|---|---|
| canonical_source / canonical_url | 이번 원문의 DB source / source_url과 일치 |
| original_author | 원문 저자·기관 표시, 미확인이면 생성 보류 |
| published_at | 원문 발행일 문자열 또는 null |
| license / license_url | DB 원문 license와 같은 표기 / 공식 문서·기사별 권리 URL |
| commercial_use / derivative_use | 확인된 boolean, 생성에는 둘 다 true 필요 |
| ai_processing | allowed / unknown / restricted, 생성에는 allowed 필요 |
| third_party_text / third_party_image | 각각 boolean. 별도 권리 텍스트가 있으면 해당 본문으로 생성 보류. 이 경로는 이미지를 가져오지 않는다 |
| attribution_required / share_alike | boolean. ShareAlike는 target.share_alike가 true일 때만 처리 |
| original_work_id / discovered_via | 실제 DOI 등 식별자 / 발견 경로, 없으면 null |
| checked_at / evidence | 원문 revision 이후 실제 확인한 ISO 시각 / 개별 글에 적용되는 권리 판단 근거 20자 이상 |

기관 홈페이지에 일반 라이선스가 있다고 이번 글의 제3자 문장까지 허가된 것으로 쓰지 않는다. 상용 교재·KICE·시험은 benchmark이며 생성 본문으로 제공하지 않는다. OpenAlex/Europe PMC/DOAJ/EconStor 레코드는 발견 경로이며, 발행처의 원문 레코드와 권리를 확보한 뒤 별도 생성 입력으로 쓴다.

`reading.reading_analysis`의 필수 구조:

```json
{
  "source_profile": {},
  "passage_profile": {},
  "source_claims": [{ "claim": "분석한 명제", "quote": "원문에서 그대로 인용한 구간" }],
  "discourse": [{ "relation": "원인과 결과 등 담화 관계", "quote": "원문에서 그대로 인용한 구간" }],
  "preserved_claims": [{ "source_quote": "원문의 명제 구간", "passage_quote": "각색문의 대응 구간" }],
  "added_background": [],
  "item_plan": [],
  "parallel_pair": null
}
```

위 빈 객체·배열은 형식 설명용이며 완성 결과에는 다음 규격을 실제로 채운다. 두 profile은 각각 열 키를 모두 가진다:

- `lexical_level`, `syntax_level`, `abstraction_level`, `information_density`, `discourse_level`, `inference_level`, `background_knowledge`, `overall_level`: `{ "level": 0..11 정수, "evidence": "이 수준을 판단한 구체적 근거 8자 이상" }`.
- `age_appropriateness`: `{ "appropriate": true/false, "evidence": "대상 연령의 소재·발달 적합성 근거" }`. passage가 false면 보류한다.
- `exam_level`: `{ "exam": "none|psat_8_9|sat|act|toefl|csat|lsat", "evidence": "시험 대응 근거" }`. passage의 exam은 target과 일치한다.

0~11은 이번 엔진에서 요소별로 사용하는 독립 서열척도다. lexical만으로 나머지 level을 복사하지 않는다. 추론·정보량·담화·배경지식을 따로 판단한다. 이 값은 에이전트의 분석이며 학습자 수행이나 실제 시험 calibration 실측이 아니다. 원문의 주장·인과·한정 표현을 유지하고 새 배경 설명은 `added_background: [{ "text": "추가한 설명", "canonical_url": "설명을 뒷받침한 원문 URL" }]`에 구분한다.

`item_plan`은 target.skills의 각 능력에 최소 하나를 만든다:

```json
{
  "skill": "R4",
  "kind": "question",
  "item_reasoning_level": 4,
  "item_difficulty": 3,
  "difficulty_evidence": "정보가 한 문단에 명시되어 있으나 예시와 주제를 구분해야 함",
  "prompt": "What is the passage mainly about?",
  "expected_response": "본문에 근거한 예상 응답",
  "evidence": ["각색 본문에 그대로 있는 근거 구간"],
  "resource_evidence": [],
  "time_limit_seconds": null
}
```

수준 숫자는 실제 분석 결과로 채운다. R0는 `kind: activity`, R13은 양의 제한시간을 명시한다. R11/R12는 target.resources의 실제 텍스트/자료에서 `resource_evidence: [{ "resource_index": 0, "quote": "해당 자료에 그대로 있는 근거" }]`를 붙인다. 자료가 없으면 목표 자체가 export 전에 거부된다.

FYM 쌍은 `parallel_pair: { "original_work_id": "DOI", "research_url": "연구 URL", "student_url": "이번 FYM 원문 URL", "evidence": "원문에 DOI가 그대로 있는 구간" }`으로 남긴다. 단순히 주제가 비슷하다고 쌍으로 묶지 않는다. 증거가 없으면 null이다. 선택적인 `source_score`는 `academic-reading.ts:SOURCE_SCORE_WEIGHTS`의 11키·각 상한을 그대로 따른다. 권리 차단을 높은 점수로 상쇄할 수 없다.

각색을 import하면 원문을 바꾸지 않고 `queued` 자식만 만든다. 기존 분석·내용 판정·적격 검증을 마친 뒤 문항 제작으로 넘긴다. 이 item_plan은 설계된 질문/활동이며, 기존 조판용 5지선다 문항은 별도 `item-drain-export/import`로 생성·검수한다.

그 문항 청크에 `reading`이 있으면 `allowed_skills` 안에서 `skill`을 고르고 `item_reasoning_level`, `item_difficulty`, `difficulty_evidence`, `evidence`를 채운다. `passage_level`·target·source_hash·revision은 바꾸지 않는다. `item-selfcheck.mjs`와 importer가 같은 문항 메타데이터 검증 함수를 쓴다. 타입 대응이 없는 R0/R11/R12/R13은 활동 계획으로 보존되며 기존 조판 유형으로 임의 변환하지 않는다.
