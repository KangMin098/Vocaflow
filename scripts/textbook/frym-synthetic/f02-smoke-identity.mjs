// scripts/textbook/frym-synthetic/f02-smoke-identity.mjs
import { createHash } from 'node:crypto'

export const smokeHash = value => createHash('sha256').update(value).digest('hex')
export const STUDENT_MODEL = 'claude-haiku-4-5-20251001'
export const SCORER_MODEL = 'gpt-6.1-sol'
export const STUDENT_SYSTEM = 'Use only the current user message. Do not use tools, files, prior conversation, or external context. Return strict JSON without code fences.'
export const STUDENT_INSTRUCTION = 'Use only this packet. Respond as the constrained reader described by the profile. Do not use external knowledge, tools or files. Answer all questions in order. Return only valid JSON object {"answers":[{"id":"...","answer":"..."}]}. '
export const SCORER_INSTRUCTION = 'You are an independent blind scorer. Score each response using the supplied rubric, 0, 0.5, or 1. Return only valid JSON object {"scores":[{"id":"...","score":0.5}]} in question order. Do not use tools. '
export const STUDENT_COMMAND = `claude.cmd -p --model haiku --effort low --restricted --strict-mcp-config --system-prompt "${STUDENT_SYSTEM}" --output-format json --no-session-persistence`

export function studentCall(packet, { windowsVerbatimArguments = true } = {}) {
  const prompt = STUDENT_INSTRUCTION + JSON.stringify({ profile: packet.body.profile, passage: packet.body.passage, questions: packet.body.questions })
  const identity = { command: STUDENT_COMMAND, prompt, expected_model: STUDENT_MODEL }
  if (windowsVerbatimArguments) identity.windows_verbatim_arguments = true
  return { prompt, prompt_sha256: smokeHash(prompt), invocation_sha256: smokeHash(JSON.stringify(identity)) }
}

export function scorerCall(packet, answers, scoringKey) {
  const prompt = SCORER_INSTRUCTION + JSON.stringify({ passage: packet.body.passage, questions: packet.body.questions, answers, rubrics: scoringKey[packet.passage_variant], general_rule: scoringKey.general_rule })
  return { prompt, prompt_sha256: smokeHash(prompt), invocation_sha256: smokeHash(JSON.stringify({ command: 'codex', model: SCORER_MODEL, sandbox: 'read-only', skip_git_repo_check: true, prompt })) }
}
