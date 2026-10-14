# FQR1 — 13권의 재고·유형·실행·자격 공백

2026-10-15. 실제 읽기 전용 DB 집계와 `Vocaflow-map-v62` 카탈로그 working-tree snapshot을 대조했다. [inventory.json](./data/inventory.json)의 SQL·관측 시각·코드 hash가 근거다. 제품 main 반영이나 실제 학생 실행으로 해석하지 않는다.

## 13조합의 실제 관측

카탈로그는 어휘 2~7단에 `vocab_choice/unit_vocab/blank_word`, 구문 2~7단에 `grammar_choice/grammar_fix/unit_grammar/word_order`, 독해 1단에 `rhyme/word_meaning/spell_blank`를 지정한다. 각각 V-Level은 step 하나다. 아래 재고는 **그 유형×V-Level의 저장 후보 풀**이다. 현재 특정 권에 배정된 문항 ID나 자격 승인 문항 수가 아니다.

| 시리즈 | 단 | 저장 후보 수 | 조판 기록의 발행 상태 | 조판 기록 문항/단원 |
|---|---:|---:|---|---|
| 어휘 | 2 | 1,160 | published | 120/20 |
| 어휘 | 3 | 1,209 | published | 120/20 |
| 어휘 | 4 | 7,781 | published | 120/20 |
| 어휘 | 5 | 80,902 | published | 120/20 |
| 어휘 | 6 | 128,053 | published | 120/20 |
| 어휘 | 7 | 168,039 | published | 120/20 |
| 구문 | 2 | 1,129 | published | 120/20 |
| 구문 | 3 | 1,320 | published | 120/20 |
| 구문 | 4 | 5,162 | published | 120/20 |
| 구문 | 5 | 43,843 | published | 120/20 |
| 구문 | 6 | 76,886 | published | 120/20 |
| 구문 | 7 | 90,034 | published | 120/20 |
| 독해 | 1 | 0 | published | 60/10 |

어휘·구문의 저장 후보는 12조합 모두 존재한다. 따라서 ‘자료가 전혀 없어 실행할 수 없다’는 설명은 지지되지 않는다. 다만 각 권의 현행 배정 ID, 권리 승인 수, 현재 원문·Gold 검수 수, 실제 채점 가능 수는 이 집계로 확인되지 않았으므로 null로 남긴다. source별 개수는 유형을 가로질러 중복되며 합산해서 고유 지문 수로 쓰지 않는다.

## 실제 0과 실행기의 잘못된 유형 선택

실제 DB `textbook_practice_items_for` 함수는 관측 시 존재하지 않았다. 배포된 `textbook_practice_items` 정의는 article 원천과 독해 유형만 읽고, 위 어휘·구문 7유형을 모두 제외한다. 따라서 권 단위 함수 미존재 시 V-Level 폴백에서 다른 독해 문항을 반환하거나 빈 결과가 나는 현상은 후보 재고 부족과 별개다. 함수 정의만 읽었고 학생 실행/채점 RPC를 호출하지 않았다. 최신 P-F8 실행기·어댑터의 코드 지원 여부와 main/DB 배포 여부는 별도 제품 감사와 함께 판단해야 한다.

독해 1단의 세 유형은 전체 DCP 유형 집계에서 실제 저장 행 0이다. 그러나 `elementary.ts`는 사전에서 결정론적으로 생성하도록 정의한다. 실제 `shared_dictionary`의 `kcurr2022_1` 태그는 808행이다. **DCP 저장 0, 생성 재료 808, 조판 기록 60문항은 서로 다른 분모**다. 운율 후보 수·선택지 구성·실제 생성 산출물·학생 채점은 이번 사전 태그 개수로 검증되지 않았다. 원문 article와 읽기 유형을 전제한 기존 RPC에 이 세 유형이 없다는 사실도 ‘초등 학습 재료 자체가 없다’는 뜻이 아니다.

## 새 실제 표본의 선정과 한계

