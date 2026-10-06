/**
 * Estilo general del sitio V2 (Diseño › Estilo del sitio del ERP) traducido a lo que pinta la web.
 *
 * Qué lee de `documento.tema` (lo escribe `escribirEstilo` de go-admin-erp/src/lib/website/v2/
 * tokensEstilo.ts):
 * - `colores.fondo` y `colores.texto`: fondo y texto de la página. `primario`, `secundario` y
 *   `acento` ya llegan como columnas por `mapeoAjustes` (CAMPOS_HEREDABLES), no se repiten aquí.
 * - `tipografia.titulos` y `tipografia.cuerpo`: el par tipográfico.
 * - `radio` (0 | 4 | 12 | 24), `estiloBoton` (solido | contorno | pastilla | sombra_dura) y
 *   `movimiento` (ninguno | bajo | medio | alto).
 *
 * Herencia de sede (ADR-002 D6): cada token se resuelve con `resolverCampo` del contrato contra el
 * principal, igual que el resto de campos. Un principal legacy no aporta nada: sus columnas
 * `background_color`, `font_heading`… nunca tuvieron efecto en la web (D12) y no se reviven.
 *
 * Sitio legacy → `null` y la web queda exactamente como antes (ninguna variable, ningún atributo).
 * Código puro: sin React, Next ni Supabase.
 */
import { resolverCampo, type CampoHeredable, type DocumentoSitio } from './contrato/documentoSitio'

export type RadioSitio = 0 | 4 | 12 | 24
export type EstiloBotonSitio = 'solido' | 'contorno' | 'pastilla' | 'sombra_dura'
export type MovimientoSitio = 'ninguno' | 'bajo' | 'medio' | 'alto'

export interface TemaPublico {
  fondo: string | null
  texto: string | null
  fuenteTitulos: string | null
  fuenteCuerpo: string | null
  radio: RadioSitio | null
  estiloBoton: EstiloBotonSitio | null
  movimiento: MovimientoSitio | null
}

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
/** Familias que se pueden pedir a Google Fonts y escribir en CSS sin escapar nada. */
const FAMILIA = /^[A-Za-z0-9][A-Za-z0-9 ]{0,59}$/
const RADIOS: readonly number[] = [0, 4, 12, 24]
const BOTONES: readonly string[] = ['solido', 'contorno', 'pastilla', 'sombra_dura']
const MOVIMIENTOS: readonly string[] = ['ninguno', 'bajo', 'medio', 'alto']

type Tema = DocumentoSitio['tema']

function propio<T>(campo: CampoHeredable<T> | undefined): T | null {
  return campo && campo.mode === 'value' ? campo.value : null
}

function resolver<T>(doc: Tema, principal: Tema | null, leer: (t: Tema) => CampoHeredable<T> | undefined, esSede: boolean): T | null {
  const campo = leer(doc)
  if (!esSede) return propio(campo)
  return resolverCampo<T>(principal ? propio(leer(principal)) : null, campo)
}

/** Familia válida o `null` (nunca se escribe en CSS un texto sin validar). */
export function familiaSegura(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const limpio = valor.trim()
  return FAMILIA.test(limpio) ? limpio : null
}

/**
 * Tema efectivo del sitio V2. `principal`: `undefined`/`null` en el sitio principal; en una sede,
 * el documento del principal (o `null` si el principal es legacy).
 */
