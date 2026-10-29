'use client';

import { FilaSedeMovil } from '../SelectorSedeEncabezado';
import { FilaLogoMovil } from './FilaLogoMovil';
import { useState } from 'react';
import { buscadorMovil, barraSuperiorMovil, categoriasEnBuscadorMovil } from '@/lib/website/opcionUnica';
import { BuscadorCromoCompacto } from '../BuscadorCromo';
import Link from 'next/link';
import { X, Search } from 'lucide-react';
import {
  HeaderLogo,
  HeaderActions,
  HeaderTopbar,
  HeaderCTAMovil,
  SearchBarInline,
  buildNavItems,
  BloqueMonedaMovil,
  MobileAuthSection,
  useAuthState,
  getLucideIcon,
  type HeaderVariantProps,
  type NavItem,
  type MenuCategory,
  CLASE_FONDO_ENCABEZADO,
  variablesEncabezado, posicionMovil, movilPlantilla, useTransparenteMovil, GlifoMenu,
  estiloBarraEncabezado,
  estiloPanelMenu,
  atributosMenuMovil,
  useTemaMenuMovil,
  marcaFondoEncabezado,
} from '../HeaderShared';

/**
 * MobileFullscreen
 * Header móvil con menú a pantalla completa.
 * - Logo a la izquierda + acciones a la derecha (menu button o X si está abierto)
 * - Al abrir: overlay fullscreen blanco/gray-900 con logo + X arriba,
 *   nav items en lista vertical grande (text-lg) y accordion para children.
 * - Auth links al final.
 */
export default function MobileFullscreen({
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
  const isLoggedIn = useAuthState();
  const temaMenu = useTemaMenuMovil(primaryColor);
  const mp = movilPlantilla(settings);
  const transparente = useTransparenteMovil(settings);
  const navItems = buildNavItems(navTree);
  const organizationId = organization.id;
  const searchStyle = buscadorMovil(settings as Record<string, unknown>);
  const SearchIconComp = getLucideIcon(settings?.search_icon as string, Search);

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
    <header className="md:hidden sticky top-0 z-40 w-full" style={{ ...variablesEncabezado(settings, temaMenu), ...posicionMovil(settings), ...mp.estilo, ...transparente }}>
      {barraSuperiorMovil(settings as Record<string, unknown>) && <HeaderTopbar organization={organization} settings={settings} forceVisible />}

      <div className={CLASE_FONDO_ENCABEZADO} style={estiloBarraEncabezado(settings, 'bottom')} {...marcaFondoEncabezado(settings)}>
        <div className="px-4">
          <FilaLogoMovil
            ajustes={settings}
            posicion={posicionLogo}
            minHeight={mp.altoFila}
            logo={<HeaderLogo organization={organization} primaryColor={primaryColor} height={mp.altoLogo} />}
            acciones={
              <>
                <HeaderActions
                  settings={settings}
                  onCartClick={onCartClick}
                  searchStyle={searchStyle}
                  organizationId={organizationId}
                  primaryColor={primaryColor}
                  organizationSubdomain={organization.subdomain || ''}
                  showSearchIcon={searchStyle === 'icon' && mp.verBuscar}
                  showCart={showCart && mp.verCarrito}
                  mostrarCuentaMovil={mp.verCuenta}
                  isMobile={true}
                />
                <HeaderCTAMovil settings={settings} primaryColor={primaryColor} />
              </>
            }
            menu={
              <button
                onClick={() => setOpen((v) => !v)}
                aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
                className={`p-2 rounded-lg text-[var(--hdr-mobile-icon)] hover:bg-[var(--header-hover)] transition-colors${mp.claseBorde}${mp.verMenu ? "" : " hidden"}`}
              >
                {open ? <X className="h-5 w-5" /> : <GlifoMenu glifo={mp.glifo} className="h-5 w-5" />}
              </button>
            }
          />

          {searchStyle === 'bar' && (
            <div className="px-4 pb-3">
              {categoriasEnBuscadorMovil(settings as Record<string, unknown>) && (menuCategories?.length ?? 0) > 0 ? (
                <BuscadorCromoCompacto primaryColor={primaryColor} categorias={menuCategories!} icon={SearchIconComp} className="w-full" />
              ) : (
                <SearchBarInline
                  primaryColor={primaryColor}
                  organizationId={organizationId}
                  className="w-full"
                  size="sm"
                  icon={SearchIconComp}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Overlay fullscreen */}
      {open && (
        <div className={`fixed inset-0 z-[70] ${CLASE_FONDO_ENCABEZADO} overflow-y-auto shadow-2xl`} style={estiloPanelMenu(settings, temaMenu)} {...marcaFondoEncabezado(settings)} {...atributosMenuMovil(settings, temaMenu)}>
          <div className="flex items-center justify-between px-4 border-b border-[color:var(--mm-divider)]" style={{ minHeight: mp.altoFila }}>
            <HeaderLogo organization={organization} primaryColor={primaryColor} height={Math.max(32, Math.round((settings?.logo_height || 48) * 0.7))} />
            <button
              onClick={() => setOpen(false)}
              aria-label="Cerrar menú"
              className="p-2 rounded-lg text-[var(--mm-title)] hover:bg-[var(--mm-hover-bg)] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="px-4 py-4">
            {allItems.map((item, i) => (
              <FullscreenNavItem
                key={i}
                item={item}
                primaryColor={primaryColor}
                onNavigate={() => setOpen(false)}
              />
            ))}

            <BloqueMonedaMovil primaryColor={primaryColor} settings={settings} className="px-4 py-4 border-t border-[color:var(--mm-divider)]" />

            <MobileAuthSection isLoggedIn={isLoggedIn} primaryColor={primaryColor} onNavigate={() => setOpen(false)} />
          </nav>
        </div>
      )}
      <FilaSedeMovil primaryColor={primaryColor} />
    </header>
  );
}

function FullscreenNavItem({
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
      <details className="group border-b border-[color:var(--mm-divider)]">
        <summary className="flex items-center justify-between cursor-pointer py-4 text-lg font-medium text-[var(--mm-title)] hover:text-[var(--mm-hover-fg)] list-none">
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
          <span className="text-[var(--mm-fg-muted)] group-open:rotate-180 transition-transform">▾</span>
        </summary>
        <div className="pl-6 pb-3">
          <Link
            href={item.href}
            className="block py-2 text-base text-[var(--mm-fg-muted)] hover:text-[var(--mm-hover-fg)]"
            onClick={onNavigate}
          >
            Ver todo
          </Link>
          {item.children.map((child, j) => (
            <Link
              key={j}
              href={child.href}
              className="block py-2 text-base text-[var(--mm-fg-muted)] hover:text-[var(--mm-hover-fg)]"
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
      className="flex items-center gap-2 py-4 text-lg font-medium text-[var(--mm-title)] border-b border-[color:var(--mm-divider)] hover:text-[var(--mm-hover-fg)]"
      onClick={onNavigate}
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
