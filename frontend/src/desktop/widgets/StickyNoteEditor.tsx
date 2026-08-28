import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import { STICKY_NOTE_COLORS, type StickyNote } from '../desktopPrefs'

export function StickyNoteEditor({
  note,
  canDelete,
  onChange,
  onRemove,
}: {
  note: StickyNote
  canDelete: boolean
  onChange: (next: StickyNote) => void
  onRemove: () => void
}) {
  const { t } = useI18n()
  const [text, setText] = useState(note.text)

  useEffect(() => {
    setText(note.text)
  }, [note.text])

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (text !== note.text) onChange({ ...note, text })
    }, 400)
    return () => window.clearTimeout(id)
  }, [text, note, onChange])

  return (
    <>
      <textarea
        className="os-notes-input"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={t('widgetNotesPlaceholder')}
        maxLength={2000}
      />
      <div className="erp-note-footer">
        <div className="os-notes-colors">
          {STICKY_NOTE_COLORS.map((item) => (
            <button
              key={item}
              type="button"
              className={`os-notes-swatch is-${item}${item === note.color ? ' is-active' : ''}`}
              onClick={() => onChange({ ...note, color: item })}
              aria-label={item}
            />
          ))}
        </div>
        {canDelete ? (
          <button type="button" className="erp-note-remove" onClick={onRemove}>
            {t('delete')}
          </button>
        ) : null}
      </div>
    </>
  )
}
