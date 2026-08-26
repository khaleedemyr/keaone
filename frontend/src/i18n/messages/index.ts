import type { Lang } from '../langs'
import { ar } from './ar'
import { en } from './en'
import { es } from './es'
import { fr } from './fr'
import { id } from './id'
import { ja } from './ja'
import { ru } from './ru'
import type { MsgKey } from './types'
import { zh } from './zh'

export type { MsgKey }

export const messages: Record<Lang, Record<MsgKey, string>> = {
  id,
  en,
  es,
  ar,
  zh,
  fr,
  ja,
  ru,
}
