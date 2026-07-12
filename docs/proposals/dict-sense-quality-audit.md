# shared_dictionary sense/POS 품질 감사 — 다의어 primary 오선정

> 상태: **감사 + 부분 수리 완료** (2026-07-12) · 전수 sweep 잔여
> 배경: 큐레이션 단어추출 검증에서 `creep="변태"` 등 문맥과 다른 뜻 발견 → 근본이 추출 로직이 아니라 **shared_dictionary sense 선정 품질**로 규명.

## 근본 원인 (RC1)
`shared_dictionary`의 다의어에서 enrichment(Claude classification)가 **흔한 sense를 누락하고 특수·희귀 sense를 primary로 선정**한 경우가 존재. 단어세트는 `meaning_ko`(평면 primary)를 그대로 표시 → 학습자가 문맥과 다른 뜻을 학습.

### 패턴 — primary가 특수 sense, 흔한 sense 누락
| 단어 | 오류 primary | 누락된 흔한 뜻 |
|---|---|---|
| creep | 변태(noun) | **기어가다(verb)** |
| nettle | 짜증나게하다(verb) | **쐐기풀(noun·식물)** |
| founder | 침몰하다(verb) | **창립자(noun)** |
| spiritual | 흑인 영가(noun) | **영적인(adjective)** |
| bay | 적갈색의(말털·adj) | **만(灣)(noun)** |
| steam | 찌다(verb) | **증기(noun)** |

특징: **primary POS가 그 단어의 지배적 POS가 아님** + 특수 도메인(말털·항해·종교민요) sense가 앞섬.

## 규모
- V≥6 분류어 **34,076** · 다의어(≥2 sense) **7,157(21%)** · multi-POS 인벤토리 **2,171(6.4%)**.
- 감사 표본(발행 노출 mid-rank 다의어 ~135개) 오류율 **~8%**(egregious+부분누락). 상위 흔한어(rank<2800)는 대부분 정상 — mid-rank(2800-16000) 군집.

## 수리 완료 (11 단어 · 사전 교정 + 발행 세트 전파)
creep·nettle·founder·spiritual·bay·steam (primary 교정) + shed·sacrifice·grip·echo·faint (누락 sense 보강). 발행 `shared_words` ~130 appearance 전파(creep 19·faint 23·echo 18·shed 17·steam 14 등). `meaning_ko`+`part_of_speech` 갱신.

## 전수 근절 계획 (잔여)
탐지가 **기계적으로 어려움**(특수 sense를 primary로 고른 건 Claude 판단 필요). 방법:
1. **후보 축소**: 발행 노출 다의어(mid-rank) 우선 → 학습자 임팩트 큰 순.
2. **배치 Claude 재검수**: `dict-enrich`/`vcb-reenrich` 스킬로 각 다의어의 (a) 흔한 sense가 primary인가 (b) 흔한 sense 누락 없나 검수 → 교정.
3. **탐지 프록시(보조)**: winkNLP 코퍼스 POS 분포 vs 저장 primary POS 불일치 = 후보 플래그(예: bay 실사용은 noun 지배인데 저장 adj).
4. **발행 전파**: 교정 후 `shared_words` 갱신(위 패턴).

## 예방 (RC2/RC3 — 별도)
문맥 POS를 `library_book_vocabularies`에 저장 + 추출 JOIN 시 `meanings_ko`에서 **문맥 POS 일치 sense 선택** → 다의어라도 문맥 맞는 뜻 표시. (RC1 사전 교정과 독립·병행)
