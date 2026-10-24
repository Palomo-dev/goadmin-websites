'use client';

import { FilaSedeMovil } from '../SelectorSedeEncabezado';
import { FilaLogoMovil } from './FilaLogoMovil';
import { useState } from 'react';
import Link from 'next/link';
import { Menu as MenuIcon, X, ChevronDown, LogOut, UserCircle, Search } from 'lucide-react';
import {
  HeaderLogo,
  HeaderActions,
  HeaderCTA2,
  HeaderTopbar,
  HeaderCTAMovil,
  SearchBarInline,
  buildNavItems,
  BloqueMonedaMovil,
  useAuthState,
  getLucideIcon,
  type HeaderVariantProps,
  type NavItem,
  type MenuCategory,
  CLASE_FONDO_ENCABEZADO,
  variablesEncabezado,
  estiloBarraEncabezado,
  estiloPanelMenu,
  atributosMenuMovil,
  useTemaMenuMovil,
  marcaFondoEncabezado,
  ESTILO_BOTON_ENTRAR,
  ESTILO_BOTON_REGISTRO,
  ESTILO_BOTON_SALIR,
} from '../HeaderShared';

/**
 * MobileDrawer
 * Drawer lateral derecho (estilo hamburguesa) — restaurado al look del header original.
 * - Logo a la izquierda + acciones a la derecha (search, cart, menu)
 * - Backdrop con backdrop-blur-sm
 * - Nav links con rounded-lg hover:bg-gray-100 font-medium
 * - "Mi Cuenta" dentro del nav (solo si logueado)
 * - Sección de moneda con BloqueMonedaMovil (se oculta si el encabezado apagó la moneda)
 * - Auth buttons al final (Iniciar sesión / Registrarse o Cerrar sesión)
 * - Accordion nativo para children (sub-páginas y categorías)
 */
