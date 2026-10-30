'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Search } from 'lucide-react';
import {
  HeaderLogo,
  HeaderActions,
  HeaderCTA,
  HeaderCTA2,
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
  claseNavEncabezado,
  variablesEncabezado,
  estiloDivisor,
} from '../header/HeaderShared';
import { useEncabezadoPie } from '../EncabezadoPieContext';
import { SelectorSedeEncabezado } from './SelectorSedeEncabezado';
import MegaMenuDropdown from './MegaMenuDropdown';
import { barraSiCromo } from './BuscadorCromo';
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext';

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
  branchId,
}: HeaderVariantProps) {
  const organizationId = organization.id;
  const searchStyle = settings?.search_style;
  const ctaText = settings?.header_cta_text ?? '';
  const ctaHref = settings?.header_cta_url ?? undefined;
  const SearchIconComp = getLucideIcon(settings?.search_icon as string, Search);
  const [megaOpen, setMegaOpen] = useState(false);
  const { ruta } = useRutaSitio();
  const { opciones } = useEncabezadoPie();

  // Construir nav items desde el árbol de páginas
  const navItemsBase: NavItem[] = buildNavItems(navTree);

  // Agregar item "Categorías" si hay categorías o megaMenuItems y la configuración lo habilita
  const showCategories =
    (!!menuCategories && menuCategories.length > 0 && settings?.show_categories_in_header === true) ||
    (!!megaMenuItems && megaMenuItems.length > 0);

  // «Categorías» una sola vez: si el mega menú ya pone su ítem, se quita el enlace
  // a /categorias que venga de las páginas (paquete 5-nov C2).
  const esEnlaceCategorias = (href: string) => /(^|\/)categorias\/?$/.test(href.split(/[?#]/)[0]);
  const navItems: NavItem[] = showCategories
    ? navItemsBase.filter((it) => !(esEnlaceCategorias(it.href) && !(it.children && it.children.length > 0)))
    : navItemsBase;

  const megaColumns = settings?.mega_menu_columns ?? 4;

  // El Mega Menu siempre muestra la barra de búsqueda grande en desktop,
  // a menos que search_style === 'hidden'
  const showSearchBar = searchStyle !== 'hidden';

  return (
    <header className="sticky top-0 z-40 w-full" style={variablesEncabezado(settings)}>
      {/* Topbar opcional */}
      {settings?.show_topbar && <HeaderTopbar organization={organization} settings={settings} />}

      {/* Container sticky con backdrop-blur — la fila superior necesita z-20 para que su dropdown se vea encima de la nav row */}
      <div className="backdrop-blur-md shadow-sm bg-[var(--header-bg-light)] dark:bg-[var(--header-bg-dark)]" style={{ ...headerBgStyle(settings), ...estiloDivisor(settings, 'bottom') }}>
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
            {barraSiCromo(settings, showSearchBar ? (
              <SearchBarInline
                primaryColor={primaryColor}
                organizationId={organizationId}
                className="flex-1 max-w-2xl mx-auto"
                size="lg"
                icon={SearchIconComp}
              />
            ) : null, { primaryColor, organizationId, categorias: menuCategories, className: 'flex-1 max-w-2xl mx-auto' })}

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
                branchId={branchId}
              />
              <SelectorSedeEncabezado primaryColor={primaryColor} />
              <HeaderCTA2 settings={settings} />
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
        <div className="relative z-10 bg-[var(--header-bg-light)] dark:bg-[var(--header-bg-dark)]" style={{ ...navBgStyle(settings), ...estiloDivisor(settings, 'top') }}>
          <div className="max-w-7xl mx-auto px-4">
            <nav className="relative hidden md:flex items-center justify-center gap-6 h-12" style={{ color: navTextColor(settings) }}>
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
                  className="static"
                  onMouseEnter={() => setMegaOpen(true)}
                  onMouseLeave={() => setMegaOpen(false)}
                >
                  <Link
                    href={ruta('/categorias')}
                    className={claseNavEncabezado(Boolean(opciones.colorTextoEncabezado))}
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
