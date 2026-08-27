'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { WebsitePageSection } from '@/types/database';

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
 * Seguridad: valida `origin` contra una lista de orígenes permitidos (ERP +
 * localhost para desarrollo). Si el origen no es válido, ignora el mensaje.
 *
 * Fallback: si el bridge no recibe mensajes (versión vieja del ERP), el sitio
 * sigue funcionando con la recarga por `refreshKey` del editor.
 */

const ALLOWED_EDITOR_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://erp.goadmin.io',
  'https://go-admin-erp.vercel.app',
];

interface PreviewSection {
  id: string;
  section_type: string;
  section_variant: string;
  content: Record<string, any>;
  settings?: Record<string, any>;
  is_visible?: boolean;
}

interface PreviewBridgeProps {
  /** Secciones originales renderizadas server-side. */
  initialSections: WebsitePageSection[];
  /** Renderiza las secciones con los datos en vivo. */
  children: (sections: WebsitePageSection[], activeSectionId: string | null) => React.ReactNode;
}

export function PreviewBridge({ initialSections, children }: PreviewBridgeProps) {
  const [liveSections, setLiveSections] = useState<WebsitePageSection[]>(initialSections);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const editorOrigin = useRef<string | null>(null);

  // Aplicar secciones recibidas del editor
  const applySections = useCallback((sections: PreviewSection[]) => {
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
    const el = document.querySelector(`[data-section-id="${sectionId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  useEffect(() => {
    // Avisar al editor que el bridge está listo
    try {
      window.parent?.postMessage({ type: 'goadmin:ready' }, '*');
    } catch { /* noop */ }

    const handler = (e: MessageEvent) => {
      // Validar origen
      if (e.origin && !ALLOWED_EDITOR_ORIGINS.includes(e.origin)) return;
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
          } else if (e.data.sectionId === null) {
            setActiveSectionId(null);
          }
          break;
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [applySections, scrollToSection]);

  // Clic en una sección → avisar al editor
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest('[data-section-id]') as HTMLElement | null;
      if (target) {
        const sectionId = target.getAttribute('data-section-id');
        if (sectionId) {
          e.preventDefault();
          e.stopPropagation();
          setActiveSectionId(sectionId);
          try {
            window.parent?.postMessage(
              { type: 'goadmin:select', sectionId },
              editorOrigin.current || '*',
            );
          } catch { /* noop */ }
        }
      }
    };
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

  return <>{children(liveSections, activeSectionId)}</>;
}

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
