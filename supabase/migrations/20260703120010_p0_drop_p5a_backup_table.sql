-- 20260703120010_p0_drop_p5a_backup_table.sql
-- P0 보안: 유출 backup 테이블 제거.
-- shared_dictionary_p5a_backup_20260620 (16,492 row, 688 kB) 은 추출 파이프라인
-- P1~P4 (v06.77~82) 백업본으로, 파이프라인 완료 후 목적 종료.
-- RLS off + anon INSERT 권한이 남아 있던 유출면이므로 삭제로 제거.
drop table if exists public.shared_dictionary_p5a_backup_20260620;
