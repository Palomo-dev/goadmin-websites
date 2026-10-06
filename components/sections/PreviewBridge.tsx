'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { WebsitePageSection } from '@/types/database';
import type { AvisoLienzo } from './SeccionVaciaLienzo';

/**
 * PreviewBridge (FASE 12.1)
 *
 * Componente cliente que se monta solo cuando la URL lleva `?preview=1`.
 * Escucha mensajes `postMessage` del editor del ERP y aplica los cambios de
 * secciones en vivo (sin recargar la página).
 *
 * Protocolo:
 *   Editor → sitio:  { type: 'goadmin:preview', sections: [...] }
 *   Editor → sitio:  { type: 'goadmin:scroll', sectionId }
 *   Sitio → editor:  { type: 'goadmin:select', sectionId }   (clic en sección)
 *   Sitio → editor:  { type: 'goadmin:ready' }               (al montar)
 *
 * Zonas globales (encabezado y pie): `ZonaGlobalPreview` las envuelve en
 * modo preview con `data-section-id="header"|"footer"` y `data-goadmin-zona`.
 * El clic en ellas envía `{ type: 'goadmin:select', sectionId, enlace }`
 * (`enlace: true` si el clic cayó en un enlace). A diferencia de una sección,
 * el clic no se corta: el menú hamburguesa o los acordeones siguen
 * respondiendo; solo se evita navegar cuando el clic es en un enlace. La zona
 * seleccionada (por clic o por `goadmin:select` del editor) lleva
 * `data-goadmin-activa`, que pinta el contorno y la etiqueta.
 *
 * Estado vacío (Figma «SeccionVaciaLienzo»): una sección de `goadmin:preview` puede traer
 * `aviso` (el ERP contó sus datos y no hay). Se pinta `SeccionVaciaLienzo` en su lugar, solo
 * aquí. Su «Quitar sección» (`data-goadmin-accion="quitar"`) envía
 * `{ type: 'goadmin:accion', sectionId, accion: 'quitar' }`; «Ir a …» es un enlace normal.
 *
 * Enlaces de las zonas globales: el clic envía además `href` y `texto` del enlace, para que
 * el editor abra el menú con ese ítem. Un plato de la carta (`data-goadmin-producto`) envía
 * además `productoId`: el editor abre el constructor de la carta con ese plato.
 *
 * Seguridad: valida `origin` contra una lista de orígenes permitidos (ERP +
 * localhost para desarrollo). Si el origen no es válido, ignora el mensaje.
 *
 * Fallback: si el bridge no recibe mensajes (versión vieja del ERP), el sitio
 * sigue funcionando con la recarga por `refreshKey` del editor.
 */

/** Origen de `NEXT_PUBLIC_APP_URL` (la URL del ERP de este despliegue), o `null`. */
function origenErpDelEntorno(): string | null {
  try {
    const url = process.env.NEXT_PUBLIC_APP_URL;
    if (!url) return null;
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.origin : null;
  } catch {
    return null;
  }
}

/**
 * Orígenes del editor. `https://app.goadmin.io` es el ERP de producción: faltaba, y el sitio
 * descartaba en silencio TODOS los mensajes del editor (ni selección, ni scroll, ni cambios en
 * vivo). Se añade además el origen de `NEXT_PUBLIC_APP_URL` para no volver a depender de una
 * lista escrita a mano si el ERP cambia de dominio.
 */
export const ALLOWED_EDITOR_ORIGINS: readonly string[] = Array.from(
  new Set(
    [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'https://app.goadmin.io',
      'https://erp.goadmin.io',
      'https://go-admin-erp.vercel.app',
      origenErpDelEntorno(),
    ].filter((o): o is string => !!o),
  ),
);

interface PreviewSection {
  id: string;
  section_type: string;
  section_variant: string;
  content: Record<string, any>;
  settings?: Record<string, any>;
  is_visible?: boolean;
  aviso?: unknown;
}

/** ¿El mensaje viene del editor? (orígenes del ERP y de desarrollo). */
export function esOrigenEditor(origin: string): boolean {
  return ALLOWED_EDITOR_ORIGINS.includes(origin);
}

