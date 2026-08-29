import { useEffect, useRef, useState } from 'react'
import { api, apiUpload } from '../../api/client'
import { useI18n } from '../../i18n'

export type EmployeeDocumentType = 'photo' | 'ktp' | 'kk'

type Props = {
  type: EmployeeDocumentType
  label: string
  hint: string
  accept: string
  value: File | null
  onChange: (file: File | null) => void
  existing?: boolean
  userId?: number
  readOnly?: boolean
}

const requestKey: Record<EmployeeDocumentType, string> = {
  photo: 'employee_photo',
  ktp: 'ktp_document',
  kk: 'kk_document',
}

export function employeeDocumentAccept(type: EmployeeDocumentType) {
  return type === 'photo' ? 'image/jpeg,image/png,image/webp' : 'image/jpeg,image/png,image/webp,application/pdf'
}

export function employeeDocumentRequestKey(type: EmployeeDocumentType) {
  return requestKey[type]
}

export function EmployeeDocumentField({ type, label, hint, accept, value, onChange, existing, userId, readOnly }: Props) {
  const { t } = useI18n()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [previewMime, setPreviewMime] = useState<string | null>(null)

  useEffect(() => {
    if (value) {
      const url = URL.createObjectURL(value)
      setPreview(url)
      setPreviewMime(value.type)
      return () => URL.revokeObjectURL(url)
    }

    if (!existing || !userId) {
      setPreview(null)
      setPreviewMime(null)
      return
    }

    let cancelled = false
    let objectUrl: string | null = null

    void api
      .get(`/users/${userId}/documents/${type}`, { responseType: 'blob' })
      .then(({ data }) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(data)
        setPreview(objectUrl)
        setPreviewMime(data.type)
      })
      .catch(() => {
        if (!cancelled) {
          setPreview(null)
          setPreviewMime(null)
        }
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [value, existing, userId, type])

  function pickFile(file: File | undefined) {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      onChange(null)
      return
    }
    onChange(file)
  }

  const isPdf = previewMime === 'application/pdf' || value?.type === 'application/pdf'

  return (
    <div className="rounded-2xl border border-line bg-fill/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="mt-1 text-xs text-muted">{hint}</p>
        </div>
        {!readOnly ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept={accept}
              className="hidden"
              onChange={(event) => pickFile(event.target.files?.[0])}
            />
            <button type="button" className="btn-ghost shrink-0 text-xs" onClick={() => fileRef.current?.click()}>
              {value || existing ? t('employeeDocumentReplace') : t('employeeDocumentUpload')}
            </button>
          </>
        ) : null}
      </div>

      {preview && !isPdf ? (
        <img src={preview} alt="" className="mt-3 max-h-40 rounded-xl border border-line object-contain" />
      ) : null}

      {preview && isPdf ? (
        <a href={preview} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm text-mint hover:underline">
          {t('employeeDocumentView')}
        </a>
      ) : null}

      {value ? <p className="mt-2 truncate text-xs text-muted">{value.name}</p> : null}
      {existing && !value ? <p className="mt-2 text-xs text-mint">{t('employeeDocumentUploaded')}</p> : null}
    </div>
  )
}

export type EmployeeDocumentFiles = {
  photo: File | null
  ktp: File | null
  kk: File | null
}

export const emptyEmployeeDocuments = (): EmployeeDocumentFiles => ({
  photo: null,
  ktp: null,
  kk: null,
})

export function appendEmployeeDocuments(body: FormData, files: EmployeeDocumentFiles) {
  if (files.photo) body.append('employee_photo', files.photo, files.photo.name)
  if (files.ktp) body.append('ktp_document', files.ktp, files.ktp.name)
  if (files.kk) body.append('kk_document', files.kk, files.kk.name)
}

export async function uploadEmployeeDocuments(userId: number, files: EmployeeDocumentFiles) {
  for (const type of ['photo', 'ktp', 'kk'] as const) {
    const file = files[type]
    if (!file) continue
    const body = new FormData()
    body.append(employeeDocumentRequestKey(type), file, file.name)
    await apiUpload(`/users/${userId}/documents/${type}`, body)
  }
}
