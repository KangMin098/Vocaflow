// apps/web/src/lib/vcb/server/sources.ts
// Server Action — Source 조회 + 생성 + 파일 업로드 (Method A).
// 정합: CLAUDE.md §19.4 Step 1

'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import {
  fetchSources as fetchSourcesCore,
  createSource as createSourceCore,
  type SourceSummary,
  type CreateSourceInput,
} from '@vocaflow/vcb-curate-core'

interface ServerActionResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

const BUCKET = 'vocab-sources-raw'
const MAX_FILE_SIZE = 52_428_800 // 50 MB

export async function fetchSources(): Promise<SourceSummary[]> {
  await requireAdmin('/admin/vocab')
  const client = createAdminClient()
  return fetchSourcesCore(client)
}

export async function createSource(
  input: CreateSourceInput,
): Promise<ServerActionResult<{ source_id: number }>> {
  try {
    await requireAdmin('/admin/vocab')
    const client = createAdminClient()

    const result = await createSourceCore(client, input)

    if (!result.ok || result.source_id === undefined) {
      return { ok: false, error: result.error ?? 'createSource failed' }
    }

    revalidatePath('/admin/vocab/sources')
    return { ok: true, data: { source_id: result.source_id } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

// ── Method A: Source + 파일 업로드 통합 ───────────

function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  if (dot < 0 || dot === name.length - 1) return ''
  return name.slice(dot).toLowerCase()
}

function isAllowedExtension(ext: string): boolean {
  return ext === '.csv' || ext === '.txt' || ext === '.tsv'
}

export async function createSourceWithFile(
  formData: FormData,
): Promise<
  ServerActionResult<{ source_id: number; storage_key: string; file_size: number }>
> {
  try {
    await requireAdmin('/admin/vocab')
    const client = createAdminClient()

    const slug = String(formData.get('slug') ?? '').trim()
    const title = String(formData.get('title') ?? '').trim()
    const kind = String(formData.get('kind') ?? '') as CreateSourceInput['kind']
    const license_tier = String(
      formData.get('license_tier') ?? '',
    ) as CreateSourceInput['license_tier']
    const citation = String(formData.get('citation') ?? '').trim()
    const urlRaw = String(formData.get('url') ?? '').trim()
    const url = urlRaw.length > 0 ? urlRaw : null
    const language = String(formData.get('language') ?? 'en').trim()
    const notesRaw = String(formData.get('notes') ?? '').trim()

    const file = formData.get('file') as File | null

    if (!file || file.size === 0) {
      return { ok: false, error: 'file is required for Method A upload' }
    }
    if (file.size > MAX_FILE_SIZE) {
      return { ok: false, error: `file too large (max 50MB, got ${file.size} bytes)` }
    }

    const ext = fileExtension(file.name)
    if (!isAllowedExtension(ext)) {
      return {
        ok: false,
        error: `extension "${ext}" not allowed (use .csv / .txt / .tsv)`,
      }
    }

    const storageKey = `${slug}/source${ext}`
    const fullNotes = [`storage_key=${storageKey}`, notesRaw].filter(Boolean).join('\n')

    const sourceResult = await createSourceCore(client, {
      slug,
      title,
      kind,
      license_tier,
      citation,
      url,
      language,
      notes: fullNotes.length > 0 ? fullNotes : null,
    })

    if (!sourceResult.ok || sourceResult.source_id === undefined) {
      return { ok: false, error: sourceResult.error ?? 'createSource failed' }
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const contentType = file.type || 'application/octet-stream'

    const { error: uploadError } = await client.storage
      .from(BUCKET)
      .upload(storageKey, buffer, {
        contentType,
        upsert: true,
      })

    if (uploadError) {
      return {
        ok: false,
        error: `source #${sourceResult.source_id} created but upload failed: ${uploadError.message}. Re-run with storage_key=${storageKey}.`,
      }
    }

    revalidatePath('/admin/vocab/sources')
    return {
      ok: true,
      data: {
        source_id: sourceResult.source_id,
        storage_key: storageKey,
        file_size: file.size,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}
