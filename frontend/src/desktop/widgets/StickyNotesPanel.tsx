import { useI18n } from '../../i18n'
import { useDesktop } from '../DesktopContext'
import {
  MAX_STICKY_NOTES,
  createStickyNote,
  type StickyNote,
  type StickyNoteColor,
} from '../desktopPrefs'
import { StickyNoteEditor } from './StickyNoteEditor'

export function StickyNotesPanel() {
  const { t } = useI18n()
  const { desktop, patchWidgets } = useDesktop()
  const notes = Array.isArray(desktop.widgets?.stickyNotes) ? desktop.widgets.stickyNotes : []

  function updateNotes(next: StickyNote[]) {
    patchWidgets({ stickyNotes: next })
  }

  function updateNote(id: string, next: StickyNote) {
    updateNotes(notes.map((item) => (item.id === id ? next : item)))
  }

  function removeNote(id: string) {
    if (notes.length <= 1) {
      updateNotes([{ ...notes[0], text: '', color: notes[0].color }])
      return
    }
    updateNotes(notes.filter((item) => item.id !== id))
  }

  function addNote(color: StickyNoteColor = 'gold') {
    if (notes.length >= MAX_STICKY_NOTES) return
    updateNotes([...notes, createStickyNote(color)])
  }

  return (
    <div className="erp-notes-panel">
      <div className="erp-notes-panel-head">
        <span className="text-sm font-semibold text-fg">{t('widgetNotes')}</span>
        <div className="flex items-center gap-2">
          {notes.length < MAX_STICKY_NOTES ? (
            <button type="button" className="os-notify-clear" onClick={() => addNote()}>
              {t('widgetNotesAdd')}
            </button>
          ) : null}
        </div>
      </div>
      <div className="erp-notes-list">
        {notes.map((note) => (
          <div key={note.id} className={`erp-note-card os-widget-notes is-${note.color}`}>
            <StickyNoteEditor
              note={note}
              canDelete={notes.length > 1}
              onChange={(next) => updateNote(note.id, next)}
              onRemove={() => removeNote(note.id)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
