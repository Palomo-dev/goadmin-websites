/**
 * Número estable para «personas viendo».
 * No es una métrica en vivo: el mismo producto da siempre el mismo número.
 */

export function personasEstables(semilla: string): number {
  let h = 0
  const texto = semilla || 'seccion'
  for (let i = 0; i < texto.length; i++) h = (Math.imul(h, 33) + texto.charCodeAt(i)) >>> 0
  return 3 + (h % 16)
}

export function textoConNumero(plantilla: string, n: number): string {
  const base = plantilla.includes('{n}') ? plantilla : '{n} personas viendo'
  return base.replaceAll('{n}', String(n)).slice(0, 200)
}

export interface AvisoViendoConfig {
  activo?: boolean
  plantilla?: string
}

export function leerAvisoViendo(valor: unknown): AvisoViendoConfig | null {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null
  const o = valor as Record<string, unknown>
  if (o.activo !== true) return null
  const plantilla = typeof o.plantilla === 'string' && o.plantilla.trim() ? o.plantilla.trim().slice(0, 200) : '{n} personas viendo'
  return { activo: true, plantilla }
}
