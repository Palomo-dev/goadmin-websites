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

/** ¿La primera sección de <main> sube por debajo del encabezado? */
function portadaSolapada(header: HTMLElement | null): boolean {
  const main = document.querySelector('main');
  if (!main || !header) return false;
  const fondoHeader = header.getBoundingClientRect().bottom;
  let el: Element | null = main.firstElementChild;
  // La portada puede venir envuelta (SectionWrapper, ZonaGlobalPreview…): se baja unos niveles.
  for (let nivel = 0; el && nivel < 4; nivel++) {
    const caja = el.getBoundingClientRect();
    if (caja.height > 0) return caja.top < fondoHeader - 2;
    el = el.firstElementChild;
  }
  return false;
}

export default function HeaderTransparent(props: HeaderVariantProps) {
  const [estado, setEstado] = useState<'sobre' | 'solido'>('solido');

  useEffect(() => {
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
  }, []);

  return <HeaderClassic {...props} transparente={estado} />;
}
