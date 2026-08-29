'use client';

import { Search } from 'lucide-react';
import {
  HeaderLogo,
  HeaderActions,
  HeaderCTA,
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
} from '../header/HeaderShared';
import { useExternalOverlayOffset } from '../header/useExternalOverlayOffset';

export default function HeaderSplit({
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
  const SearchIconComp = getLucideIcon(settings?.search_icon as string, Search);

  const midpoint = Math.ceil(navItems.length / 2);
  const leftNav = navItems.slice(0, midpoint);
  const rightNav = navItems.slice(midpoint);
  const overlayOffset = useExternalOverlayOffset();

  return (
    <header className="sticky top-0 z-[9999] w-full" style={overlayOffset ? { top: `${overlayOffset}px` } : undefined}>
      {settings?.show_topbar && <HeaderTopbar organization={organization} settings={settings} />}
      <div className="backdrop-blur-md shadow-sm border-b border-gray-200 dark:border-gray-800 bg-[var(--header-bg-light)] dark:bg-[var(--header-bg-dark)]" style={headerBgStyle(settings)}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="hidden md:flex items-center justify-between gap-4" style={{ minHeight: `${(settings?.logo_height || 48) + 16}px` }}>
            {/* Logo */}
            <HeaderLogo organization={organization} primaryColor={primaryColor} height={settings?.logo_height || 48} />

            {/* Nav izquierda */}
            {leftNav.length > 0 && (
              <NavList items={leftNav} primaryColor={accentColor(settings, primaryColor)} className="flex-shrink-0" />
            )}

            {/* Search bar central */}
            {showSearchBar && (
              <SearchBarInline
                primaryColor={primaryColor}
                organizationId={organizationId}
                className="flex-1 max-w-xl mx-auto"
                size="lg"
                icon={SearchIconComp}
              />
            )}

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
              />
              {ctaText && (
                <HeaderCTA text={ctaText} href={settings?.header_cta_url ?? undefined} primaryColor={primaryColor} settings={settings} />
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
