'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Menu as MenuIcon, X } from 'lucide-react';
import {
  HeaderLogo,
  HeaderActions,
  HeaderCTA,
  HeaderTopbar,
  SearchBarInline,
  MobileMenuButton,
  NavList,
  buildNavItems,
  type HeaderVariantProps,
  headerBgStyle,
  navBgStyle,
  navTextColor,
  accentColor,
} from '../header/HeaderShared';

/**
 * HeaderMinimal
 *
 * Variante minimalista del header:
 * - Logo + botón menú hamburguesa (desktop y móvil), sin navegación inline.
 * - En desktop, el botón abre un dropdown con la navegación.
 * - En móvil, el botón abre el drawer móvil (gestionado por SiteHeader).
 *
 * Estructura:
 *   [HeaderTopbar (opcional)]
 *   [logo izq] [SearchBarInline (si search_style='bar')] [acciones der] [botón menú]
 */
export default function HeaderMinimal({
  organization,
  primaryColor,
  navTree,
  settings,
  showCart,
  onCartClick,
}: HeaderVariantProps) {
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const organizationId = organization.id;
  const searchStyle = settings?.search_style;
  const ctaText = settings?.header_cta_text ?? '';
  const ctaHref = settings?.header_cta_url ?? undefined;
  const navItems = buildNavItems(navTree);

  // Cerrar el menú desktop al hacer clic fuera
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

  return (
    <header className="sticky top-0 z-40 w-full">
      {/* Topbar opcional */}
      {settings?.show_topbar && <HeaderTopbar organization={organization} settings={settings} />}

      {/* Barra principal */}
      <div className="backdrop-blur-md shadow-sm border-b border-gray-200 dark:border-gray-800 dark:bg-[var(--header-bg-dark)]" style={headerBgStyle(settings)}>
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
              />
            )}

            {/* Acciones derecha: search icon, cart, auth, CTA + botón menú */}
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
              />
              <HeaderCTA
                text={ctaText}
                href={ctaHref}
                primaryColor={primaryColor}
              />
              {/* Botón menú hamburguesa desktop */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setDesktopMenuOpen(!desktopMenuOpen)}
                  className="p-2 rounded-lg text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  aria-label="Abrir menú de navegación"
                >
                  <MenuIcon className="h-6 w-6" />
                </button>
                {desktopMenuOpen && (
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
    </header>
  );
}
