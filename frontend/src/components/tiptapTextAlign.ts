import { Extension } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    textAlign: {
      setTextAlign: (alignment: 'left' | 'center' | 'right' | 'justify') => ReturnType
      unsetTextAlign: () => ReturnType
    }
  }
}

/** Minimal TipTap text-align (avoids extra npm peer conflicts). */
export const TextAlign = Extension.create({
  name: 'textAlign',

  addOptions() {
    return {
      types: ['heading', 'paragraph'],
      alignments: ['left', 'center', 'right', 'justify'] as const,
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          textAlign: {
            default: null,
            parseHTML: (element) => {
              const align = element.style.textAlign
              return align || null
            },
            renderHTML: (attributes) => {
              if (!attributes.textAlign) return {}
              return { style: `text-align: ${attributes.textAlign}` }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setTextAlign:
        (alignment) =>
        ({ commands }) => {
          if (!this.options.alignments.includes(alignment)) return false
          return this.options.types
            .map((type: string) => commands.updateAttributes(type, { textAlign: alignment }))
            .some(Boolean)
        },
      unsetTextAlign:
        () =>
        ({ commands }) =>
          this.options.types.map((type: string) => commands.resetAttributes(type, 'textAlign')).every(Boolean),
    }
  },
})
