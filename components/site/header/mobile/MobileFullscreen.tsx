'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu as MenuIcon, X, Globe } from 'lucide-react';
import {
  HeaderLogo,
  HeaderActions,
  HeaderTopbar,
  SearchBarInline,
  buildNavItems,
  MobileCurrencyChips,
  MobileAuthSection,
  useAuthState,
  type HeaderVariantProps,
  type NavItem,
  type MenuCategory,
} from '../HeaderShared';

/**
 * MobileFullscreen
 * Header móvil con menú a pantalla completa.
 * - Logo a la izquierda + acciones a la derecha (menu button o X si está abierto)
 * - Al abrir: overlay fullscreen blanco/gray-900 con logo + X arriba,
 *   nav items en lista vertical grande (text-lg) y accordion para children.
 * - Auth links al final.
 */
export default function MobileFullscreen({
  organization,
  primaryColor,
  navTree,
  settings,
  showCart,
  onCartClick,
  menuCategories,
}: HeaderVariantProps) {
  const [open, setOpen] = useState(false);
  const isLoggedIn = useAuthState();
  const navItems = buildNavItems(navTree);
  const organizationId = organization.id;
  const searchStyle = settings?.mobile_search_style ?? 'icon';

  // Construir item "Categorías" si está habilitado
  const showCategories =
    !!menuCategories &&
    menuCategories.length > 0 &&
    settings?.show_categories_in_header === true;

  const categoriesItem: NavItem | null = showCategories
    ? {
        name: 'Categorías',
        href: '/categorias',
        children: menuCategories!.map((cat) => ({
          name: cat.name,
          href: `/categorias/${cat.slug}`,
          icon: cat.icon,
        })),
      }
    : null;

  const allItems = categoriesItem ? [...navItems, categoriesItem] : navItems;

  return (
    <header className="md:hidden sticky top-0 z-40 w-full">
      {settings?.mobile_show_topbar && <HeaderTopbar organization={organization} settings={settings} forceVisible />}

      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="px-4">
          <div className="flex items-center justify-between gap-2" style={{ minHeight: Math.max(56, Math.round((settings?.logo_height || 48) * 0.85) + 16) }}>
            <HeaderLogo organization={organization} primaryColor={primaryColor} height={Math.max(36, Math.round((settings?.logo_height || 48) * 0.85))} />
            <div className="flex items-center gap-2 flex-shrink-0">
              <HeaderActions
                settings={settings}
                showCart={showCart}
                onCartClick={onCartClick}
                searchStyle={searchStyle}
                organizationId={organizationId}
                primaryColor={primaryColor}
                organizationSubdomain={organization.subdomain || ''}
                showSearchIcon={searchStyle === 'icon'}
                isMobile={true}
              />
              <button
                onClick={() => setOpen((v) => !v)}
                aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
                className="p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {open ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {searchStyle === 'bar' && (
            <div className="px-4 pb-3">
              <SearchBarInline
                primaryColor={primaryColor}
                organizationId={organizationId}
                className="w-full"
                size="sm"
              />
            </div>
          )}
        </div>
      </div>

      {/* Overlay fullscreen */}
      {open && (
        <div className="fixed inset-0 z-[70] bg-white dark:bg-gray-900 overflow-y-auto shadow-2xl">
          <div className="flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800" style={{ minHeight: Math.max(56, Math.round((settings?.logo_height || 48) * 0.85) + 16) }}>
            <HeaderLogo organization={organization} primaryColor={primaryColor} height={Math.max(32, Math.round((settings?.logo_height || 48) * 0.7))} />
            <button
              onClick={() => setOpen(false)}
              aria-label="Cerrar menú"
              className="p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="px-4 py-4">
            {allItems.map((item, i) => (
              <FullscreenNavItem
                key={i}
                item={item}
                primaryColor={primaryColor}
                onNavigate={() => setOpen(false)}
              />
            ))}

            <div className="px-4 py-4 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2 mb-3 text-sm text-gray-500 dark:text-gray-400">
                <Globe className="h-4 w-4" />
                <span>Moneda</span>
              </div>
              <MobileCurrencyChips primaryColor={primaryColor} />
            </div>

            <MobileAuthSection isLoggedIn={isLoggedIn} primaryColor={primaryColor} onNavigate={() => setOpen(false)} />
          </nav>
        </div>
      )}
    </header>
  );
}

function FullscreenNavItem({
  item,
  primaryColor,
  onNavigate,
}: {
  item: NavItem;
  primaryColor: string;
  onNavigate: () => void;
}) {
  if (item.children && item.children.length > 0) {
    return (
      <details className="group border-b border-gray-100 dark:border-gray-800">
        <summary className="flex items-center justify-between cursor-pointer py-4 text-lg font-medium text-gray-900 dark:text-white list-none">
          <span className="flex items-center gap-2">
            {item.icon && <span>{item.icon}</span>}
            <span>{item.name}</span>
            {item.badge && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-semibold"
                style={{ backgroundColor: primaryColor }}
              >
                {item.badge}
              </span>
            )}
          </span>
          <span className="text-gray-400 group-open:rotate-180 transition-transform">▾</span>
        </summary>
        <div className="pl-6 pb-3">
          <Link
            href={item.href}
            className="block py-2 text-base text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            onClick={onNavigate}
          >
            Ver todo
          </Link>
          {item.children.map((child, j) => (
            <Link
              key={j}
              href={child.href}
              className="block py-2 text-base text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              onClick={onNavigate}
            >
              {child.name}
            </Link>
          ))}
        </div>
      </details>
    );
  }

  return (
    <Link
      href={item.href}
      className="flex items-center gap-2 py-4 text-lg font-medium text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800"
      onClick={onNavigate}
    >
      {item.icon && <span>{item.icon}</span>}
      <span>{item.name}</span>
      {item.badge && (
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-semibold"
          style={{ backgroundColor: primaryColor }}
        >
          {item.badge}
        </span>
      )}
    </Link>
  );
}
