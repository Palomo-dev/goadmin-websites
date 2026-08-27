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
  navBgStyle,
  navTextColor,
  accentColor,
} from '../header/HeaderShared';

export default function HeaderClassic({
  organization,
  primaryColor,
  navTree,
  settings,
  showCart,
  onCartClick,
}: HeaderVariantProps) {
  const navItems = buildNavItems(navTree);
  const organizationId = organization.id;
  const logoPosition = settings?.logo_position ?? 'left';
  const showSearchBar = settings?.search_style === 'bar';
  const ctaText = settings?.header_cta_text ?? '';

  const renderNav = navItems.length > 0 ? (
    <NavList items={navItems} primaryColor={accentColor(settings, primaryColor)} className="flex-1 justify-center" />
  ) : null;

  const renderSearchBar = showSearchBar ? (
    <SearchBarInline
      primaryColor={primaryColor}
      organizationId={organizationId}
      className="flex-1 max-w-xl mx-4"
      size="lg"
    />
  ) : null;

  const renderActions = (
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
      {ctaText && <HeaderCTA text={ctaText} href={settings?.header_cta_url ?? undefined} primaryColor={primaryColor} settings={settings} />}
    </div>
  );

  const renderLogo = (
    <HeaderLogo organization={organization} primaryColor={primaryColor} height={settings?.logo_height || 48} />
  );

  let middle: React.ReactNode;
  if (logoPosition === 'right') {
    middle = (
      <>
        {renderNav}
        {renderSearchBar}
        {renderActions}
        {renderLogo}
      </>
    );
  } else if (logoPosition === 'center') {
    middle = (
      <>
        <NavList items={navItems.slice(0, Math.ceil(navItems.length / 2))} primaryColor={accentColor(settings, primaryColor)} className="flex-1 justify-end" />
        {renderLogo}
        <NavList items={navItems.slice(Math.ceil(navItems.length / 2))} primaryColor={accentColor(settings, primaryColor)} className="flex-1 justify-start" />
        {renderSearchBar}
        {renderActions}
      </>
    );
  } else {
    middle = (
      <>
        {renderLogo}
        {renderNav}
        {renderSearchBar}
        {renderActions}
      </>
    );
  }

  return (
    <header className="sticky top-0 z-40 w-full">
      {settings?.show_topbar && <HeaderTopbar organization={organization} settings={settings} />}
      <div className="backdrop-blur-md shadow-sm border-b border-gray-200 dark:border-gray-800 bg-[var(--header-bg-light)] dark:bg-[var(--header-bg-dark)]" style={headerBgStyle(settings)}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="hidden md:flex items-center justify-between gap-4" style={{ minHeight: `${(settings?.logo_height || 48) + 16}px` }}>
            {middle}
          </div>
        </div>
      </div>
    </header>
  );
}
