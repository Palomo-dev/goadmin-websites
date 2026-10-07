'use client';

import { PreviewBridge, useIsPreviewMode } from '@/components/sections/PreviewBridge';
import { SectionRenderer } from '@/components/sections/SectionRenderer';
import { SeccionVaciaLienzo, type AvisoLienzo } from '@/components/sections/SeccionVaciaLienzo';
import { PasosMesa } from '@/components/sections/restaurant/mesa/PasosMesa';
import { usePasosMesa } from '@/components/site/PasosMesaContext';
import type { WebsitePageSection } from '@/types/database';
import type { OrganizationWithDetails } from '@/types/database';

interface PreviewableSectionsProps {
  sections: WebsitePageSection[];
  organization: OrganizationWithDetails;
  primaryColor: string;
  data?: Record<string, any>;
}

/**
 * Renderiza las secciones de una página. En modo preview (?preview=1) envuelve
 * con PreviewBridge para recibir cambios en vivo vía postMessage (FASE 12.1).
 * En modo normal, renderiza directamente (sin overhead).
 */
export function PreviewableSections({
  sections,
  organization,
  primaryColor,
  data,
}: PreviewableSectionsProps) {
  const isPreview = useIsPreviewMode();
  // Carta QR en modo mesa (el layout pone el contexto): un paso a la vez (PasosMesa).
  const { activo: porPasos } = usePasosMesa();

  if (!isPreview) {
    if (porPasos) {
      return (
        <PasosMesa
          sections={sections}
          render={(section) => (
            <SectionRenderer section={section} organization={organization} primaryColor={primaryColor} data={data} />
          )}
        />
      );
    }
    // Cualquier otra página: todas las secciones apiladas, como siempre.
    return (
      <>
        {sections.map((section) => (
          <SectionRenderer
            key={section.id}
            section={section}
            organization={organization}
            primaryColor={primaryColor}
            data={data}
          />
        ))}
      </>
    );
  }

  const pintar = (section: WebsitePageSection, avisos: Record<string, AvisoLienzo>) =>
    // Faltan datos (lo decide el editor con los conteos del ERP): estado vacío del lienzo.
    avisos[section.id] ? (
      <SeccionVaciaLienzo
        key={section.id}
        sectionId={section.id}
        sectionType={section.section_type}
        aviso={avisos[section.id]}
      />
    ) : (
      <SectionRenderer
        key={section.id}
        section={section}
        organization={organization}
        primaryColor={primaryColor}
        data={data}
      />
    );

  return (
    <PreviewBridge initialSections={sections}>
      {(liveSections, _activa, avisos) =>
        porPasos ? (
          // Lienzo de la Carta QR: el paso de la sección seleccionada (lámina 17).
          <PasosMesa sections={liveSections} render={(section) => pintar(section, avisos)} />
        ) : (
          <>{liveSections.map((section) => pintar(section, avisos))}</>
        )
      }
    </PreviewBridge>
  );
}
