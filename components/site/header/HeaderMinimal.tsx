'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Menu as MenuIcon, X, LogOut, UserCircle, Globe, ChevronDown, Search } from 'lucide-react';
import {
  HeaderLogo,
  HeaderActions,
  HeaderCTA,
  HeaderTopbar,
  SearchBarInline,
  MobileMenuButton,
  NavList,
  buildNavItems,
  MobileCurrencyChips,
  useAuthState,
  getLucideIcon,
  type HeaderVariantProps,
  type NavItem,
  headerBgStyle,
  navBgStyle,
  navTextColor,
  accentColor,
} from '../header/HeaderShared';
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
 * - En móvil, el botón abre el drawer móvil (gestionado por SiteHeader).
 */
export default function HeaderMinimal({
  organization,
  primaryColor,
  navTree,
  settings,
  showCart,
  onCartClick,
  menuCategories,
}: HeaderVariantProps) {
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
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

  const openMenu = () => {
    if (minimalMenuStyle === 'drawer') {
      setDrawerOpen(true);
    } else {
      setDesktopMenuOpen(!desktopMenuOpen);
    }
  };

  return (
    <header className="sticky top-0 z-[9999] w-full">
      {/* Topbar opcional */}
      {settings?.show_topbar && <HeaderTopbar organization={organization} settings={settings} />}

      {/* Barra principal */}
      <div className="backdrop-blur-md shadow-sm border-b border-gray-200 dark:border-gray-800 bg-[var(--header-bg-light)] dark:bg-[var(--header-bg-dark)]" style={headerBgStyle(settings)}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="hidden md:flex items-center justify-between gap-4" style={{ minHeight: `${(settings?.logo_height || 48) + 16}px` }}>
            {/* Logo izquierda */}
            <HeaderLogo
              organization={organization}
              primaryColor={primaryColor}
              height={settings?.logo_height || 48}
            />

            {/* Search bar inline (si search_style === 'bar') */}
            {searchStyle === 'bar' && (
              <SearchBarInline
                primaryColor={primaryColor}
                organizationId={organizationId}
                className="flex-1 max-w-xl mx-auto"
                size="lg"
                icon={SearchIconComp}
              />
            )}

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
              />
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
                  className="p-2 rounded-lg text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
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
                        className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
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

          {/* Fila móvil: logo + botón hamburguesa */}
          <div className="flex md:hidden items-center justify-between" style={{ minHeight: Math.max(56, Math.round((settings?.logo_height || 48) * 0.85) + 16) }}>
            <HeaderLogo
              organization={organization}
              primaryColor={primaryColor}
              height={Math.max(36, Math.round((settings?.logo_height || 48) * 0.85))}
            />
            <MobileMenuButton onClick={() => {}} />
          </div>
        </div>
      </div>

      {/* Drawer lateral para desktop (minimal_menu_style='drawer') */}
      {minimalMenuStyle === 'drawer' && (
        <Drawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          direction="right"
          modal
        >
          <DrawerContent className="right-0 left-auto top-0 bottom-0 h-full w-full max-w-[400px] rounded-none">
            {/* Header del drawer */}
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

            {/* Navegación */}
            <nav className="flex-1 overflow-y-auto p-4 space-y-1">
              {allItems.map((item) => (
                <DrawerNavItem
                  key={item.name}
                  item={item}
                  primaryColor={primaryColor}
                  onNavigate={() => setDrawerOpen(false)}
                />
              ))}

              {/* Mi Cuenta — solo si está logueado */}
              {isLoggedIn && showHeaderAuth && (
                <Link
                  href="/mi-cuenta"
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium transition-colors"
                  onClick={() => setDrawerOpen(false)}
                >
                  <UserCircle className="h-5 w-5" style={{ color: primaryColor }} />
                  Mi Cuenta
                </Link>
              )}
            </nav>

            {/* Currency selector */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-2 mb-3 text-sm text-gray-500 dark:text-gray-400">
                <Globe className="h-4 w-4" />
                <span>Moneda</span>
              </div>
              <MobileCurrencyChips primaryColor={primaryColor} />
            </div>

            {/* Auth buttons */}
            {showHeaderAuth && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-800 space-y-2">
                {isLoggedIn ? (
                  <button
                    onClick={async () => {
                      const { createClient } = await import('@/lib/supabase/client');
                      const supabase = createClient();
                      await supabase.auth.signOut();
                      setDrawerOpen(false);
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
                      onClick={() => setDrawerOpen(false)}
                    >
                      Iniciar sesión
                    </Link>
                    <Link
                      href="/auth?tab=register"
                      className="block w-full text-center px-4 py-2.5 rounded-lg font-medium border transition-colors"
                      style={{
                        borderColor: primaryColor,
                        color: primaryColor,
                      }}
                      onClick={() => setDrawerOpen(false)}
                    >
                      Registrarse
                    </Link>
                  </>
                )}
              </div>
            )}
          </DrawerContent>
        </Drawer>
      )}
    </header>
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
