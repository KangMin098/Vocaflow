-- 음성 제안모드용 함수 인덱스 — dmetaphone(word) on 분류 단어. lookup_word_meaning suggestion tier가 사용.
create index if not exists idx_sd_dmetaphone on shared_dictionary (dmetaphone(word))
  where classified_by is not null and meaning_ko is not null and word ~ '^[a-z]+$';
