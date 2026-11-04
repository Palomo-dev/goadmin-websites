'use client';

import { useRef } from 'react';

import { Search } from 'lucide-react';
import {
  HeaderLogo,
  HeaderActions,
  HeaderCTA,
  HeaderCTA2,
  HeaderTopbar,
  NavList,
  SearchBarInline,
  buildNavItems,
  getLucideIcon,
  type HeaderVariantProps,
  headerBgStyle,
  navBgStyle,
  navTextColor,
  accentColor,
  variablesEncabezado,
  estiloDivisor,
} from '../header/HeaderShared';
import { SelectorSedeEncabezado } from './SelectorSedeEncabezado';
import { barraSiCromo } from './BuscadorCromo';
import { useBarraAbajo } from './barraEnFila';

export default function HeaderSplit({
  organization,
  primaryColor,
  navTree,
  settings,
  menuCategories,
  showCart,
  onCartClick,
  branchId,
}: HeaderVariantProps) {
  const navItems = buildNavItems(navTree);
  const organizationId = organization.id;
  const showSearchBar = settings?.search_style === 'bar';
  const ctaText = settings?.header_cta_text ?? '';
  const SearchIconComp = getLucideIcon(settings?.search_icon as string, Search);

  const midpoint = Math.ceil(navItems.length / 2);
  const leftNav = navItems.slice(0, midpoint);
  const rightNav = navItems.slice(midpoint);

  // Barra del buscador en la fila; si no cabe (menos de 240px, el menú recortaría o la fila
  // desborda), baja a una segunda fila de ancho completo (useBarraAbajo).
  const barra = (clase: string, enFila = true) => barraSiCromo(settings, showSearchBar ? (
              <SearchBarInline
                primaryColor={primaryColor}
                organizationId={organizationId}
                className={clase}
                size="lg"
                icon={SearchIconComp}
              />
              ) : null, { primaryColor, organizationId, categorias: menuCategories, className: clase, enFila });
  const hayBarra = barra('') != null;
  const filaRef = useRef<HTMLDivElement>(null);
  const barraAbajo = useBarraAbajo(filaRef, hayBarra);

  return (
    <header className="sticky top-0 z-40 w-full" style={variablesEncabezado(settings)}>
      {settings?.show_topbar && <HeaderTopbar organization={organization} settings={settings} />}
      <div className="backdrop-blur-md shadow-sm bg-[var(--header-bg-light)] dark:bg-[var(--header-bg-dark)]" style={{ ...headerBgStyle(settings), ...estiloDivisor(settings, 'bottom') }}>
        <div className="max-w-7xl mx-auto px-4">
          <div ref={filaRef} className="hidden md:flex items-center justify-between gap-4" style={{ minHeight: `${(settings?.logo_height || 48) + 16}px` }}>
            {/* Logo */}
            <HeaderLogo organization={organization} primaryColor={primaryColor} height={settings?.logo_height || 48} />

            {/* Nav izquierda */}
            {leftNav.length > 0 && (
              <NavList items={leftNav} primaryColor={accentColor(settings, primaryColor)} className="flex-shrink-0" />
            )}

            {/* Search bar central */}
            {!barraAbajo && barra('flex-1 max-w-xl mx-auto min-w-[240px]')}

            {/* Nav derecha */}
            {rightNav.length > 0 && (
              <NavList items={rightNav} primaryColor={accentColor(settings, primaryColor)} className="flex-shrink-0" />
            )}

            {/* Acciones + CTA */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <HeaderActions
                settings={settings}
                showCart={showCart}
                onCartClick={onCartClick}
                searchStyle={settings?.search_style}
                organizationId={organizationId}
                primaryColor={primaryColor}
                organizationSubdomain={organization.subdomain || ''}
                branchId={branchId}
              />
              <SelectorSedeEncabezado primaryColor={primaryColor} />
              <HeaderCTA2 settings={settings} />
              {ctaText && (
                <HeaderCTA text={ctaText} href={settings?.header_cta_url ?? undefined} primaryColor={primaryColor} settings={settings} />
              )}
            </div>
          </div>
          {barraAbajo && <div className="hidden md:flex justify-center pb-3" data-barra-abajo="">{barra('w-full max-w-3xl', false)}</div>}
        </div>
      </div>
    </header>
  );
}
