'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Home, LayoutGrid, Search, ShoppingBag, User, X, Globe } from 'lucide-react';
import {
  HeaderLogo,
  HeaderActions,
  HeaderTopbar,
  SearchBarInline,
  buildNavItems,
  MobileCurrencyChips,
  getLucideIcon,
  type HeaderVariantProps,
  type NavItem,
} from '../HeaderShared';

/**
 * MobileTabs
 * Header móvil con barra inferior fija tipo app.
 * - Header: logo izq + acciones der (sin menu button)
 * - Barra inferior fija (fixed bottom-0) con 5 tabs:
 *   Inicio, Categorías (modal), Buscar (modal), Carrito, Cuenta
 */
export default function MobileTabs({
  organization,
  primaryColor,
  navTree,
  settings,
  showCart,
  onCartClick,
  menuCategories,
}: HeaderVariantProps) {
  const [showCategories, setShowCategories] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const navItems = buildNavItems(navTree);
  const organizationId = organization.id;
  const searchStyle = settings?.mobile_search_style ?? 'icon';

  // Fase 12B: Iconos personalizables para la barra inferior
  const SearchTabIcon = getLucideIcon(settings?.search_icon as string, Search);
  const CartTabIcon = getLucideIcon(settings?.cart_icon as string, ShoppingBag);
  const AuthTabIcon = getLucideIcon(settings?.auth_icon as string, User);

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
            </div>
          </div>

          {searchStyle === 'bar' && (
            <div className="pb-3">
              <SearchBarInline
                primaryColor={primaryColor}
                organizationId={organizationId}
                className="w-full"
                size="sm"
                icon={SearchTabIcon}
              />
            </div>
          )}
        </div>
      </div>

      {/* Espaciador para la barra inferior fija */}
      <div className="h-14" aria-hidden="true" />

      {/* Barra inferior fija */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-5 h-14">
          <TabButton href="/" icon={<Home className="h-5 w-5" />} label="Inicio" />
          <TabButton
            onClick={() => setShowCategories(true)}
            icon={<LayoutGrid className="h-5 w-5" />}
            label="Categorías"
          />
          <TabButton
            onClick={() => setShowSearch(true)}
            icon={<SearchTabIcon className="h-5 w-5" />}
            label="Buscar"
          />
          <TabButton
            onClick={() => onCartClick?.()}
            icon={<CartTabIcon className="h-5 w-5" />}
            label="Carrito"
          />
          <TabButton href="/auth" icon={<AuthTabIcon className="h-5 w-5" />} label="Cuenta" />
        </div>
      </nav>

      {/* Modal de categorías */}
      {showCategories && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowCategories(false)}
            aria-hidden="true"
          />
          <div className="relative w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 h-14 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-semibold text-gray-900 dark:text-white">Categorías</h3>
              <button
                onClick={() => setShowCategories(false)}
                aria-label="Cerrar"
                className="p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-1">
              {menuCategories && menuCategories.length > 0
                ? menuCategories.map((cat) => (
                    <Link
                      key={cat.id}
                      href={`/categoria/${cat.slug}`}
                      className="flex items-center gap-3 py-3 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                      onClick={() => setShowCategories(false)}
                    >
                      {cat.icon && <span className="text-xl">{cat.icon}</span>}
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {cat.name}
                      </span>
                    </Link>
                  ))
                : navItems.map((item, i) => (
                    <CategoryNavItem
                      key={i}
                      item={item}
                      primaryColor={primaryColor}
                      onNavigate={() => setShowCategories(false)}
                    />
                  ))}
            </div>

            {/* Selector de moneda */}
            <div className="px-4 pb-4 pt-3 border-t border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-2 mb-3 text-sm text-gray-500 dark:text-gray-400">
                <Globe className="h-4 w-4" />
                <span>Moneda</span>
              </div>
              <MobileCurrencyChips primaryColor={primaryColor} />
            </div>
          </div>
        </div>
      )}

      {/* Modal de búsqueda */}
      {showSearch && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowSearch(false)}
            aria-hidden="true"
          />
          <div className="relative w-full sm:max-w-lg bg-white dark:bg-gray-900 rounded-2xl mx-4">
            <div className="flex items-center justify-between px-4 h-14 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-semibold text-gray-900 dark:text-white">Buscar</h3>
              <button
                onClick={() => setShowSearch(false)}
                aria-label="Cerrar"
                className="p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              <form
                action="/search"
                className="flex items-center gap-2 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2"
              >
                <SearchTabIcon className="h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  name="q"
                  placeholder="Buscar productos..."
                  autoFocus
                  className="flex-1 bg-transparent outline-none text-sm text-gray-900 dark:text-white placeholder-gray-400"
                />
              </form>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function TabButton({
  href,
  onClick,
  icon,
  label,
}: {
  href?: string;
  onClick?: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  const content = (
    <span className="flex flex-col items-center justify-center gap-0.5 h-full text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="flex items-center justify-center">
        {content}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className="flex items-center justify-center" aria-label={label}>
      {content}
    </button>
  );
}

function CategoryNavItem({
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
      <details className="group">
        <summary className="flex items-center gap-3 py-3 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer list-none">
          {item.icon && <span className="text-xl">{item.icon}</span>}
          <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">
            {item.name}
          </span>
          {item.badge && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-semibold"
              style={{ backgroundColor: primaryColor }}
            >
              {item.badge}
            </span>
          )}
          <span className="text-gray-400 group-open:rotate-180 transition-transform">▾</span>
        </summary>
        <div className="pl-8 space-y-1">
          {item.children.map((child, j) => (
            <Link
              key={j}
              href={child.href}
              className="block py-2 px-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
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
      className="flex items-center gap-3 py-3 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
      onClick={onNavigate}
    >
      {item.icon && <span className="text-xl">{item.icon}</span>}
      <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">
        {item.name}
      </span>
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
