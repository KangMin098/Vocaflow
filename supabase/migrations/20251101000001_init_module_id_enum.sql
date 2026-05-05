-- ============================================================
-- Migration: 20251101000001_init_module_id_enum.sql
-- Source: CLAUDE.md §"🗄 Supabase DB 스키마"
-- Created: 2025-11-01
-- ============================================================
--
-- 학습 모듈 식별자 ENUM (10종)
-- learning_records.module / scores.module / vocabularies.module_history[] 공통 사용
--
-- 정식 모듈 9종 (CLAUDE.md §"핵심 모듈 9개" 정합):
--   flashcard, spellforge, wordblitz, pairflip, scriptquiz,
--   dictation, wordvault (노출만 — L3), workspace (L2 hover), textviewer (L1)
--
-- 베타 모듈 1종 (v06.5+):
--   pirate_quest — Pirate's Bounty (단어 모험 게임, /play/pirate-quest)
--   ※ 본 마이그레이션에서는 pirate_quest 로 정의 (PostgreSQL identifier 안전 — 하이픈 회피)
-- ============================================================

DO $$ BEGIN
  CREATE TYPE module_id AS ENUM (
    'flashcard',
    'spellforge',
    'wordblitz',
    'pairflip',
    'scriptquiz',
    'dictation',
    'wordvault',
    'workspace',
    'textviewer',
    'pirate_quest'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;
