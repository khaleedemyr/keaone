import { useShop } from '../commerce/StorefrontShop'
import type { FooterLinkItem } from '../lib/footerLinks'
import { handleShopNavClick } from './storefrontNav'

type Props = {
  links: FooterLinkItem[]
  className?: string
  itemClassName?: string
  /** Use div row instead of ul list (e.g. legal links). */
  inline?: boolean
}

function runAction(shop: ReturnType<typeof useShop>, action: FooterLinkItem['action']) {
  if (!shop || !action) return
  if (action === 'cart' || action === 'checkout') shop.openCart()
  else if (action === 'account') shop.customer ? shop.openAccount() : shop.openLogin()
  else if (action === 'login') shop.openLogin()
}

function LinkNode({
  link,
  className,
  shop,
}: {
  link: FooterLinkItem
  className?: string
  shop: ReturnType<typeof useShop>
}) {
  if (link.action) {
    return (
      <button type="button" className={className} onClick={() => runAction(shop, link.action)}>
        {link.label}
      </button>
    )
  }
  return (
    <a href={link.href || '#'} className={className} onClick={(e) => handleShopNavClick(e, link, shop)}>
      {link.label}
    </a>
  )
}

/** Renders configurable footer links (anchors + cart/account actions). */
export function FooterLinkList({ links, className, itemClassName, inline = false }: Props) {
  const shop = useShop()
  if (!links.length) return null

  if (inline) {
    return (
      <div className={className}>
        {links.map((link) => (
          <LinkNode key={`${link.label}-${link.href ?? link.action ?? ''}`} link={link} className={itemClassName} shop={shop} />
        ))}
      </div>
    )
  }

  return (
    <ul className={className}>
      {links.map((link) => (
        <li key={`${link.label}-${link.href ?? link.action ?? ''}`}>
          <LinkNode link={link} className={itemClassName} shop={shop} />
        </li>
      ))}
    </ul>
  )
}
