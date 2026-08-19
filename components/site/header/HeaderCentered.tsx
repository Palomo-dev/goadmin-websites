'use client';

import {
  HeaderLogo,
  HeaderActions,
  HeaderCTA,
  HeaderTopbar,
  NavList,
  SearchBarInline,
  buildNavItems,
  type HeaderVariantProps,
  headerBgStyle,
} from '../header/HeaderShared';

export default function HeaderCentered({
  organization,
  primaryColor,
  navTree,
  settings,
  showCart,
  onCartClick,
}: HeaderVariantProps) {
  const navItems = buildNavItems(navTree);
  const organizationId = organization.id;
  const showSearchBar = settings?.search_style === 'bar';
  const ctaText = settings?.header_cta_text ?? '';

  return (
    <header className="sticky top-0 z-40 w-full">
      {settings?.show_topbar && <HeaderTopbar organization={organization} settings={settings} />}

      {/* Fila superior: espacio | logo | acciones */}
      <div className="backdrop-blur-md shadow-sm border-b border-gray-200 dark:border-gray-800 dark:bg-[var(--header-bg-dark)]" style={headerBgStyle(settings)}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="hidden md:flex items-center justify-between" style={{ minHeight: `${(settings?.logo_height || 48) + 24}px` }}>
            <div className="flex-1" />
            <div className="flex-shrink-0">
              <HeaderLogo organization={organization} primaryColor={primaryColor} height={settings?.logo_height || 48} />
            </div>
            <div className="flex-1 flex items-center justify-end gap-3">
              {showSearchBar && (
                <SearchBarInline
                  primaryColor={primaryColor}
                  organizationId={organizationId}
                  className="w-64"
                  size="md"
                />
              )}
              <HeaderActions
                settings={settings}
                showCart={showCart}
                onCartClick={onCartClick}
                searchStyle={settings?.search_style}
                organizationId={organizationId}
                primaryColor={primaryColor}
              />
              {ctaText && (
                <HeaderCTA text={ctaText} href={settings?.header_cta_url ?? undefined} primaryColor={primaryColor} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fila inferior: nav centrado | search bar */}
      <div className="backdrop-blur-md border-t border-gray-100 dark:border-gray-800 dark:bg-[var(--header-bg-dark)]" style={headerBgStyle(settings)}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="hidden md:flex items-center justify-center gap-6 h-12">
            {navItems.length > 0 && (
              <NavList items={navItems} primaryColor={primaryColor} />
            )}
            {showSearchBar && (
              <SearchBarInline
                primaryColor={primaryColor}
                organizationId={organizationId}
                className="w-56"
                size="sm"
              />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