원문/정답/해설 값 열람 전에 [sample-registration.json](./data/sample-registration.json)을 고정했다. 7유형 모두 실제 재고가 있어 각 2개, 총 14개를 선정했고 14개의 서로 다른 원천을 썼다. 기존 FQ1 12개 ID 및 동일 ref_id를 제외했다. SHA256 seed `FQR1-20261015`로 각 유형·metadata 층에서 상위 40개 후보를 순서화한 뒤 원천/저장 source hash 중복을 배제했다. 부족한 유형은 0개다.

| 유형 | 전체 저장 행 | 독립 선정 적격 행 | normal metadata | problematic metadata |
|---|---:|---:|---:|---:|
| vocab_choice | 49,484 | 49,417 | 16,046 | 33,371 |
| unit_vocab | 123,578 | 123,414 | 49,331 | 74,083 |
| blank_word | 214,591 | 214,326 | 80,763 | 133,563 |
| grammar_choice | 15,258 | 15,235 | 6,862 | 8,373 |
| grammar_fix | 129,901 | 129,727 | 48,547 | 81,180 |
| unit_grammar | 30,390 | 30,336 | 13,541 | 16,795 |
| word_order | 43,266 | 43,217 | 16,781 | 26,436 |

`normal_metadata`는 해당 유형의 필수 배열/문자열 구조 존재, 해설 비어 있지 않음, source cache fresh, source ready/published를 만족한다. `problematic_metadata`는 그 보집합이다. 전자는 내용 통과 판정이 아니고 후자는 실제 오답·결함 확정이 아니다. 해설 값이나 정답 값으로 표본을 골라 성공 사례를 채우지 않았다. 선정 후 private packet에서 실제 source/payload/key/explanation을 확보했고 원문 존재 14/14, 원천 metadata 변경 0, 정규화 본문 중복 0을 기록했다. 등록 ID는 내용 결과에 따라 교체하지 않는다.

적격 행은 prior ref_id 제외 후의 605,672행 분모이며 전체 저장 행과 다르다. 선정 14개의 cache는 fresh 7, stale 6, missing 1이다. 모두 해설 필드가 비어 있지 않고, 13개 source는 ready/published, 1개는 archived다. 문제 가능 metadata 층에는 실제 형식 결함이 아니라 stale/missing cache를 가진 정상 구조가 많이 들어갈 수 있음을 보여 준다. 시간차가 있는 비트랜잭션 읽기이며 snapshot이 현재 DB의 영구 정본은 아니다. 저장 created_at은 generation revision이 아니다. 생성 당시 원문 revision 부재, source cache 상태, 현재 내용 검토, 권리 승인, 학습자 사전 노출 및 실제 평가 자격을 분리한다. 목적 표집 14개에서 모집단 결함률·연도 경향·학습 효과를 추정하지 않는다.

## 제품 인수인계 조건

1. 권 조회는 series/step과 카탈로그 유형을 결속하고, 다른 시리즈 유형의 V-Level 폴백 성공을 그 권의 실행 성공으로 처리하지 않는다.
2. 후보 풀 수, 실제 배정 ID 수, 조판 문항 수, runner 호환 수, source/rights 검수 수, 역할별 승인 수를 별도 필드와 분모로 표시한다. 미측정 값은 null로 보존한다.
3. 읽기/선택/입력/배열/채점/피드백 실행 계약과 자격 게이트를 각각 검사한다. 실제 배열 토큰·단답 의미 동등성은 단순 문자열 채점으로 입증되지 않는다.
4. 초등 세 유형은 생성 source/version과 실제 생성물 계약을 별도로 다룬다. article 기반 DCP의 fake ref_id나 재고 숫자로 채워 넣지 않는다.

이번 작업은 제품 코드·DB·발행·공개·학생 기록을 변경하지 않았다. 이 원장은 구현 권고와 관측 근거를 제공하며 교수 효과나 법률적 권리 승인을 주장하지 않는다.
