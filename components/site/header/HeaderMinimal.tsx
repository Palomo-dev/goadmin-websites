'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Menu as MenuIcon, X, LogOut, UserCircle, ChevronDown, Search } from 'lucide-react';
import {
  HeaderLogo,
  HeaderActions,
  HeaderCTA,
  HeaderCTA2,
  HeaderTopbar,
  SearchBarInline,
  MobileMenuButton,
  NavList,
  buildNavItems,
  BloqueMonedaMovil,
  useAuthState,
  getLucideIcon,
  type HeaderVariantProps,
  type NavItem,
  headerBgStyle,
  navBgStyle,
  navTextColor,
  accentColor,
  variablesEncabezado,
  estiloDivisor,
  headerTextColor,
} from '../header/HeaderShared';
import { SelectorSedeEncabezado } from './SelectorSedeEncabezado';
import { barraSiCromo } from './BuscadorCromo';
import { useBarraAbajo } from './barraEnFila';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer';

/**
 * HeaderMinimal
 *
 * Variante minimalista del header:
 * - Logo + search + cart + CTA + botón menú hamburguesa (desktop).
 * - NO muestra currency selector ni auth en el header — van dentro del drawer.
 * - Drawer lateral derecho más grande (400px) con vaul:
 *   navegación + currency selector + auth buttons.
 * - `minimal_menu_style`: 'drawer' (panel lateral, por defecto), 'dropdown' (desplegable bajo el
 *   botón) o 'fullscreen' (capa a pantalla completa con el mismo contenido del panel).
 * - Fila móvil: se ve hasta que SiteHeader cambia al encabezado del celular (y entre los cortes
 *   640/768); su botón abre el panel lateral.
 */
