'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Search } from 'lucide-react';
import {
  HeaderLogo,
  HeaderActions,
  HeaderCTA,
  HeaderTopbar,
  NavLink,
  SearchBarInline,
  buildNavItems,
  getLucideIcon,
  type HeaderVariantProps,
  type NavItem,
  type MenuCategory,
  headerBgStyle,
  navBgStyle,
  navTextColor,
  accentColor,
} from '../header/HeaderShared';
import MegaMenuDropdown from './MegaMenuDropdown';

/**
 * HeaderMega
 *
 * Variante con Mega Menu (estilo marketplace):
 * - Fila superior: logo izq | BARRA DE BÚSQUEDA GRANDE (siempre visible) | acciones der.
 * - Fila inferior (border-top): nav items centrados/distribuidos.
 * - Si `menuCategories` tiene items y `settings.show_categories_in_header` es true,
 *   se agrega un item "Categorías" al nav que abre un MegaMenuDropdown al hover.
 * - Hidden en móvil (en móvil se usa el drawer).
 */
export default function HeaderMega({
  organization,
  primaryColor,
  navTree,
  settings,
  showCart,
  onCartClick,
  menuCategories,
  megaMenuItems,
}: HeaderVariantProps) {
  const organizationId = organization.id;
  const searchStyle = settings?.search_style;
  const ctaText = settings?.header_cta_text ?? '';
  const ctaHref = settings?.header_cta_url ?? undefined;
  const SearchIconComp = getLucideIcon(settings?.search_icon as string, Search);
  const [megaOpen, setMegaOpen] = useState(false);

  // Construir nav items desde el árbol de páginas
  const navItems: NavItem[] = buildNavItems(navTree);

  // Agregar item "Categorías" si hay categorías o megaMenuItems y la configuración lo habilita
  const showCategories =
    (!!menuCategories && menuCategories.length > 0 && settings?.show_categories_in_header === true) ||
    (!!megaMenuItems && megaMenuItems.length > 0);

  const megaColumns = settings?.mega_menu_columns ?? 4;

  // El Mega Menu siempre muestra la barra de búsqueda grande en desktop,
  // a menos que search_style === 'hidden'
  const showSearchBar = searchStyle !== 'hidden';

  return (
    <header className="sticky top-0 z-40 w-full">
      {/* Topbar opcional */}
      {settings?.show_topbar && <HeaderTopbar organization={organization} settings={settings} />}

      {/* Container sticky con backdrop-blur — la fila superior necesita z-20 para que su dropdown se vea encima de la nav row */}
      <div className="backdrop-blur-md shadow-sm border-b border-gray-200 dark:border-gray-800 bg-[var(--header-bg-light)] dark:bg-[var(--header-bg-dark)]" style={headerBgStyle(settings)}>
        {/* Fila superior: logo | BARRA DE BÚSQUEDA GRANDE | acciones */}
        <div className="relative z-20 max-w-7xl mx-auto px-4">
          <div className="hidden md:flex items-center justify-between gap-4" style={{ minHeight: `${(settings?.logo_height || 48) + 20}px` }}>
            {/* Logo izquierda */}
            <HeaderLogo
              organization={organization}
              primaryColor={primaryColor}
              height={settings?.logo_height || 48}
            />

            {/* Barra de búsqueda grande (siempre visible a menos que search_style='hidden') */}
            {showSearchBar && (
              <SearchBarInline
                primaryColor={primaryColor}
                organizationId={organizationId}
                className="flex-1 max-w-2xl mx-auto"
                size="lg"
                icon={SearchIconComp}
              />
            )}

            {/* Acciones derecha (sin icono de búsqueda, la barra ya está visible) */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <HeaderActions
                settings={settings}
                showCart={showCart}
                onCartClick={onCartClick}
                searchStyle={searchStyle}
                organizationId={organizationId}
                primaryColor={primaryColor}
                organizationSubdomain={organization.subdomain || ''}
                showSearchIcon={false}
              />
              <HeaderCTA
                text={ctaText}
                href={ctaHref}
                primaryColor={primaryColor}
                settings={settings}
              />
            </div>
          </div>
        </div>

        {/* Fila inferior: nav items con border-top — z-10 para que el dropdown del buscador superior se vea encima */}
        <div className="relative z-10 border-t border-gray-200 dark:border-gray-800 bg-[var(--header-bg-light)] dark:bg-[var(--header-bg-dark)]" style={navBgStyle(settings)}>
          <div className="max-w-7xl mx-auto px-4">
            <nav className="hidden md:flex items-center justify-center gap-6 h-12" style={{ color: navTextColor(settings) }}>
              {/* Nav items de páginas (con NavDropdown automático si tienen children) */}
              {navItems.map((item, i) => (
                <NavLink
                  key={i}
                  item={item}
                  primaryColor={accentColor(settings, primaryColor)}
                  hasDropdown={!!item.children}
                />
              ))}

              {/* Item "Categorías" con MegaMenuDropdown */}
              {showCategories && (
                <div
                  className="relative"
                  onMouseEnter={() => setMegaOpen(true)}
                  onMouseLeave={() => setMegaOpen(false)}
                >
                  <Link
                    href="/categorias"
                    className="relative text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors whitespace-nowrap flex items-center gap-1"
                  >
                    <span>Categorías</span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 opacity-60 transition-transform ${megaOpen ? 'rotate-180' : ''}`}
                    />
                  </Link>

                  {megaOpen && (
                    <MegaMenuDropdown
                      categories={menuCategories}
                      items={megaMenuItems}
                      columns={megaColumns}
                      primaryColor={primaryColor}
                    />
                  )}
                </div>
              )}
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
