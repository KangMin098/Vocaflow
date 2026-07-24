# 데이터 출처·라이선스 (Attribution)

Vocaflow 사전 DB는 다음 외부 데이터에서 파생·구축되었습니다. 각 소스의 라이선스와 사용 방식을 명시합니다.

> **원칙**: 창작적 표현(정의문·예문)은 퍼미시브/PD 소스에서만 사용하거나 자체 생성. CC BY-SA 소스는 **사실 데이터(매핑)만** 사용하고 정의문은 배포하지 않음.

---

## 사전 정의·의미

| 소스 | 라이선스 | 사용 | 배포물 포함 |
|---|---|---|---|
| **WordNet 3.1** (Princeton) | WordNet License (퍼미시브·share-alike 없음) | 영어 정의·관계어 | 예 |
| **Webster's 1913** | Public Domain | 영어 정의 폴백 | 예 |
| **CMU Pronouncing Dict** | BSD-style / PD | IPA·발음·rhyme | 예 |
| **한국어 뜻 (meaning_ko)** | **자체 생성** (Google MT / 자체 검수) | 학습 뜻 | 예 (우리 것) |

## 철자·방언 정규화 (variant → standard 매핑)

| 소스 | 라이선스 | 사용 | 비고 |
|---|---|---|---|
| **MorphAdorner** (Northwestern Univ.) | NCSA (퍼미시브) | 역사철자·19c 방언 매핑 301k | 자유 배포 가능 |
| **Wiktionary** (Wiktextract/kaikki) | **CC BY-SA 4.0** | **방언 variant→standard '사실 쌍'만** (pronunciation-spelling·eye-dialect·dialectal) | 아래 명시 |

### Wiktionary 사용 방식 (CC BY-SA 준수)
- **사용**: 방언 표면형 → 표준어 **매핑(사실)만** 추출. 예: `nuthin → nothing`, `gwine → going`.
- **미사용**: Wiktionary의 **정의문·예문·어원 등 창작적 표현은 추출/배포하지 않음**. 뜻은 전적으로 자체 사전(WordNet+자체 한글생성)에서 해소.
- **출처표기 (BY)**: 방언 매핑 데이터는 **Wiktionary (© Wiktionary contributors, CC BY-SA 4.0, https://en.wiktionary.org)** 에서 파생되었습니다.
- 데이터 추출: [Wiktextract / kaikki.org](https://kaikki.org) (Tatu Ylönen).

## 다국어 사전 (외국어 독해)

| 소스 | 라이선스 | 사용 |
|---|---|---|
| **hermitdave FrequencyWords** (OpenSubtitles) | 빈도 목록(사실 데이터) | fr/it/de/es 표면형 단어 목록 |
| **Google Translate** (무료) | 기계번역 = 자체 생성 | 외국어 한국어 뜻 (ko_source=google-mt) |

---

## 어휘 목록·빈도

| 소스 | 라이선스 | 사용 |
|---|---|---|
| Standard Ebooks | Public Domain (본문) | 단어추출 테스트 코퍼스 (평가 전용, 배포 무관) |

---

*본 문서는 배포되는 사전 DB의 데이터 출처를 투명하게 밝히며, 각 라이선스 조건(특히 Wiktionary CC BY-SA의 BY 출처표기)을 준수합니다. 창작적 표현(정의문)의 CC BY-SA 파생은 없으며, 사실 데이터(매핑)만 사용합니다.*
