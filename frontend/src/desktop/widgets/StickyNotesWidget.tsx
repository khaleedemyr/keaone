import { useI18n } from '../../i18n'
import { useDesktop } from '../DesktopContext'
import {
  MAX_STICKY_NOTES,
  createStickyNote,
  notePositionKey,
  type StickyNote,
  type StickyNoteColor,
} from '../desktopPrefs'
import { StickyNoteEditor } from './StickyNoteEditor'
import { WidgetFrame } from './WidgetFrame'

function StickyNoteCard({
  note,
  canDelete,
  canAdd,
  onChange,
  onRemove,
  onAdd,
}: {
  note: StickyNote
  canDelete: boolean
  canAdd: boolean
  onChange: (next: StickyNote) => void
  onRemove: () => void
  onAdd: () => void
}) {
  const { t } = useI18n()

  return (
    <WidgetFrame
      id={notePositionKey(note.id)}
      title={t('widgetNotes')}
      width={220}
      className={`os-widget-notes is-${note.color}`}
      onClose={canDelete ? onRemove : undefined}
      hideWidgetId={canDelete ? undefined : 'notes'}
      titleActions={
        canAdd ? (
          <button
            type="button"
            className="os-notes-add"
            title={t('widgetNotesAdd')}
            aria-label={t('widgetNotesAdd')}
            onClick={onAdd}
          >
            +
          </button>
        ) : null
      }
    >
      <StickyNoteEditor note={note} canDelete={false} onChange={onChange} onRemove={onRemove} />
    </WidgetFrame>
  )
}

export function StickyNotesWidget() {
  const { desktop, patchWidgets, setWidgetPosition } = useDesktop()
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
    const note = createStickyNote(color)
    const width = typeof window !== 'undefined' ? window.innerWidth : 1280
    const offset = notes.length
    setWidgetPosition(notePositionKey(note.id), {
      x: Math.max(16, width - 520 - (offset % 4) * 18),
      y: 48 + offset * 22,
    })
    updateNotes([...notes, note])
  }

  return (
    <>
      {notes.map((note) => (
        <StickyNoteCard
          key={note.id}
          note={note}
          canDelete={notes.length > 1}
          canAdd={notes.length < MAX_STICKY_NOTES}
          onChange={(next) => updateNote(note.id, next)}
          onRemove={() => removeNote(note.id)}
          onAdd={() => addNote()}
        />
      ))}
    </>
  )
}
