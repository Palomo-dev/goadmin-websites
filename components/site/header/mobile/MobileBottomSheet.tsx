'use client';

import { SelectorSedeHoja } from '../SelectorSedeEncabezado';
import { useEncabezadoPie } from '../../EncabezadoPieContext';
import { useTemaColores } from '../../TemaColoresContext';
import { useState } from 'react';
import Link from 'next/link';
import { Menu as MenuIcon, ChevronDown, Search } from 'lucide-react';
import { Drawer } from 'vaul';
import { FilaLogoMovil } from './FilaLogoMovil';
import {
  HeaderLogo,
  HeaderActions,
  HeaderTopbar,
  HeaderCTAMovil,
  SearchBarInline,
  buildNavItems,
  BloqueMonedaMovil,
  getLucideIcon,
  type HeaderVariantProps,
  type NavItem,
  CLASE_FONDO_ENCABEZADO,
  variablesEncabezado,
  estiloBarraEncabezado,
  estiloPanelMenu,
  atributosMenuMovil,
  useTemaMenuMovil,
  marcaFondoEncabezado,
  ESTILO_BOTON_ENTRAR,
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
  branchId,
  posicionLogo,
}: HeaderVariantProps) {
  const [open, setOpen] = useState(false);
  // La hoja se monta dentro del propio <header> (portal) y no en la fila de botones: así queda
  // fija abajo, hereda el tema V2 (reglas `[data-tema-colores] header …` de app/globals.css) y el
  // modo oscuro de la raíz del layout. Sin el portal, vaul la pintaba en línea dentro de la fila
  // del encabezado: encabezado altísimo y la hoja recortada a la derecha.
  const [headerEl, setHeaderEl] = useState<HTMLElement | null>(null);
  const temaMenu = useTemaMenuMovil(primaryColor);
  const { opciones: opcionesShell } = useEncabezadoPie();
  const temaColores = useTemaColores();
  const navItems = buildNavItems(navTree);
  const organizationId = organization.id;
  const searchStyle = settings?.mobile_search_style ?? 'icon';
  const SearchIconComp = getLucideIcon(settings?.search_icon as string, Search);

  return (
    // Abierta, el encabezado sube por encima de las barras fijas del celular (z-40, más abajo en el
    // DOM) para que no tapen el pie de la hoja. Cerrada, z-40 como siempre.
    <header ref={setHeaderEl} className={`md:hidden sticky top-0 ${open ? 'z-[60]' : 'z-40'} w-full`} style={variablesEncabezado(settings, temaMenu)}>
      {settings?.mobile_show_topbar && <HeaderTopbar organization={organization} settings={settings} forceVisible />}

      <div className={CLASE_FONDO_ENCABEZADO} style={estiloBarraEncabezado(settings, 'bottom')} {...marcaFondoEncabezado(settings)}>
        <div className="px-4">
          <Drawer.Root open={open} onOpenChange={setOpen} direction="bottom">
          <FilaLogoMovil
            ajustes={settings}
            posicion={posicionLogo}
            minHeight={Math.max(56, Math.round((settings?.logo_height || 48) * 0.85) + 16)}
            logo={<HeaderLogo organization={organization} primaryColor={primaryColor} height={Math.max(36, Math.round((settings?.logo_height || 48) * 0.85))} />}
            acciones={
              <>
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
                <HeaderCTAMovil settings={settings} primaryColor={primaryColor} />
              </>
            }
            menu={
              <Drawer.Trigger asChild>
                <button
                  aria-label="Abrir menú"
                  className="p-2 rounded-lg text-[var(--hdr-mobile-icon)] hover:bg-[var(--header-hover)] transition-colors"
                >
                  <MenuIcon className="h-5 w-5" />
                </button>
              </Drawer.Trigger>
            }
          />
                <Drawer.Portal container={headerEl}>
                <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/50" data-hoja-menu-fondo="" />
                <Drawer.Content
                  className="fixed inset-x-0 bottom-0 z-[60] flex flex-col bg-[var(--header-bg-light)] dark:bg-[var(--header-bg-dark)] rounded-t-2xl max-h-[80vh] outline-none"
                  style={estiloPanelMenu(settings, temaMenu)}
                  {...marcaFondoEncabezado(settings)}
                  {...atributosMenuMovil(settings, temaMenu)}
                  aria-describedby={undefined}
                  data-hoja-menu=""
                >
                  <div className="mx-auto w-12 h-1.5 shrink-0 rounded-full bg-gray-300 dark:bg-gray-700 mt-3 mb-2" />
                  <div className="min-h-0 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] overflow-y-auto">
                    <Drawer.Title className="text-sm font-semibold text-[var(--mm-title)] uppercase tracking-wide mb-3">
                      Menú
                    </Drawer.Title>
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

                    {/* Selector de sede dentro de la hoja (header_show_branch_selector): sin fila aparte. */}
                    <SelectorSedeHoja primaryColor={primaryColor} />

                    <BloqueMonedaMovil primaryColor={primaryColor} className="mt-4 pt-4 border-t border-[color:var(--mm-divider)]" />

                    {/* V2 con tema y sin cuenta en el encabezado (Carta QR): sin «Mi Cuenta». Legacy: como siempre. */}
                    {!(temaColores && settings?.show_header_auth === false) && (
                    <div className="mt-4 pt-4 border-t border-[color:var(--mm-divider)]">
                      <Link
                        href="/auth"
                        className="block w-full text-center py-2.5 rounded-lg text-sm font-medium"
                        style={ESTILO_BOTON_ENTRAR}
                        onClick={() => setOpen(false)}
                      >
                        Mi Cuenta
                      </Link>
                    </div>
                    )}
                  </div>
                </Drawer.Content>
                </Drawer.Portal>
          </Drawer.Root>

          {searchStyle === 'bar' && (
            <div className="pb-3">
              <SearchBarInline
                primaryColor={primaryColor}
                organizationId={organizationId}
                className="w-full"
                size="sm"
                icon={SearchIconComp}
                placeholder={opcionesShell.fuenteMenu === 'categorias_carta' ? 'Buscar en la carta' : undefined}
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
      <div className="rounded-lg border border-[color:var(--mm-divider)] overflow-hidden">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center justify-between w-full px-3 py-3 text-sm font-medium text-[var(--mm-fg)] bg-[var(--header-hover)]"
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
            className={`h-4 w-4 text-[var(--mm-fg-muted)] transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
        {expanded && (
          <div className="px-3 py-2 space-y-1">
            <Link
              href={item.href}
              className="block py-1.5 text-xs text-[var(--mm-fg-muted)] hover:text-[var(--mm-hover-fg)]"
              onClick={onNavigate}
            >
              Ver todo
            </Link>
            {item.children.map((child, j) => (
              <Link
                key={j}
                href={child.href}
                className="block py-1.5 text-xs text-[var(--mm-fg-muted)] hover:text-[var(--mm-hover-fg)]"
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
      className="flex items-center gap-2 px-3 py-3 rounded-lg text-sm font-medium text-[var(--mm-fg)] bg-[var(--header-hover)] hover:bg-[var(--mm-hover-bg)] hover:text-[var(--mm-hover-fg)]"
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
