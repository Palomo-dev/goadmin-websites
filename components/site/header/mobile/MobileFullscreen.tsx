'use client';

import { FilaFavoritosMenu } from '@/components/site/favoritos/FilaFavoritosMenu';
import { opcionesCuenta } from '@/lib/website/v2/cabeceraTienda';
import { FilaSedeMovil } from '../SelectorSedeEncabezado';
import { FilaLogoMovil } from './FilaLogoMovil';
import { useRef, useState } from 'react';
import { CapaEncabezado, useAbrirMenuMovil } from '../CapaEncabezado';
import { buscadorMovilEfectivo, barraSuperiorMovil } from '@/lib/website/opcionUnica';
import { BuscadorMovilComoEscritorio, ajustesCromoMovil } from '../BuscadorCromo';
import Link from '@/components/site/Enlace'
import { X } from 'lucide-react';
import { iconoBuscar } from '../iconoBuscar';
import {
  HeaderLogo,
  HeaderActions,
  HeaderTopbar,
  HeaderCTAMovil,
  SearchBarInline,
  buildNavItems,
  BloqueMonedaMovil,
  useBloqueoScrollFondo,
  MobileAuthSection,
  useAuthState,
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
  atributosPildoraMovil,
  variablesPildoraMovil,
  CLASE_BOTON_MENU_PILDORA,
} from '../HeaderShared';
import { IconoGuardado } from '@/components/site/IconoGuardado';
import { itemCategoriasMenu, menuConCategorias } from '@/lib/website/botonCategorias';
import { SubmenuCategoria } from './SubmenuCategoria';
import { CuadriculaCategorias, FilaCategoriaMovil } from './CategoriasMovil';

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
  megaMenuItems,
  posicionLogo,
  pildoraMovil,
}: HeaderVariantProps) {
  const [open, setOpen] = useState(false);
  // Abierta, la página de atrás no se desplaza (un solo scroll: el de la pantalla del menú).
  useBloqueoScrollFondo(open);
  // «Menú» del menú inferior: abre la pantalla aunque el botón del encabezado esté oculto.
  useAbrirMenuMovil(() => setOpen(true));
  const botonMenuRef = useRef<HTMLButtonElement>(null);
  const isLoggedIn = useAuthState();
  const temaMenu = useTemaMenuMovil(primaryColor);
  const mp = movilPlantilla(settings);
  const transparente = useTransparenteMovil(settings);
  // Sobre la portada (header_transparent_over_hero): texto e íconos claros, como en escritorio.
  const sobrePortadaMovil = Object.keys(transparente).length > 0;
  const navItems = buildNavItems(navTree);
  const organizationId = organization.id;
  const searchStyle = buscadorMovilEfectivo(settings as Record<string, unknown>);
  const cromoMovil = ajustesCromoMovil(settings);
  const SearchIconComp = iconoBuscar(settings);

  // Ítem de categorías: la misma fuente que el botón «Todas las categorías» de computador
  // (mega menú con la composición mega; si no, el árbol de la tienda con show_categories_in_header),
  // cada categoría con su ícono y sus subcategorías (lib/website/botonCategorias.ts).
  const categoriesItem: NavItem | null = itemCategoriasMenu(settings as Record<string, unknown>, menuCategories, megaMenuItems);

  // Con el botón «Todas las categorías» encendido, las categorías van de primeras y con su texto.
  const allItems = menuConCategorias(navItems, categoriesItem, settings as Record<string, unknown>);

  const estiloHeader = { ...variablesEncabezado(settings, temaMenu), ...posicionMovil(settings), ...mp.estilo, ...transparente, ...variablesPildoraMovil(settings, pildoraMovil) };

  return (
    <header className="md:hidden sticky top-0 z-40 w-full" style={estiloHeader} data-movil-sobre-portada={sobrePortadaMovil ? '' : undefined} {...atributosPildoraMovil(settings, pildoraMovil)}>
      {barraSuperiorMovil(settings as Record<string, unknown>) && <HeaderTopbar organization={organization} settings={settings} forceVisible />}

      <div className={CLASE_FONDO_ENCABEZADO} style={estiloBarraEncabezado(settings, 'bottom')} {...marcaFondoEncabezado(settings)}>
        <div className="px-4">
          <FilaLogoMovil
            ajustes={settings}
            posicion={posicionLogo}
            minHeight={mp.altoFila}
            logo={<HeaderLogo organization={organization} primaryColor={primaryColor} height={mp.altoLogo} fondoOscuro={sobrePortadaMovil} />}
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
                  mostrarCuentaMovil={pildoraMovil ? false : mp.verCuenta}
                  isMobile={true}
                />
                {pildoraMovil && (
                  <button ref={botonMenuRef} type="button" onClick={() => setOpen((v) => !v)} aria-label={open ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={open} data-pildora-menu="" className={CLASE_BOTON_MENU_PILDORA}>
                    {open ? 'Cerrar' : 'Menú'}
                  </button>
                )}
                <HeaderCTAMovil settings={settings} primaryColor={primaryColor} pildora={pildoraMovil} />
              </>
            }
            menu={pildoraMovil ? undefined : (
              <button
                ref={botonMenuRef}
                onClick={() => setOpen((v) => !v)}
                aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
                className={`p-2 rounded-lg text-[var(--hdr-mobile-icon)] hover:bg-[var(--header-hover)] transition-colors${mp.claseBorde}${mp.verMenu ? "" : " hidden"}`}
              >
                {open ? <X className="h-5 w-5" /> : <GlifoMenu glifo={mp.glifo} className="h-5 w-5" />}
              </button>
            )}
          />

          {searchStyle === 'bar' && (
            <div className="px-4 pb-3">
              {cromoMovil ? (
                <BuscadorMovilComoEscritorio settings={cromoMovil} primaryColor={primaryColor} categorias={menuCategories} icon={SearchIconComp} className="w-full" />
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

      {/* Overlay fullscreen. En CapaEncabezado (portal fuera del <header>): con «Al bajar» el
          envoltorio del encabezado lleva transform y un `fixed` dentro quedaba recortado. */}
      <CapaEncabezado abierta={open} alCerrar={() => setOpen(false)} variables={estiloHeader} retorno={botonMenuRef}>
      {open && (
        <div className={`fixed inset-0 h-[100dvh] z-[70] ${CLASE_FONDO_ENCABEZADO} pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] overflow-y-auto overscroll-contain shadow-2xl`} data-scroll-menu="" role="dialog" aria-modal="true" aria-label="Menú" style={estiloPanelMenu(settings, temaMenu)} {...marcaFondoEncabezado(settings)} {...atributosMenuMovil(settings, temaMenu)}>
          <div className="flex items-center justify-between px-4 border-b border-[color:var(--mm-divider)]" style={{ minHeight: mp.altoFila }}>
            <HeaderLogo organization={organization} primaryColor={primaryColor} height={Math.max(32, Math.round((settings?.logo_height || 48) * 0.7))} />
            <button
              onClick={() => setOpen(false)}
              aria-label="Cerrar menú"
              className="p-2 rounded-lg text-[var(--mm-title)] hover:bg-[var(--mm-hover-bg)] transition-colors"
              data-foco-inicial=""
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

            {/* Favoritos (Figma 2832:68496): en el celular va en el menú, no en la barra de arriba. */}
            <FilaFavoritosMenu settings={settings} visible={showCart} className="flex w-full items-center gap-2 px-3 py-2.5 rounded-lg text-left text-[var(--mm-fg)] hover:bg-[var(--mm-hover-bg)] hover:text-[var(--mm-hover-fg)] font-medium transition-colors" onNavigate={() => setOpen(false)} />

            <BloqueMonedaMovil primaryColor={primaryColor} settings={settings} className="px-4 py-4 border-t border-[color:var(--mm-divider)]" />

            <MobileAuthSection isLoggedIn={isLoggedIn} primaryColor={primaryColor} onNavigate={() => setOpen(false)} modoCuenta={opcionesCuenta(settings as Record<string, unknown> | null).modo} />
          </nav>
        </div>
      )}
      </CapaEncabezado>
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
            {item.icon && <IconoGuardado icono={item.icon} nombre={item.name} className="h-5 w-5 flex-shrink-0" />}
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
          {item.estiloCategorias === 'tarjetas' ? (
            // «Tarjetas con imagen»: cuadrícula de 2 columnas; la de hijas abre el segundo nivel aquí.
            <div className="pt-2">
              <CuadriculaCategorias items={item.children} primaryColor={primaryColor} onNavigate={onNavigate} />
            </div>
          ) : item.children.map((child, j) => child.avatar ? (
            <FilaCategoriaMovil key={j} item={child} onNavigate={onNavigate} />
          ) : child.children && child.children.length > 0 ? (
            <SubmenuCategoria key={j} item={child} claseEnlace="block py-2 text-base text-[var(--mm-fg-muted)] hover:text-[var(--mm-hover-fg)]" onNavigate={onNavigate} />
          ) : (
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
      {item.icon && <IconoGuardado icono={item.icon} nombre={item.name} className="h-5 w-5 flex-shrink-0" />}
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