export function temaPublicoDesdeDocumento(
  documento: DocumentoSitio,
  esSede: boolean,
  principal: DocumentoSitio | null,
): TemaPublico {
  const t = documento.tema
  const p = principal?.tema ?? null
  const color = (v: unknown) => (typeof v === 'string' && HEX.test(v) ? v : null)
  const radio = resolver(t, p, (x) => x.radio, esSede)
  const boton = resolver(t, p, (x) => x.estiloBoton, esSede)
  const movimiento = resolver(t, p, (x) => x.movimiento, esSede)
  return {
    fondo: color(resolver(t, p, (x) => x.colores.fondo, esSede)),
    texto: color(resolver(t, p, (x) => x.colores.texto, esSede)),
    fuenteTitulos: familiaSegura(resolver(t, p, (x) => x.tipografia.titulos, esSede)),
    fuenteCuerpo: familiaSegura(resolver(t, p, (x) => x.tipografia.cuerpo, esSede)),
    radio: typeof radio === 'number' && RADIOS.includes(radio) ? (radio as RadioSitio) : null,
    estiloBoton: typeof boton === 'string' && BOTONES.includes(boton) ? (boton as EstiloBotonSitio) : null,
    movimiento: typeof movimiento === 'string' && MOVIMIENTOS.includes(movimiento) ? (movimiento as MovimientoSitio) : null,
  }
}

/** Distancia de la entrada de las secciones según el movimiento del sitio (px). */
export const DISTANCIA_MOVIMIENTO: Readonly<Record<Exclude<MovimientoSitio, 'ninguno'>, number>> = {
  bajo: 8,
  medio: 16,
  alto: 32,
}

/** Radio del botón (misma regla que `radioBoton` del ERP: la píldora es un radio máximo). */
export function radioBotonPx(t: Pick<TemaPublico, 'radio' | 'estiloBoton'>): number | null {
  if (t.estiloBoton === 'pastilla') return 9999
  return t.radio
}

export interface AtributosTema {
  /** Variables CSS para el contenedor raíz del sitio. */
  variables: Record<string, string>
  /** Atributos `data-*` que activan las reglas de `app/globals.css` (solo los que aplican). */
  datos: Record<string, string>
}

/**
 * Variables y atributos del contenedor raíz. Solo emite lo que el tema define: un sitio sin
 * tokens (o legacy) no recibe nada y se pinta igual que antes.
 */
export function atributosTema(t: TemaPublico | null): AtributosTema {
  const variables: Record<string, string> = {}
  const datos: Record<string, string> = {}
  if (!t) return { variables, datos }
  if (t.fondo) variables['--background-color'] = t.fondo
  if (t.texto) variables['--text-color'] = t.texto
  if (t.fuenteTitulos) variables['--font-heading'] = `'${t.fuenteTitulos}'`
  if (t.fuenteCuerpo) variables['--font-body'] = `'${t.fuenteCuerpo}'`
  if (t.fondo || t.texto) datos['data-tema-colores'] = 'propio'
  if (t.fuenteCuerpo) datos['data-tema-fuente'] = 'propia'
  if (t.radio !== null) variables['--radio-sitio'] = `${t.radio}px`
  const radioBoton = radioBotonPx(t)
  if (radioBoton !== null) {
    variables['--radio-boton'] = `${radioBoton}px`
    datos['data-radio-boton'] = 'propio'
  }
  if (t.estiloBoton && t.estiloBoton !== 'solido' && t.estiloBoton !== 'pastilla') datos['data-estilo-boton'] = t.estiloBoton
  if (t.movimiento) {
    datos['data-movimiento'] = t.movimiento
    if (t.movimiento !== 'ninguno') variables['--movimiento-distancia'] = `${DISTANCIA_MOVIMIENTO[t.movimiento]}px`
  }
  return { variables, datos }
}

/**
 * Hoja de Google Fonts para las familias pedidas (sin repetir, máximo 6), o `null` si no hay
 * ninguna. Solo familias que pasan `familiaSegura`. Pesos 400-700 (los del estilo por sección).
 */
export function urlGoogleFonts(familias: (string | null | undefined)[]): string | null {
  const unicas = Array.from(new Set(familias.map(familiaSegura).filter((f): f is string => !!f))).slice(0, 6)
  if (unicas.length === 0) return null
  const partes = unicas.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;500;600;700`)
  return `https://fonts.googleapis.com/css2?${partes.join('&')}&display=swap`
}
