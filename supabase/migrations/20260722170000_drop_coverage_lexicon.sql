-- coverage_lexicon(kaikki CC BY-SA) 폐기.
-- 가치분(word+pos+LLM한국어)은 lexicon_clean 통합 완료(49,619), 함수 4종 repoint 완료(20260722160000), 앱/함수 참조 0.
-- CC BY-SA 원문(gloss_en·예문) 제거 + 디스크 회수(~78MB). 읽기 체인은 lexicon_clean(256k 청정)로 서빙.
drop table if exists coverage_lexicon;
