'use client';

import { useState } from 'react';
import {
  HeaderLogo,
  HeaderActions,
  HeaderCTA,
  HeaderTopbar,
  SearchBarInline,
  MobileMenuButton,
  type HeaderVariantProps,
  headerBgStyle,
} from '../header/HeaderShared';

/**
 * HeaderMinimal
 *
 * Variante minimalista del header de escritorio:
 * - Solo logo + icono menú hamburguesa, sin navegación inline.
 * - La navegación se muestra en el drawer móvil (Fase posterior).
 * - Hidden en móvil (md:flex); en móvil se usa el drawer.
 *
 * Estructura:
 *   [HeaderTopbar (opcional)]
 *   [logo izq] [SearchBarInline (si search_style='bar')] [acciones der] [MobileMenuButton]
 */
export default function HeaderMinimal({
  organization,
  primaryColor,
  settings,
  showCart,
  onCartClick,
}: HeaderVariantProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const organizationId = organization.id;
  const searchStyle = settings?.search_style;
  const ctaText = settings?.header_cta_text ?? '';
  const ctaHref = settings?.header_cta_url ?? undefined;

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

            {/* Acciones derecha: search icon, cart, auth, CTA */}
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
            </div>
          </div>

          {/* Fila móvil: logo + botón hamburguesa */}
          <div className="flex md:hidden items-center justify-between" style={{ minHeight: Math.max(56, Math.round((settings?.logo_height || 48) * 0.85) + 16) }}>
            <HeaderLogo
              organization={organization}
              primaryColor={primaryColor}
              height={Math.max(36, Math.round((settings?.logo_height || 48) * 0.85))}
            />
            <MobileMenuButton onClick={() => setMobileOpen(true)} />
          </div>
        </div>
      </div>

      {/* El drawer móvil se implementa en una Fase posterior */}
      {mobileOpen && null}
    </header>
  );
}
