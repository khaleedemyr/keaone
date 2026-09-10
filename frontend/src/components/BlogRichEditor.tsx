import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import { useEffect, useRef, type ReactNode } from 'react'
import { uploadBlogMedia } from '../api/platformBlog'
import { useI18n } from '../i18n'
import { TextAlign } from './tiptapTextAlign'
import './blogEditor.css'

type Props = {
  value: string
  onChange: (html: string) => void
  /** Platform blog: image upload needs saved post id. */
  postId?: number | null
  onNeedSave?: () => void
  /**
   * Custom image uploader (e.g. storefront media).
   * When set, images can be inserted without postId.
   */
  uploadImage?: (file: File) => Promise<{ url: string }>
  placeholder?: string
}

function ToolbarButton({
  active,
  onClick,
  title,
  children,
  disabled,
}: {
  active?: boolean
  onClick: () => void
  title: string
  children: ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className={`blog-editor-btn${active ? ' is-active' : ''}`}
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function BlogRichEditor({
  value,
  onChange,
  postId = null,
  onNeedSave,
  uploadImage,
  placeholder,
}: Props) {
  const { t } = useI18n()
  const fileRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder: placeholder || t('blogEditorPlaceholder') }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'blog-editor-content',
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML())
    },
  })

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    const next = value || ''
    if (current !== next) {
      editor.commands.setContent(next, { emitUpdate: false })
    }
  }, [editor, value])

  async function onImagePick(file: File | null) {
    if (!file || !editor) return
    try {
      if (uploadImage) {
        const { url } = await uploadImage(file)
        editor.chain().focus().setImage({ src: url, alt: file.name }).run()
        return
      }
      if (!postId) {
        onNeedSave?.()
        return
      }
      const { url } = await uploadBlogMedia(postId, file)
      editor.chain().focus().setImage({ src: url, alt: file.name }).run()
    } catch {
      /* parent shows feedback */
    }
  }

  function setLink() {
    if (!editor) return
    const prev = editor.getAttributes('link').href as string | undefined
    const url = window.prompt(t('blogEditorLinkPrompt'), prev ?? 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  const canInsertImage = Boolean(uploadImage || postId)
  const imageTitle = canInsertImage ? t('blogEditorImage') : t('blogEditorSaveFirstForImage')

  if (!editor) return null

  return (
    <div className="blog-editor">
      <div className="blog-editor-toolbar" role="toolbar" aria-label={t('blogBody')}>
        <ToolbarButton
          title={t('blogEditorHeading2')}
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          title={t('blogEditorHeading3')}
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </ToolbarButton>
        <span className="blog-editor-sep" aria-hidden />
        <ToolbarButton
          title={t('blogEditorBold')}
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          title={t('blogEditorItalic')}
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          title={t('blogEditorUnderline')}
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <u>U</u>
        </ToolbarButton>
        <span className="blog-editor-sep" aria-hidden />
        <ToolbarButton
          title={t('blogEditorAlignLeft')}
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        >
          ⬅
        </ToolbarButton>
        <ToolbarButton
          title={t('blogEditorAlignCenter')}
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        >
          ≡
        </ToolbarButton>
        <ToolbarButton
          title={t('blogEditorAlignRight')}
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
        >
          ➡
        </ToolbarButton>
        <ToolbarButton
          title={t('blogEditorAlignJustify')}
          active={editor.isActive({ textAlign: 'justify' })}
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        >
          ≣
        </ToolbarButton>
        <span className="blog-editor-sep" aria-hidden />
        <ToolbarButton
          title={t('blogEditorBulletList')}
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          •≡
        </ToolbarButton>
        <ToolbarButton
          title={t('blogEditorOrderedList')}
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1≡
        </ToolbarButton>
        <ToolbarButton
          title={t('blogEditorQuote')}
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          “
        </ToolbarButton>
        <span className="blog-editor-sep" aria-hidden />
        <ToolbarButton title={t('blogEditorLink')} active={editor.isActive('link')} onClick={setLink}>
          🔗
        </ToolbarButton>
        <ToolbarButton title={imageTitle} onClick={() => fileRef.current?.click()} disabled={!canInsertImage && !onNeedSave}>
          🖼
        </ToolbarButton>
        <span className="blog-editor-sep" aria-hidden />
        <ToolbarButton title={t('blogEditorUndo')} onClick={() => editor.chain().focus().undo().run()}>
          ↶
        </ToolbarButton>
        <ToolbarButton title={t('blogEditorRedo')} onClick={() => editor.chain().focus().redo().run()}>
          ↷
        </ToolbarButton>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          void onImagePick(e.target.files?.[0] ?? null)
          e.target.value = ''
        }}
      />
      <EditorContent editor={editor} />
    </div>
  )
}
