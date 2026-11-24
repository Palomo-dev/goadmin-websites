'use client'

/**
 * Rastro de la pestaña para el botón «Volver»: las páginas de la tienda que visitó el cliente en
 * esta pestaña (sessionStorage), los nombres que registran las páginas (categoría, ficha) y los
 * títulos de las demás. Las reglas viven en `lib/navegacion/volver.ts`.
 *
 * Todo dentro de try/catch: sin sessionStorage (modo privado estricto, bloqueado) el botón
 * funciona igual, con la página «madre».
 */
import { etiquetaDeRuta, etiquetaDeTitulo, type EntradaRastro } from '@/lib/navegacion/volver'
import { quitarPrefijo } from '@/lib/outlet/rutaSitio'

const CLAVE = 'go:rastro-volver:v1'
/** Lo dispara el rastro al registrar una navegación; el ← recalcula su destino. */
export const EVENTO_RASTRO = 'go:rastro-volver'

export interface RastroPestana {
  pila: EntradaRastro[]
  /** Nombre que registró la propia página (categoría «Neveras», ficha «Nevera No Frost…»). */
  etiquetas: Record<string, string>
  /** Título del documento de cada página, para las que no registran nombre. */
  titulos: Record<string, string>
}

const VACIO: RastroPestana = { pila: [], etiquetas: {}, titulos: {} }
/** Tope de nombres guardados: el rastro es de una pestaña, no un historial. */
const MAXIMO_NOMBRES = 60

export function leerRastro(): RastroPestana {
  try {
    const crudo = window.sessionStorage.getItem(CLAVE)
    if (!crudo) return VACIO
    const r = JSON.parse(crudo) as Partial<RastroPestana>
    return {
      pila: Array.isArray(r.pila) ? r.pila.filter((e) => e && typeof e.path === 'string' && typeof e.url === 'string') : [],
      etiquetas: r.etiquetas && typeof r.etiquetas === 'object' ? r.etiquetas : {},
      titulos: r.titulos && typeof r.titulos === 'object' ? r.titulos : {},
    }
  } catch {
    return VACIO
  }
}

function recortarNombres(m: Record<string, string>): Record<string, string> {
  const claves = Object.keys(m)
  if (claves.length <= MAXIMO_NOMBRES) return m
  return Object.fromEntries(claves.slice(-MAXIMO_NOMBRES).map((k) => [k, m[k]]))
}

export function guardarRastro(r: RastroPestana): void {
  try {
    window.sessionStorage.setItem(CLAVE, JSON.stringify({ pila: r.pila, etiquetas: recortarNombres(r.etiquetas), titulos: recortarNombres(r.titulos) }))
  } catch {
    // Sin almacenamiento: el ← usa la página «madre».
  }
}

/** La página actual registra su nombre («Neveras») para el ← de la siguiente. */
export function registrarEtiqueta(path: string, etiqueta: string): void {
  const e = etiqueta.trim()
  if (!e) return
  const r = leerRastro()
  if (r.etiquetas[path] === e) return
  const etiquetas = { ...r.etiquetas }
  delete etiquetas[path]
  etiquetas[path] = e.slice(0, 80)
  guardarRastro({ ...r, etiquetas })
}

export function registrarTitulo(path: string, titulo: string): void {
  const t = etiquetaDeTitulo(titulo)
  if (!t) return
  const r = leerRastro()
  if (r.titulos[path] === t) return
  const titulos = { ...r.titulos }
  delete titulos[path]
  titulos[path] = t
  guardarRastro({ ...r, titulos })
}

/**
 * Nombre de una entrada del rastro: el que registró la página; si no, el de su ruta conocida
 * (Inicio, Resultados de "nevera", Mis pedidos); si no, su título.
 */
export function nombreEntrada(r: RastroPestana, prefijo: string) {
  return (e: EntradaRastro): string | null =>
    r.etiquetas[e.path] ?? etiquetaDeRuta(quitarPrefijo(e.url, prefijo)) ?? r.titulos[e.path] ?? null
}
