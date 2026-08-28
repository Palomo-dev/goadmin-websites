'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu as MenuIcon, ChevronDown, Globe, Search } from 'lucide-react';
import { Drawer } from 'vaul';
import {
  HeaderLogo,
  HeaderActions,
  HeaderTopbar,
  SearchBarInline,
  buildNavItems,
  MobileCurrencyChips,
  getLucideIcon,
  type HeaderVariantProps,
  type NavItem,
} from '../HeaderShared';

/**
 * MobileBottomSheet
 * Header móvil con hoja inferior (bottom sheet) que sube desde abajo usando vaul.
 * - Logo a la izquierda + acciones + menu button
 * - Al click, abre bottom sheet con grid de 2 columnas de nav items
 * - Items con children son expandibles
 */
export default function MobileBottomSheet({
  organization,
  primaryColor,
  navTree,
  settings,
  showCart,
  onCartClick,
}: HeaderVariantProps) {
  const [open, setOpen] = useState(false);
  const navItems = buildNavItems(navTree);
  const organizationId = organization.id;
  const searchStyle = settings?.mobile_search_style ?? 'icon';
  const SearchIconComp = getLucideIcon(settings?.search_icon as string, Search);

  return (
    <header className="md:hidden sticky top-0 z-40 w-full">
      {settings?.mobile_show_topbar && <HeaderTopbar organization={organization} settings={settings} forceVisible />}

      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="px-4">
          <div className="flex items-center justify-between gap-2" style={{ minHeight: Math.max(56, Math.round((settings?.logo_height || 48) * 0.85) + 16) }}>
            <HeaderLogo organization={organization} primaryColor={primaryColor} height={Math.max(36, Math.round((settings?.logo_height || 48) * 0.85))} />
            <div className="flex items-center gap-2 flex-shrink-0">
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
              <Drawer.Root open={open} onOpenChange={setOpen} direction="bottom">
                <Drawer.Trigger asChild>
                  <button
                    aria-label="Abrir menú"
                    className="p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <MenuIcon className="h-5 w-5" />
                  </button>
                </Drawer.Trigger>
                <Drawer.Content className="bg-white dark:bg-gray-900 rounded-t-2xl max-h-[80vh] outline-none">
                  <div className="mx-auto w-12 h-1.5 rounded-full bg-gray-300 dark:bg-gray-700 mt-3 mb-2" />
                  <div className="px-4 pb-6 overflow-y-auto">
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                      Menú
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {navItems.map((item, i) => (
                        <BottomSheetItem
                          key={i}
                          item={item}
                          primaryColor={primaryColor}
                          onNavigate={() => setOpen(false)}
                        />
                      ))}
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                      <div className="flex items-center gap-2 mb-3 text-sm text-gray-500 dark:text-gray-400">
                        <Globe className="h-4 w-4" />
                        <span>Moneda</span>
                      </div>
                      <MobileCurrencyChips primaryColor={primaryColor} />
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                      <Link
                        href="/auth"
                        className="block w-full text-center py-2.5 rounded-lg text-sm font-medium text-white"
                        style={{ backgroundColor: primaryColor }}
                        onClick={() => setOpen(false)}
                      >
                        Mi Cuenta
                      </Link>
                    </div>
                  </div>
                </Drawer.Content>
              </Drawer.Root>
            </div>
          </div>

          {searchStyle === 'bar' && (
            <div className="pb-3">
              <SearchBarInline
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
    </header>
  );
}

function BottomSheetItem({
  item,
  primaryColor,
  onNavigate,
}: {
  item: NavItem;
  primaryColor: string;
  onNavigate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (item.children && item.children.length > 0) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center justify-between w-full px-3 py-3 text-sm font-medium text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-800/50"
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
          <ChevronDown
            className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
        {expanded && (
          <div className="px-3 py-2 space-y-1">
            <Link
              href={item.href}
              className="block py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              onClick={onNavigate}
            >
              Ver todo
            </Link>
            {item.children.map((child, j) => (
              <Link
                key={j}
                href={child.href}
                className="block py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                onClick={onNavigate}
              >
                {child.name}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className="flex items-center gap-2 px-3 py-3 rounded-lg text-sm font-medium text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800"
    >
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
    </Link>
  );
}