/** Aviso bien formado del editor, o `undefined`. */
function avisoValido(valor: unknown): AvisoLienzo | undefined {
  if (!valor || typeof valor !== 'object') return undefined;
  const v = valor as Record<string, unknown>;
  if (typeof v.titulo !== 'string' || typeof v.descripcion !== 'string') return undefined;
  const a = v.accion as Record<string, unknown> | null | undefined;
  const accion = a && typeof a.texto === 'string' && typeof a.href === 'string'
    ? { texto: a.texto.slice(0, 80), href: a.href.slice(0, 512) }
    : null;
  return { titulo: v.titulo.slice(0, 120), descripcion: v.descripcion.slice(0, 400), accion };
}

interface PreviewBridgeProps {
  /** Secciones originales renderizadas server-side. */
  initialSections: WebsitePageSection[];
  /** Renderiza las secciones con los datos en vivo. */
  children: (
    sections: WebsitePageSection[],
    activeSectionId: string | null,
    avisos: Record<string, AvisoLienzo>,
  ) => React.ReactNode;
}

export function PreviewBridge({ initialSections, children }: PreviewBridgeProps) {
  const [liveSections, setLiveSections] = useState<WebsitePageSection[]>(initialSections);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<Record<string, AvisoLienzo>>({});
  const editorOrigin = useRef<string | null>(null);

  // Aplicar secciones recibidas del editor
  const applySections = useCallback((sections: PreviewSection[]) => {
    const nuevosAvisos: Record<string, AvisoLienzo> = {};
    for (const s of sections) {
      const aviso = avisoValido(s.aviso);
      if (aviso && typeof s.id === 'string') nuevosAvisos[s.id] = aviso;
    }
    setAvisos(nuevosAvisos);
    setLiveSections((prev) => {
      // Merge: reemplazar por id, mantener orden del editor
      const map = new Map<string, WebsitePageSection>();
      prev.forEach((s) => map.set(s.id, s));
      const result: WebsitePageSection[] = [];
      for (const incoming of sections) {
        const existing = map.get(incoming.id);
        if (existing) {
          result.push({
            ...existing,
            section_type: incoming.section_type || existing.section_type,
            section_variant: incoming.section_variant || existing.section_variant,
            content: incoming.content ?? existing.content,
            settings: incoming.settings ?? existing.settings,
            is_visible: incoming.is_visible ?? existing.is_visible,
          });
        } else {
          // Sección nueva que aún no existe server-side: la creamos in-memory
          result.push({
            id: incoming.id,
            page_id: '',
            organization_id: 0,
            section_type: incoming.section_type,
            section_variant: incoming.section_variant,
            content: incoming.content,
            settings: incoming.settings || {},
            sort_order: result.length,
            is_visible: incoming.is_visible ?? true,
            created_at: '',
            updated_at: '',
          });
        }
        map.delete(incoming.id);
      }
      return result;
    });
  }, []);

  // Scroll a sección
  const scrollToSection = useCallback((sectionId: string) => {
    const el = document.querySelector(`[data-section-id="${CSS.escape(sectionId)}"]`);
    if (el) {
      // Las zonas globales son `display: contents` (sin caja): se desplaza a
      // su primer hijo.
      const destino = el.hasAttribute('data-goadmin-zona') ? el.firstElementChild ?? el : el;
      destino.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  // Marca lo seleccionado: la zona global (encabezado o pie) o la sección. La sección lleva
  // `data-goadmin-activa` y `ESTILOS_SECCION_ACTIVA` le pinta el borde azul (Figma A/05a).
  const marcarZonaActiva = useCallback((sectionId: string | null) => {
    document.querySelectorAll('[data-section-id]').forEach((el) => {
      if (sectionId !== null && el.getAttribute('data-section-id') === sectionId) el.setAttribute('data-goadmin-activa', '');
      else el.removeAttribute('data-goadmin-activa');
    });
  }, []);

  // Las secciones se vuelven a pintar con cada `goadmin:preview`: se vuelve a marcar la activa.
  useEffect(() => {
    marcarZonaActiva(activeSectionId);
  }, [liveSections, activeSectionId, marcarZonaActiva]);

  useEffect(() => {
    // Avisar al editor que el bridge está listo
    try {
      window.parent?.postMessage({ type: 'goadmin:ready' }, '*');
    } catch { /* noop */ }

    const handler = (e: MessageEvent) => {
      // Validar origen
      if (!esOrigenEditor(e.origin)) return;
      if (!e.data || typeof e.data !== 'object') return;

      editorOrigin.current = e.origin || null;

      switch (e.data.type) {
        case 'goadmin:preview':
          if (Array.isArray(e.data.sections)) {
            applySections(e.data.sections as PreviewSection[]);
          }
          break;
        case 'goadmin:scroll':
          if (typeof e.data.sectionId === 'string') {
            scrollToSection(e.data.sectionId);
          }
          break;
        case 'goadmin:select':
          if (typeof e.data.sectionId === 'string') {
            setActiveSectionId(e.data.sectionId);
            marcarZonaActiva(e.data.sectionId);
          } else if (e.data.sectionId === null) {
            setActiveSectionId(null);
            marcarZonaActiva(null);
          }
          break;
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [applySections, scrollToSection, marcarZonaActiva]);

  // Clic en una sección → avisar al editor
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Acciones del estado vacío del lienzo: «Ir a …» navega (otra pestaña); «Quitar» avisa.
      const accion = (e.target as HTMLElement)?.closest('[data-goadmin-accion]') as HTMLElement | null;
      if (accion) {
        if (accion.getAttribute('data-goadmin-accion') === 'quitar') {
          e.preventDefault();
          e.stopPropagation();
          const sectionId = accion.closest('[data-section-id]')?.getAttribute('data-section-id');
          if (sectionId && editorOrigin.current) {
            try {
              window.parent?.postMessage({ type: 'goadmin:accion', sectionId, accion: 'quitar' }, editorOrigin.current);
            } catch { /* noop */ }
          }
        }
        return;
      }
      const target = (e.target as HTMLElement)?.closest('[data-section-id]') as HTMLElement | null;
      if (target) {
        const sectionId = target.getAttribute('data-section-id');
        if (sectionId && target.hasAttribute('data-goadmin-zona')) {
          // Zona global: no se corta el clic (menú, acordeones); solo se
          // evita navegar si cayó en un enlace.
          const ancla = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null;
          const enlace = !!ancla;
          if (enlace) e.preventDefault();
          setActiveSectionId(sectionId);
          marcarZonaActiva(sectionId);
          try {
            window.parent?.postMessage(
              {
                type: 'goadmin:select',
                sectionId,
                enlace,
                ...(ancla
                  ? {
                      href: (ancla.getAttribute('href') || '').slice(0, 512),
                      texto: (ancla.textContent || '').trim().slice(0, 120),
                    }
                  : {}),
              },
              editorOrigin.current || '*',
            );
          } catch { /* noop */ }
        } else if (sectionId) {
          e.preventDefault();
          e.stopPropagation();
          setActiveSectionId(sectionId);
          marcarZonaActiva(sectionId);
          // Plato de la carta (`data-goadmin-producto`, solo en preview): el editor abre el
          // constructor de la carta con ese plato.
          const plato = Number(
            (e.target as HTMLElement).closest('[data-goadmin-producto]')?.getAttribute('data-goadmin-producto'),
          );
          try {
            window.parent?.postMessage(
              { type: 'goadmin:select', sectionId, ...(Number.isInteger(plato) && plato > 0 ? { productoId: plato } : {}) },
              editorOrigin.current || '*',
            );
          } catch { /* noop */ }
        }
      }
    };
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [marcarZonaActiva]);

  return (
    <>
      <style>{ESTILOS_SECCION_ACTIVA}</style>
      {children(liveSections, activeSectionId, avisos)}
    </>
  );
}

/**
 * Borde azul de la sección seleccionada en el lienzo (mismo azul que las zonas globales). Solo
 * existe en modo preview: el `<style>` lo monta el bridge. `outline` no mueve el diseño.
 */
const ESTILOS_SECCION_ACTIVA = `
section[data-section-id][data-goadmin-activa] {
  outline: 2px solid #4361ee;
  outline-offset: -2px;
  scroll-margin-top: 96px;
}
section[data-section-id]:not([data-goadmin-activa]):hover {
  outline: 1px dashed rgba(67, 97, 238, 0.6);
  outline-offset: -1px;
  cursor: pointer;
}
`;

/**
 * Hook para saber si estamos en modo preview (URL lleva ?preview=1).
 */
export function useIsPreviewMode(): boolean {
  const [isPreview, setIsPreview] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setIsPreview(params.get('preview') === '1');
  }, []);
  return isPreview;
}
