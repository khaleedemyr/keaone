import type { MsgKey } from '../../../i18n'

export const STOREFRONT_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp'

/** Infer recommended pixel size copy from slot key / kind. */
export function storefrontImageSizeHintKey(
  kind: 'logo' | 'image' | 'gallery' | 'carousel' | 'category',
  slotKey = '',
): MsgKey {
  if (kind === 'logo') return 'storefrontImageHintLogo'
  const key = slotKey.toLowerCase()
  if (/hero|banner|offer|campaign|sale|consult|about_image|mid_cta|challenge/.test(key)) {
    return 'storefrontImageHintHero'
  }
  if (/team|attorney|founder|float|portrait|avatar/.test(key)) {
    return 'storefrontImageHintPortrait'
  }
  if (kind === 'gallery' || kind === 'carousel' || /gallery|slide|strip|portfolio|project|work/.test(key)) {
    return 'storefrontImageHintGallery'
  }
  if (kind === 'category' || /categor/.test(key)) return 'storefrontImageHintCategory'
  return 'storefrontImageHintDefault'
}
