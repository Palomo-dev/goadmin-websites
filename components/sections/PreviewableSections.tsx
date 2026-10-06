'use client';

import { PreviewBridge, useIsPreviewMode } from '@/components/sections/PreviewBridge';
import { SectionRenderer } from '@/components/sections/SectionRenderer';
import { SeccionVaciaLienzo } from '@/components/sections/SeccionVaciaLienzo';
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

  if (!isPreview) {
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

  return (
    <PreviewBridge initialSections={sections}>
      {(liveSections, _activa, avisos) => (
        <>
          {liveSections.map((section) =>
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
            ),
          )}
        </>
      )}
    </PreviewBridge>
  );
}
