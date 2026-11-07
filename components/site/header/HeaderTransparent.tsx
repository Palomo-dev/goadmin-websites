'use client';

/**
 * Encabezado transparente sobre la portada (`header_style: 'transparent'`, aprobado en Figma
 * «16 Sitio web» 2028:38223). Es el clásico (misma composición, menú, acciones y botones) con
 * dos estados:
 *
 * - `sobre`: fondo transparente, texto claro y sin borde, mientras la página está arriba Y la
 *   primera sección se solapa con el encabezado (las portadas con «Solapar con el encabezado»
 *   usan `--header-h`, que mide OrganizationLayoutCliente).
 * - `solido`: el fondo del tema con sombra, en cuanto se hace scroll, o siempre si la página no
 *   empieza con una portada solapada (así un texto oscuro nunca queda bajo letras blancas).
 *
 * Los estilos de cada estado están en app/globals.css (`[data-encabezado-transparente]`).
 * Antes de existir, 'transparent' caía al clásico: ningún sitio lo usa hoy (verificado por MCP
 * el 2026-10-06), así que no cambia ningún sitio publicado.
 */
import { useEffect, useState } from 'react';
import HeaderClassic from './HeaderClassic';
import type { HeaderVariantProps } from './HeaderShared';

/** Etiquetas que no pintan nada: no cuentan como «primera sección». */
const SIN_CAJA = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'LINK', 'META', 'NOSCRIPT']);

/**
 * Caja del primer elemento visible bajo `raiz`. La portada puede venir envuelta (SectionWrapper,
 * ZonaGlobalPreview…), así que se baja unos niveles; y antes de ella puede haber hermanos sin
 * caja: el <script> de datos estructurados que la página del café pone como primer hijo de
 * <main> dejaba el encabezado «sólido» para siempre (org 374, 2026-11-07).
 */
function primeraCajaVisible(raiz: Element, nivel = 0): DOMRect | null {
  for (const hijo of Array.from(raiz.children)) {
    if (SIN_CAJA.has(hijo.tagName)) continue;
    const caja = hijo.getBoundingClientRect();
    if (caja.height > 0) return caja;
    if (nivel < 3) {
      const dentro = primeraCajaVisible(hijo, nivel + 1);
      if (dentro) return dentro;
    }
  }
  return null;
}

/** ¿La primera sección de <main> sube por debajo del encabezado? */
function portadaSolapada(header: HTMLElement | null): boolean {
  const main = document.querySelector('main');
  if (!main || !header) return false;
  const fondoHeader = header.getBoundingClientRect().bottom;
  const caja = primeraCajaVisible(main);
  return caja ? caja.top < fondoHeader - 2 : false;
}

/**
 * Estado del encabezado transparente: `sobre` mientras la página está arriba y la portada se
 * solapa; `solido` en cuanto se baja o si no hay portada. Lo comparte HeaderPill (el café y
 * Panorama, con `header_transparent_over_hero`). `activo: false` = siempre `solido`.
 */
export function useEstadoTransparente(activo = true): 'sobre' | 'solido' {
  const [estado, setEstado] = useState<'sobre' | 'solido'>('solido');

  useEffect(() => {
    if (!activo) return;
    const header = document.querySelector<HTMLElement>('header[data-encabezado-transparente]');
    let solapada = portadaSolapada(header);
    const actualizar = () => setEstado(solapada && window.scrollY < 8 ? 'sobre' : 'solido');
    actualizar();
    // La portada puede montar después (imágenes, secciones en cliente): se vuelve a medir.
    const medir = window.setTimeout(() => {
      solapada = portadaSolapada(header);
      actualizar();
    }, 300);
    window.addEventListener('scroll', actualizar, { passive: true });
    return () => {
      window.clearTimeout(medir);
      window.removeEventListener('scroll', actualizar);
    };
  }, [activo]);

  return activo ? estado : 'solido';
}

export default function HeaderTransparent(props: HeaderVariantProps) {
  const estado = useEstadoTransparente();
  return <HeaderClassic {...props} transparente={estado} />;
}
