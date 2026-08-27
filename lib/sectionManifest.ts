/**
 * Construye el manifiesto de secciones del sitio (F0.6).
 *
 * Deriva el manifiesto del `SECTION_MAP` real del sitio — no hay datos
 * hardcodeados. Cada entrada del manifiesto expone:
 *  - `type`: el section_type (clave de primer nivel del SECTION_MAP)
 *  - `variants`: las variantes disponibles (claves del sub-mapa)
 *  - `contentKeys`: claves de `content` que el componente lee, declaradas vía
 *    `export const CONTENT_KEYS = [...]` en cada componente. Si un componente
 *    aún no declara CONTENT_KEYS, se devuelve `[]` (se completará en F2).
 *
 * El endpoint `app/api/_sections/manifest/route.ts` llama a `buildSectionManifest`
 * y devuelve el JSON al ERP para la verificación del contrato editor ↔ sitio.
 */

import { SECTION_MAP } from '@/components/sections/SectionRenderer'

export interface SectionManifestEntry {
  type: string
  variants: string[]
  contentKeys: string[]
}

export interface SectionManifest {
  version: string
  sections: SectionManifestEntry[]
}

/**
 * Extrae las contentKeys de un componente. Si el componente exporta
 * `CONTENT_KEYS` (array de strings), lo usa; si no, devuelve `[]`.
 */
function extractContentKeys(Component: React.ComponentType<any>): string[] {
  const keys = (Component as unknown as { CONTENT_KEYS?: readonly string[] }).CONTENT_KEYS
  if (Array.isArray(keys)) return [...keys]
  return []
}

/**
 * Construye el manifiesto de secciones a partir del SECTION_MAP.
 * El resultado es determinista (ordenado por type y variant).
 */
export function buildSectionManifest(): SectionManifest {
  const sections: SectionManifestEntry[] = Object.keys(SECTION_MAP)
    .sort()
    .map((type) => {
      const variantMap = SECTION_MAP[type]
      const variants = Object.keys(variantMap).sort()

      // contentKeys: se aggregan las claves declaradas por cada variante.
      // Si varias variantes del mismo tipo declaran CONTENT_KEYS, se hace
      // la unión (sin duplicados) para reflejar todas las claves posibles.
      const contentKeySet = new Set<string>()
      for (const variant of variants) {
        const Component = variantMap[variant]
        for (const key of extractContentKeys(Component)) {
          contentKeySet.add(key)
        }
      }

      return {
        type,
        variants,
        contentKeys: [...contentKeySet].sort(),
      }
    })

  return {
    version: '1',
    sections,
  }
}
