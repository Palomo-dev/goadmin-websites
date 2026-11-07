/**
 * Botones de las secciones con el estilo del tema (`tema.tokens.boton`: forma, relleno y tamaño),
 * detrás del interruptor del shell `buttons_theme_active` (contrato 2026-11-07, «Editor ·
 * Encabezado píldora, menú inferior y botones»).
 *
 * Por qué hay interruptor: 9 de los 15 sitios V2 publicados (orgs 340, 341, 342, 345, 346, 347,
 * 348, 349 y 358) ya guardan `tokens.boton` porque un preset lo escribió, y hoy no se pinta. Si se
 * pintara solo, esos sitios cambiarían sin que nadie lo pidiera. El editor del ERP escribe
 * `buttons_theme_active: true` cuando el dueño toca «Botones».
 *
 * Va en un archivo propio del sitio: `tokensDiseno.ts` es copia byte a byte del ERP
 * (scripts/verify-copias-erp.mjs) y no se le añade nada.
 *
 * Qué emite (lo leen las reglas `[data-botones-tema]` de app/globals.css, solo sobre los botones
 * marcados `section[data-section-id] [data-boton]`):
 * - `data-botones-tema="activo"`: siempre que el interruptor esté prendido y haya algo que pintar.
 * - forma → `data-boton-forma` + `--boton-radio`: cuadrado 0 · redondeado 12px · pildora 999px.
 *   Manda sobre el radio del tema (`--radio-boton`) y sobre el radio en línea del botón.
 * - relleno → `data-boton-relleno`: `solido` (el de hoy: el fondo de marca del botón, y aparta el
 *   «Contorno»/«Sombra dura» de `data-estilo-boton`), `contorno`, `fantasma` (sin fondo ni borde,
 *   texto del color primario y fondo suave al pasar) y `sombra_dura` (las mismas reglas que
 *   `data-estilo-boton='sombra_dura'`). Solo la acción principal (`data-boton='primario'`), igual
 *   que el estilo de botón del tema: las secundarias ya son contorno o texto.
 * - tamaño → `data-boton-tamano` + variables (ver {@link MEDIDAS_TAMANO_BOTON}): alto 36 / 44 / 52
 *   px con letra 13 / 14 / 16 px, interlínea 20 / 20 / 24 px y relleno horizontal 16 / 20 / 28 px.
 *   El alto lo fija `min-height`; el relleno vertical es ((alto − interlínea) / 2) − 2, el borde
 *   de 2 px del contorno, así un botón con borde mide lo mismo que uno sin él (medido en Chromium:
 *   36 / 44 / 52 exactos en las 36 combinaciones). No se toca el `display` (un `hidden
 *   md:inline-flex` seguiría oculto) salvo en los `inline-block`, que pasan a `inline-flex` para
 *   centrar el texto en su alto.
 *
 * Sin el interruptor (o con él y sin `tokens.boton`): `{ variables: {}, datos: {} }` y el sitio no
 * cambia ni un atributo. Puro: servidor, navegador y scripts/verify-botones.mjs.
 */
import { normalizarOpcionShell } from './mapeoAjustes'
import type { TokensCrudos } from './tokensDiseno'

export const FORMAS_BOTON_TEMA = ['cuadrado', 'redondeado', 'pildora'] as const
export const RELLENOS_BOTON_TEMA = ['solido', 'contorno', 'fantasma', 'sombra_dura'] as const
export const TAMANOS_BOTON_TEMA = ['s', 'm', 'l'] as const
export type FormaBotonTema = (typeof FORMAS_BOTON_TEMA)[number]
export type RellenoBotonTema = (typeof RELLENOS_BOTON_TEMA)[number]
export type TamanoBotonTema = (typeof TAMANOS_BOTON_TEMA)[number]

/** Radio por forma (el redondeado es el mismo 12 px del botón «rounded» del encabezado). */
export const RADIO_FORMA_BOTON: Readonly<Record<FormaBotonTema, string>> = {
  cuadrado: '0px',
  redondeado: '12px',
  pildora: '999px',
}

/** Medidas por tamaño. alto = interlínea + 2 × (relleno vertical + borde de 2 px). */
export const MEDIDAS_TAMANO_BOTON: Readonly<Record<TamanoBotonTema, { alto: number; letra: number; interlinea: number; rellenoX: number }>> = {
  s: { alto: 36, letra: 13, interlinea: 20, rellenoX: 16 },
  m: { alto: 44, letra: 14, interlinea: 20, rellenoX: 20 },
  l: { alto: 52, letra: 16, interlinea: 24, rellenoX: 28 },
}

/** Borde del relleno «contorno» y de los secundarios de las secciones (2 px): se descuenta del relleno. */
export const BORDE_CONTORNO = 2

type Ajustes = Record<string, unknown> | null | undefined

/** `buttons_theme_active` normalizada (default `false`: lo de hoy). */
export function botonesTemaActivo(ajustes: Ajustes): boolean {
  return normalizarOpcionShell('buttons_theme_active', ajustes ? ajustes.buttons_theme_active : undefined) === true
}

function valor<T extends string>(campo: unknown, validos: readonly T[]): T | null {
  if (!campo || typeof campo !== 'object') return null
  const c = campo as { mode?: unknown; value?: unknown }
  if (c.mode !== 'value' || typeof c.value !== 'string') return null
  return (validos as readonly string[]).includes(c.value) ? (c.value as T) : null
}

export interface BotonTema {
  forma: FormaBotonTema | null
  relleno: RellenoBotonTema | null
  tamano: TamanoBotonTema | null
}

/** Lo que guarda `tokens.boton` (valores fuera de la lista = ausentes). */
export function leerBotonTema(tokens: TokensCrudos | null | undefined): BotonTema {
  const b = tokens?.boton
  return {
    forma: valor(b?.forma, FORMAS_BOTON_TEMA),
    relleno: valor(b?.relleno, RELLENOS_BOTON_TEMA),
    tamano: valor(b?.tamano, TAMANOS_BOTON_TEMA),
  }
}

export interface AtributosBotonesTema {
  variables: Record<string, string>
  datos: Record<string, string>
}

/**
 * Variables y atributos de la raíz del sitio para los botones del tema. Vacío sin el interruptor
 * (`activa` = `botonesTemaActivo(ajustes)`) o sin forma, relleno ni tamaño guardados.
 */
export function atributosBotonesTema(tokens: TokensCrudos | null | undefined, activa: boolean): AtributosBotonesTema {
  const variables: Record<string, string> = {}
  const datos: Record<string, string> = {}
  if (activa !== true) return { variables, datos }
  const b = leerBotonTema(tokens)
  if (b.forma) {
    datos['data-boton-forma'] = b.forma
    variables['--boton-radio'] = RADIO_FORMA_BOTON[b.forma]
  }
  if (b.relleno) datos['data-boton-relleno'] = b.relleno
  if (b.tamano) {
    const m = MEDIDAS_TAMANO_BOTON[b.tamano]
    datos['data-boton-tamano'] = b.tamano
    variables['--boton-alto'] = `${m.alto}px`
    variables['--boton-letra'] = `${m.letra}px`
    variables['--boton-interlinea'] = `${m.interlinea}px`
    variables['--boton-relleno-x'] = `${m.rellenoX}px`
    variables['--boton-relleno-y'] = `${(m.alto - m.interlinea) / 2 - BORDE_CONTORNO}px`
  }
  if (Object.keys(datos).length > 0) datos['data-botones-tema'] = 'activo'
  return { variables, datos }
}