export default function MobileDrawer({
  organization,
  primaryColor,
  navTree,
  settings,
  showCart,
  onCartClick,
  menuCategories,
  posicionLogo,
}: HeaderVariantProps) {
  const [open, setOpen] = useState(false);
  const temaMenu = useTemaMenuMovil(primaryColor);
  const isLoggedIn = useAuthState();
  const navItems = buildNavItems(navTree);
  const organizationId = organization.id;
  const searchStyle = settings?.mobile_search_style ?? 'icon';
  const showSearchBar = searchStyle === 'bar';
  const SearchIconComp = getLucideIcon(settings?.search_icon as string, Search);

  const showHeaderAuth = settings?.show_header_auth !== false;

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
    <header className="lg:hidden sticky top-0 z-40 w-full" style={variablesEncabezado(settings, temaMenu)}>
      {settings?.mobile_show_topbar && <HeaderTopbar organization={organization} settings={settings} forceVisible />}

      <div className={CLASE_FONDO_ENCABEZADO} style={estiloBarraEncabezado(settings, 'bottom')} {...marcaFondoEncabezado(settings)}>
        <div className="px-4">
          <FilaLogoMovil
            ajustes={settings}
            posicion={posicionLogo}
            minHeight={Math.max(56, Math.round((settings?.logo_height || 48) * 0.85) + 16)}
            logo={<HeaderLogo organization={organization} primaryColor={primaryColor} height={Math.max(36, Math.round((settings?.logo_height || 48) * 0.85))} />}
            acciones={
              <>
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
                <HeaderCTA2 settings={settings} movil />
                <HeaderCTAMovil settings={settings} primaryColor={primaryColor} />
              </>
            }
            menu={
              <button
                onClick={() => setOpen(true)}
                aria-label="Abrir menú"
                className="p-2 rounded-lg text-[var(--hdr-mobile-icon)] hover:bg-[var(--header-hover)] transition-colors"
              >
                <MenuIcon className="h-6 w-6" />
              </button>
            }
          />

          {showSearchBar && (
            <div className="pb-3">
              <SearchBarInline
                settings={settings}
                primaryColor={primaryColor}
                organizationId={organizationId}
                className="w-full"
                size="sm"
                icon={SearchIconComp}
              />
            </div>
          )}
        </div>
      </div>

      {/* Mobile Drawer — restaurado al estilo del header original */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-[60]">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          {/* Drawer panel */}
          <div className={`absolute right-0 top-0 h-full w-80 max-w-[85vw] ${CLASE_FONDO_ENCABEZADO} shadow-2xl flex flex-col`} style={estiloPanelMenu(settings, temaMenu)} {...marcaFondoEncabezado(settings)} {...atributosMenuMovil(settings, temaMenu)}>
            {/* Drawer header */}
            <div className="flex items-center justify-between p-4 border-b border-[color:var(--mm-divider)]">
              <span className="font-bold text-[var(--mm-title)]">Menú</span>
              <button
                onClick={() => setOpen(false)}
                className="p-2 rounded-lg hover:bg-[var(--header-hover)]"
                aria-label="Cerrar menú"
              >
                <X className="h-5 w-5 text-[var(--mm-title)]" />
              </button>
            </div>

            {/* Navigation links */}
            <nav className="flex-1 overflow-y-auto p-4 space-y-1">
              {allItems.map((item) => (
                <DrawerNavItem
                  key={item.name}
                  item={item}
                  primaryColor={primaryColor}
                  onNavigate={() => setOpen(false)}
                />
              ))}

              {/* Mi Cuenta — solo si está logueado */}
              {isLoggedIn && showHeaderAuth && (
                <Link
                  href="/mi-cuenta"
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-[var(--mm-fg)] hover:bg-[var(--mm-hover-bg)] hover:text-[var(--mm-hover-fg)] font-medium transition-colors"
                  onClick={() => setOpen(false)}
                >
                  <UserCircle className="h-5 w-5" style={{ color: primaryColor }} />
                  Mi Cuenta
                </Link>
              )}
            </nav>

            <BloqueMonedaMovil primaryColor={primaryColor} className="p-4 border-t border-[color:var(--mm-divider)]" />

            {/* Auth buttons */}
            {showHeaderAuth && (
              <div className="p-4 border-t border-[color:var(--mm-divider)] space-y-2">
                {isLoggedIn ? (
                  <button
                    onClick={async () => {
                      const { createClient } = await import('@/lib/supabase/client');
                      const supabase = createClient();
                      await supabase.auth.signOut();
                      setOpen(false);
                      window.location.href = '/';
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border font-medium transition-colors hover:bg-[var(--mm-hover-bg)]"
                    style={ESTILO_BOTON_SALIR}
                  >
                    <LogOut className="h-4 w-4" />
                    Cerrar sesión
                  </button>
                ) : (
                  <>
                    <Link
                      href="/auth"
                      className="block w-full text-center px-4 py-2.5 rounded-lg font-medium transition-opacity hover:opacity-90"
                      style={ESTILO_BOTON_ENTRAR}
                      onClick={() => setOpen(false)}
                    >
                      Iniciar sesión
                    </Link>
                    <Link
                      href="/auth?tab=register"
                      className="block w-full text-center px-4 py-2.5 rounded-lg font-medium border transition-colors"
                      style={ESTILO_BOTON_REGISTRO}
                      onClick={() => setOpen(false)}
                    >
                      Registrarse
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      <FilaSedeMovil primaryColor={primaryColor} />
    </header>
  );
}

/**
 * Item de navegación del drawer — soporta accordion nativo para children.
 * Restaurado al estilo del header original: rounded-lg, hover:bg-gray-100, font-medium.
 */
function DrawerNavItem({
  item,
  primaryColor,
  onNavigate,
}: {
  item: NavItem;
  primaryColor: string;
  onNavigate: () => void;
}) {
  // Item con children → accordion
  if (item.children && item.children.length > 0) {
    return (
      <details className="group">
        <summary className="flex items-center justify-between cursor-pointer px-3 py-2.5 rounded-lg text-[var(--mm-fg)] hover:bg-[var(--mm-hover-bg)] hover:text-[var(--mm-hover-fg)] font-medium transition-colors list-none">
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
          <ChevronDown className="h-4 w-4 text-[var(--mm-fg-muted)] group-open:rotate-180 transition-transform" />
        </summary>
        <div className="pl-6 space-y-1 mt-1">
          <Link
            href={item.href}
            className="block px-3 py-2 rounded-lg text-sm text-[var(--mm-fg-muted)] hover:bg-[var(--mm-hover-bg)] hover:text-[var(--mm-hover-fg)] transition-colors"
            onClick={onNavigate}
          >
            Ver todo
          </Link>
          {item.children.map((child, j) => (
            <Link
              key={j}
              href={child.href}
              className="block px-3 py-2 rounded-lg text-sm text-[var(--mm-fg-muted)] hover:bg-[var(--mm-hover-bg)] hover:text-[var(--mm-hover-fg)] transition-colors"
              onClick={onNavigate}
            >
              {child.name}
            </Link>
          ))}
        </div>
      </details>
    );
  }

  // Item simple
  return (
    <Link
      href={item.href}
      className="block px-3 py-2.5 rounded-lg text-[var(--mm-fg)] hover:bg-[var(--mm-hover-bg)] hover:text-[var(--mm-hover-fg)] font-medium transition-colors"
      onClick={onNavigate}
    >
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
    </Link>
  );
}