export default function HeaderMinimal({
  organization,
  primaryColor,
  navTree,
  settings,
  showCart,
  onCartClick,
  menuCategories,
  branchId,
}: HeaderVariantProps) {
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const organizationId = organization.id;
  const searchStyle = settings?.search_style;
  const ctaText = settings?.header_cta_text ?? '';
  const ctaHref = settings?.header_cta_url ?? undefined;
  const SearchIconComp = getLucideIcon(settings?.search_icon as string, Search);
  const navItems = buildNavItems(navTree);
  const minimalMenuStyle = settings?.minimal_menu_style ?? 'drawer';
  const isLoggedIn = useAuthState();
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

  // Cerrar el menú desktop al hacer clic fuera (dropdown mode)
  useEffect(() => {
    if (!desktopMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setDesktopMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [desktopMenuOpen]);

  // Pantalla completa: Escape cierra y la página de atrás no se desplaza.
  useEffect(() => {
    if (!fullscreenOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreenOpen(false);
    };
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflowPrevio;
      document.removeEventListener('keydown', onKey);
    };
  }, [fullscreenOpen]);

  const openMenu = () => {
    if (minimalMenuStyle === 'fullscreen') {
      setFullscreenOpen(true);
    } else if (minimalMenuStyle === 'dropdown') {
      setDesktopMenuOpen(!desktopMenuOpen);
    } else {
      // 'drawer' y cualquier valor desconocido: el panel lateral.
      setDrawerOpen(true);
    }
  };

  const contenidoMenu = (onCerrar: () => void) => (
    <ContenidoMenuMinimal
      items={allItems}
      primaryColor={primaryColor}
      settings={settings}
      isLoggedIn={isLoggedIn}
      showHeaderAuth={showHeaderAuth}
      onCerrar={onCerrar}
    />
  );

  // Barra del buscador en la fila; si no cabe (menos de 240px, el menú recortaría o la fila
  // desborda), baja a una segunda fila de ancho completo (useBarraAbajo).
  const barra = (clase: string) => barraSiCromo(settings, searchStyle === 'bar' ? (
              <SearchBarInline
                primaryColor={primaryColor}
                organizationId={organizationId}
                className={clase}
                size="lg"
                icon={SearchIconComp}
              />
              ) : null, { primaryColor, organizationId, categorias: menuCategories, className: clase });
  const hayBarra = barra('') != null;
  const filaRef = useRef<HTMLDivElement>(null);
  const barraAbajo = useBarraAbajo(filaRef, hayBarra);

  return (
    <header className="sticky top-0 z-40 w-full" style={variablesEncabezado(settings)}>
      {/* Topbar opcional */}
      {settings?.show_topbar && <HeaderTopbar organization={organization} settings={settings} />}

      {/* Barra principal */}
      <div className="backdrop-blur-md shadow-sm bg-[var(--header-bg-light)] dark:bg-[var(--header-bg-dark)]" style={{ ...headerBgStyle(settings), ...estiloDivisor(settings, 'bottom') }}>
        <div className="max-w-7xl mx-auto px-4">
          <div ref={filaRef} className="hidden md:flex items-center justify-between gap-4" style={{ minHeight: `${(settings?.logo_height || 48) + 16}px` }}>
            {/* Logo izquierda */}
            <HeaderLogo
              organization={organization}
              primaryColor={primaryColor}
              height={settings?.logo_height || 48}
            />

            {/* Search bar inline (si search_style === 'bar') */}
            {!barraAbajo && barra('flex-1 max-w-xl mx-auto min-w-[240px]')}

            {/* Acciones derecha: search icon + cart + CTA + botón menú */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <HeaderActions
                settings={settings}
                showCart={showCart}
                onCartClick={onCartClick}
                searchStyle={searchStyle}
                organizationId={organizationId}
                primaryColor={primaryColor}
                organizationSubdomain={organization.subdomain || ''}
                showSearchIcon={searchStyle !== 'bar'}
                hideCurrency
                hideAuth
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
              {/* Botón menú hamburguesa desktop */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={openMenu}
                  className={`p-2 rounded-lg hover:bg-[var(--header-hover)] transition-colors ${headerTextColor(settings) ? 'text-current' : 'text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'}`}
                  aria-label="Abrir menú de navegación"
                >
                  <MenuIcon className="h-6 w-6" />
                </button>

                {/* Mode: dropdown (comportamiento original) */}
                {minimalMenuStyle === 'dropdown' && desktopMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-800 py-2 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-4 py-2 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
                      <span className="font-semibold text-sm text-gray-900 dark:text-white">Navegación</span>
                      <button
                        onClick={() => setDesktopMenuOpen(false)}
                        className="p-1 rounded-full hover:bg-[var(--header-hover)]"
                        aria-label="Cerrar menú"
                      >
                        <X className="h-4 w-4 text-gray-400" />
                      </button>
                    </div>
                    <nav className="py-1">
                      <NavList
                        items={navItems}
                        primaryColor={accentColor(settings, primaryColor)}
                        className="flex-col items-start gap-0 px-2"
                      />
                    </nav>
                  </div>
                )}
              </div>
            </div>
          </div>
          {barraAbajo && <div className="hidden md:flex justify-center pb-3" data-barra-abajo="">{barra('w-full max-w-3xl')}</div>}

          {/* Fila móvil: logo + botón hamburguesa */}
          <div className="flex md:hidden items-center justify-between" style={{ minHeight: Math.max(56, Math.round((settings?.logo_height || 48) * 0.85) + 16) }}>
            <HeaderLogo
              organization={organization}
              primaryColor={primaryColor}
              height={Math.max(36, Math.round((settings?.logo_height || 48) * 0.85))}
            />
            <MobileMenuButton onClick={() => setDrawerOpen(true)} />
          </div>
        </div>
      </div>

      {/* Panel lateral: 'drawer' en escritorio y el botón de la fila móvil (cualquier estilo). */}
      <Drawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        direction="right"
        modal
      >
        <DrawerContent className="right-0 left-auto top-0 bottom-0 h-full w-full max-w-[400px] rounded-none">
          <DrawerHeader>
            <DrawerTitle>Menú</DrawerTitle>
            <DrawerClose asChild>
              <button
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Cerrar menú"
              >
                <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </button>
            </DrawerClose>
          </DrawerHeader>
          {contenidoMenu(() => setDrawerOpen(false))}
        </DrawerContent>
      </Drawer>

      {/* Pantalla completa (minimal_menu_style='fullscreen') */}
      {fullscreenOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menú"
          className="fixed inset-0 z-[70] flex flex-col bg-white text-gray-900 animate-in fade-in duration-150 dark:bg-gray-950 dark:text-white"
        >
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-4">
            <HeaderLogo organization={organization} primaryColor={primaryColor} height={Math.max(36, Math.round((settings?.logo_height || 48) * 0.85))} />
            <button
              type="button"
              onClick={() => setFullscreenOpen(false)}
              className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Cerrar menú"
              autoFocus
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col text-lg">
            {contenidoMenu(() => setFullscreenOpen(false))}
          </div>
        </div>
      )}
    </header>
  );
}

/**
 * Contenido del menú (panel lateral y pantalla completa): navegación, Mi cuenta, moneda y sesión.
 */
function ContenidoMenuMinimal({
  items,
  primaryColor,
  settings,
  isLoggedIn,
  showHeaderAuth,
  onCerrar,
}: {
  items: NavItem[];
  primaryColor: string;
  settings: HeaderVariantProps['settings'];
  isLoggedIn: boolean;
  showHeaderAuth: boolean;
  onCerrar: () => void;
}) {
  return (
    <>
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {items.map((item) => (
          <DrawerNavItem key={item.name} item={item} primaryColor={primaryColor} onNavigate={onCerrar} />
        ))}

        {/* Mi Cuenta — solo si está logueado */}
        {isLoggedIn && showHeaderAuth && (
          <Link
            href="/mi-cuenta"
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium transition-colors"
            onClick={onCerrar}
          >
            <UserCircle className="h-5 w-5" style={{ color: primaryColor }} />
            Mi Cuenta
          </Link>
        )}
      </nav>

      <BloqueMonedaMovil primaryColor={primaryColor} settings={settings} className="p-4 border-t border-gray-200 dark:border-gray-800" />

      {/* Auth buttons */}
      {showHeaderAuth && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 space-y-2">
          {isLoggedIn ? (
            <button
              onClick={async () => {
                const { createClient } = await import('@/lib/supabase/client');
                const supabase = createClient();
                await supabase.auth.signOut();
                onCerrar();
                window.location.href = '/';
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20 font-medium transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          ) : (
            <>
              <Link
                href="/auth"
                className="block w-full text-center px-4 py-2.5 rounded-lg font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: primaryColor }}
                onClick={onCerrar}
              >
                Iniciar sesión
              </Link>
              <Link
                href="/auth?tab=register"
                className="block w-full text-center px-4 py-2.5 rounded-lg font-medium border transition-colors"
                style={{ borderColor: primaryColor, color: primaryColor }}
                onClick={onCerrar}
              >
                Registrarse
              </Link>
            </>
          )}
        </div>
      )}
    </>
  );
}

/**
 * Item de navegación del drawer — soporta accordion nativo para children.
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
  if (item.children && item.children.length > 0) {
    return (
      <details className="group">
        <summary className="flex items-center justify-between cursor-pointer px-3 py-2.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium transition-colors list-none">
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
          <ChevronDown className="h-4 w-4 text-gray-400 group-open:rotate-180 transition-transform" />
        </summary>
        <div className="pl-6 space-y-1 mt-1">
          <Link
            href={item.href}
            className="block px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            onClick={onNavigate}
          >
            Ver todo
          </Link>
          {item.children.map((child, j) => (
            <Link
              key={j}
              href={child.href}
              className="block px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
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
      className="block px-3 py-2.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium transition-colors"
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
