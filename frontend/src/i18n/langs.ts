export const LANGS = [
  { id: 'id', code: 'ID', native: 'Indonesia', locale: 'id-ID', dir: 'ltr', html: 'id' },
  { id: 'en', code: 'EN', native: 'English', locale: 'en-US', dir: 'ltr', html: 'en' },
  { id: 'es', code: 'ES', native: 'Español', locale: 'es-ES', dir: 'ltr', html: 'es' },
  { id: 'ar', code: 'AR', native: 'العربية', locale: 'ar-SA', dir: 'rtl', html: 'ar' },
  { id: 'zh', code: '中文', native: '中文', locale: 'zh-CN', dir: 'ltr', html: 'zh-CN' },
  { id: 'fr', code: 'FR', native: 'Français', locale: 'fr-FR', dir: 'ltr', html: 'fr' },
  { id: 'ja', code: 'JP', native: '日本語', locale: 'ja-JP', dir: 'ltr', html: 'ja' },
  { id: 'ru', code: 'RU', native: 'Русский', locale: 'ru-RU', dir: 'ltr', html: 'ru' },
] as const

export type Lang = (typeof LANGS)[number]['id']

const byId = Object.fromEntries(LANGS.map((item) => [item.id, item])) as Record<
  Lang,
  (typeof LANGS)[number]
>

export function isLang(value: string | null | undefined): value is Lang {
  return !!value && value in byId
}

export function parseLang(value: string | null | undefined): Lang {
  return isLang(value) ? value : 'id'
}

export function langMeta(lang: Lang) {
  return byId[lang]
}

export function applyDocumentLang(lang: Lang) {
  const meta = langMeta(lang)
  document.documentElement.lang = meta.html
  document.documentElement.dir = meta.dir
}
