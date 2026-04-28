// apps/web/src/components/text-viewer/FileUploadArea.tsx
// 파일 업로드 (PDF / DOCX / TXT)
// Phase 2에서 실제 파싱, 지금은 UI만

'use client'

import { cn } from '@/lib/utils/cn'
import { File as FileIcon, FileText, FileType, Upload, X, type LucideIcon } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'

export interface FileUploadAreaProps {
  onFileSelect?: (file: File) => void
  acceptedFormats?: string[]
  maxSizeMB?: number
}

const fileIcons: Record<string, LucideIcon> = {
  pdf: FileText,
  docx: FileType,
  doc: FileType,
  txt: FileIcon,
}

export function FileUploadArea({
  onFileSelect,
  acceptedFormats = ['pdf', 'docx', 'doc', 'txt'],
  maxSizeMB = 10,
}: FileUploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string>('')
  const inputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): string | null => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !acceptedFormats.includes(ext)) {
      return `지원하지 않는 형식입니다. (${acceptedFormats.join(', ')})`
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `파일 크기는 ${maxSizeMB}MB 이하여야 합니다.`
    }
    return null
  }

  const handleFile = (file: File) => {
    const err = validateFile(file)
    if (err) {
      setError(err)
      setSelectedFile(null)
      return
    }
    setError('')
    setSelectedFile(file)
    onFileSelect?.(file)
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleClear = () => {
    setSelectedFile(null)
    setError('')
    if (inputRef.current) inputRef.current.value = ''
  }

  // 파일 선택됨 — 표시 모드
  if (selectedFile) {
    const ext = selectedFile.name.split('.').pop()?.toLowerCase() || ''
    const Icon = fileIcons[ext] || FileIcon
    const sizeKB = (selectedFile.size / 1024).toFixed(1)

    return (
      <div className="rounded-xl border border-success bg-success-light p-s-5">
        <div className="flex items-center gap-s-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-bg shadow-sm">
            <Icon size={20} className="text-success" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-sm font-semibold text-t1">
              {selectedFile.name}
            </div>
            <div className="mt-[2px] font-mono text-xs text-t2">
              {sizeKB} KB · {ext.toUpperCase()} · 업로드 완료
            </div>
          </div>

          <button
            type="button"
            onClick={handleClear}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-t3 transition-colors duration-normal hover:bg-bg hover:text-error"
            aria-label="파일 제거"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    )
  }

  // 업로드 영역 (드래그 앤 드롭)
  return (
    <div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'cursor-pointer rounded-xl border-2 border-dashed',
          'p-s-12 text-center',
          'transition-all duration-normal',
          isDragging
            ? 'scale-[1.01] border-p bg-p-light'
            : error
              ? 'border-error bg-error-light'
              : 'border-bd bg-bg2 hover:border-bdf hover:bg-p-light'
        )}
      >
        <div
          className={cn(
            'mb-s-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl',
            'transition-colors duration-normal',
            isDragging ? 'bg-p text-ti' : error ? 'bg-error text-ti' : 'bg-bg3 text-t2'
          )}
        >
          <Upload size={28} />
        </div>

        <div className="mb-s-2 font-display text-lg font-bold text-t1">
          {isDragging ? '여기에 놓아주세요' : '파일을 드래그하거나 클릭하세요'}
        </div>

        <div className="mb-s-4 font-body text-sm text-t2">
          {error || (
            <>
              지원 형식: {acceptedFormats.join(' · ').toUpperCase()}
              <br />
              최대 {maxSizeMB}MB
            </>
          )}
        </div>

        {/* 지원 형식 chip */}
        {!error && (
          <div className="flex items-center justify-center gap-s-2">
            {acceptedFormats.map((fmt) => (
              <span
                key={fmt}
                className="rounded border border-bd bg-bg px-s-2 py-[2px] font-mono text-[10px] uppercase tracking-wider text-t2"
              >
                .{fmt}
              </span>
            ))}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={acceptedFormats.map((f) => `.${f}`).join(',')}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
          className="hidden"
        />
      </div>
    </div>
  )
}
