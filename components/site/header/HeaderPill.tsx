'use client';

/**
 * Encabezado «Píldora» (`header_style: 'pill'`): logo a la izquierda, el menú dentro de una
 * píldora flotante centrada (el enlace de la página actual va relleno) y las acciones y el botón a
 * la derecha. Lo usan la plantilla de tienda «Panorama» y el «Café de especialidad» (Figma 2223:46106
 * lámina 11).
 *
 * Con `header_transparent_over_hero` va transparente y con texto claro sobre la portada, con el
 * mismo estado que el encabezado transparente (`useEstadoTransparente`, las reglas
 * `[data-encabezado-transparente]` de app/globals.css) y, al bajar, con el fondo del tema.
 * Sin la opción, siempre con fondo.
 *
 * Estilo de la píldora (`header_pill_style`):
 * - `vidrio` (sin la clave): la del café, medida en su web de referencia: píldora de vidrio que
 *   flota (blanco 10 %, desenfoque 24 px, borde blanco 20 %, letras blancas en versalitas sobre la
 *   foto); al bajar la barra sigue sin fondo y solo la píldora toma el fondo del tema al 85 %.
 * - `isla` / `solido`: isla clara del tema con sombra, también sobre la foto.
 * La clave aún no está en el contrato (OPCIONES_SHELL): llega con el editor. Hoy solo la org 374
 * publica `pill` (SQL 2026-11-07): queda en `vidrio`.
 *
 * Antes de existir, `pill` caía en HeaderClassic: ningún sitio publicado lo usa (SQL 2026-11-07,
 * PLANO H2), así que no cambia ningún sitio.
 */
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
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
  accentColor,
  variablesEncabezado,
  estiloDivisor,
} from './HeaderShared';
import { SelectorSedeEncabezado } from './SelectorSedeEncabezado';
import { barraSiCromo } from './BuscadorCromo';
import { useEstadoTransparente } from './HeaderTransparent';
import { headerSobreHero } from '@/lib/website/espacioHeader';
import { opcionesPlantillaTienda } from '@/lib/website/encabezadoPie';

/** ¿El enlace lleva a la página actual? La portada solo con la ruta exacta. */
export function enlaceActivo(hrefEnlace: string, ruta: string): boolean {
  const limpiar = (r: string) => (r.length > 1 ? r.replace(/\/+$/, '') : r);
  const destino = limpiar(hrefEnlace.split(/[?#]/)[0] || '/');
  const actual = limpiar(ruta || '/');
  if (destino === '/' || actual === '/') return destino === actual;
  return actual === destino || actual.startsWith(`${destino}/`);
}

export default function HeaderPill({
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
  const ctaText = settings?.header_cta_text ?? '';
  const sobrePortada = headerSobreHero(settings as Parameters<typeof headerSobreHero>[0]);
  const estado = useEstadoTransparente(sobrePortada);
  const ruta = usePathname() || '/';
  const guardado = (settings as Record<string, unknown> | null | undefined)?.header_pill_style;
  const estiloPildora = guardado === 'isla' || guardado === 'solido' ? 'isla' : 'vidrio';
  const conCirculo = opcionesPlantillaTienda(settings as Record<string, unknown> | null | undefined).formaBotonEncabezado === 'circle';

  // El enlace de la página actual va relleno dentro de la píldora (data-activo, app/globals.css).
  // NavList pinta y mide sus enlaces; aquí solo se marca el que corresponde.
  const pildoraRef = useRef<HTMLDivElement>(null);
  const claveMenu = navItems.map((i) => i.href).join('|');
  useEffect(() => {
    const pildora = pildoraRef.current;
    if (!pildora) return;
    const marcar = () => {
      for (const a of Array.from(pildora.querySelectorAll<HTMLAnchorElement>('nav > a[href]'))) {
        const destino = a.getAttribute('href') || '';
        a.toggleAttribute('data-activo', !/^[a-z]+:/i.test(destino) && enlaceActivo(destino, ruta));
      }
    };
    marcar();
    // «Más ▾» puede mover enlaces al medir: se vuelve a marcar cuando cambia la fila.
    const mo = new MutationObserver(marcar);
    mo.observe(pildora, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [ruta, claveMenu]);

  // Buscador en barra: junto a los íconos, como en «Logo centrado» (la píldora va en el centro).
  const SearchIconComp = getLucideIcon(settings?.search_icon as string, Search);
  const barra = barraSiCromo(settings, settings?.search_style === 'bar' ? (
    <SearchBarInline primaryColor={primaryColor} organizationId={organizationId} className="w-56" size="md" icon={SearchIconComp} />
  ) : null, { primaryColor, organizationId, categorias: menuCategories, className: 'w-56', enFila: true });

  return (
    <header
      className="sticky top-0 z-40 w-full"
      data-encabezado-pildora=""
      data-pildora-estilo={estiloPildora}
      data-encabezado-transparente={sobrePortada ? estado : undefined}
      style={variablesEncabezado(settings)}
    >
      {settings?.show_topbar && <HeaderTopbar organization={organization} settings={settings} />}
      <div className="backdrop-blur-md bg-[var(--header-bg-light)] dark:bg-[var(--header-bg-dark)]" style={{ ...headerBgStyle(settings), ...estiloDivisor(settings, 'bottom') }}>
        <div className="max-w-7xl mx-auto px-4 md:px-8 md:pt-2">
          {/* Aire arriba y abajo: la isla y el botón circular (76 px) no tocan el borde. */}
          <div className="hidden md:grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-2.5" style={{ minHeight: `${Math.max((settings?.logo_height || 48) + 24, conCirculo ? 96 : 0)}px` }}>
            <div className="flex min-w-0 items-center justify-start">
              <HeaderLogo organization={organization} primaryColor={primaryColor} height={settings?.logo_height || 48} fondoOscuro={estado === 'sobre'} />
            </div>
            <div ref={pildoraRef} className="flex min-w-0 justify-center" data-nav-pildora="">
              {navItems.length > 0 && (
                <NavList items={navItems} primaryColor={accentColor(settings, primaryColor)} className="rounded-full border px-1.5 py-1.5" />
              )}
            </div>
            <div className="flex min-w-0 items-center justify-end gap-3">
              {barra}
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
              {ctaText && <HeaderCTA text={ctaText} href={settings?.header_cta_url ?? undefined} primaryColor={primaryColor} settings={settings} />}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
