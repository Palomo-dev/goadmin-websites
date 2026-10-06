/**
 * Estilo por sección y visibilidad por dispositivo, del lado del sitio público.
 *
 * La lectura y la regla son las del editor: `leerEstiloSeccion`, `variablesCssSeccion` y
 * `visibilidadDeSeccion` de `estiloSeccion.ts` (copia idéntica del ERP, `npm run verify:copias`).
 * Aquí solo se traduce a lo que pinta `SectionWrapper`:
 *
 * - V2: `paginaAPublica` deja el `diseno` de la sección en `settings` (con `estilo`) y convierte
 *   `visibilidad` {escritorio, movil, tableta?} a `settings.visibilidad` {computador, tableta,
 *   celular}. Legacy: el editor ya guarda ahí los dos. Un solo camino para los dos.
 * - Precedencia (cabecera de estiloSeccion.ts): Avanzado (`content`) > estilo de la sección >
 *   tema. Por eso el estilo solo RELLENA las claves de `content` que el Avanzado no fijó.
 * - Lo que no se puede expresar con `content` va en atributos `data-seccion-*` + variables CSS,
 *   con sus reglas en `app/globals.css`. Una sección sin estilo no recibe ningún atributo: se
 *   pinta exactamente como antes.
 *
 * Código puro: sin React, Next ni Supabase.
 */
import { leerEstiloSeccion, variablesCssSeccion, visibilidadDeSeccion, type EstiloSeccion } from './estiloSeccion'
import { familiaSegura } from './temaPublico'

/** Espaciado del estilo → escala `padding_top`/`padding_bottom` que ya entiende SectionWrapper. */
const PADDING_POR_ESPACIADO: Readonly<Record<NonNullable<EstiloSeccion['espaciado']>, string>> = {
  compacto: 'sm',
  normal: 'lg',
  amplio: 'xl',
}

export interface PresentacionSeccion {
  /** `content` con lo que el estilo rellena (nunca pisa una clave que el Avanzado ya fijó). */
  contenido: Record<string, unknown>
  /** Atributos `data-*` de la sección (reglas en app/globals.css). */
  datos: Record<string, string>
  /** Variables CSS de la sección. */
  variables: Record<string, string>
  /** Familias propias de la sección para pedir a Google Fonts (las `tema:*` ya las carga el sitio). */
  fuentes: string[]
  /** `true` si la sección no se ve en ningún dispositivo (no se pinta). */
  oculta: boolean
}

function vacio(v: unknown): boolean {
  return v === undefined || v === null || v === ''
}

/** Variables del celular: mismos nombres con `-movil` (la regla de tamaño lee la que toque). */
function variablesCelular(e: EstiloSeccion): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(variablesCssSeccion(e, 'celular'))) {
    if (k.startsWith('--seccion-tamano-')) out[`${k}-movil`] = v
  }
  return out
}

export function presentacionSeccion(
  settings: Record<string, unknown> | null | undefined,
  content: Record<string, unknown> | null | undefined,
): PresentacionSeccion {
  const contenido: Record<string, unknown> = { ...(content ?? {}) }
  const datos: Record<string, string> = {}
  const variables: Record<string, string> = {}
  const fuentes: string[] = []

  // ── Visibilidad por dispositivo (el ojo ya filtró `is_visible = false` en la consulta) ──
  const vis = visibilidadDeSeccion({ is_visible: true, settings: settings ?? null })
  const oculta = !vis.computador && !vis.tableta && !vis.celular
  if (!vis.computador) datos['data-oculto-computador'] = ''
  if (!vis.tableta) datos['data-oculto-tableta'] = ''
  if (!vis.celular) datos['data-oculto-celular'] = ''

  const e = leerEstiloSeccion(settings)

  // ── Espaciado y ancho: rellenan el contrato de estilo de `content` ──
  if (e.espaciado) {
    if (vacio(contenido.padding_top)) contenido.padding_top = PADDING_POR_ESPACIADO[e.espaciado]
    if (vacio(contenido.padding_bottom)) contenido.padding_bottom = PADDING_POR_ESPACIADO[e.espaciado]
  }
  if (e.ancho && contenido.full_bleed === undefined && contenido.container_width === undefined) {
    contenido.full_bleed = e.ancho === 'completo'
  }

  // ── Fondo: solo si el Avanzado no fijó uno (bg_type) ni hay color viejo en settings ──
  const avanzadoConFondo = !vacio(contenido.bg_type) && contenido.bg_type !== 'none'
  const fondoViejo = !vacio(settings?.bg_color)
  if (e.fondo && e.fondo !== 'tema' && !avanzadoConFondo && !fondoViejo) {
    if (e.fondo === 'imagen') {
      // La imagen es la de la sección (`bg_image` del Avanzado); sin imagen, queda el del tema.
      if (typeof contenido.bg_image === 'string' && contenido.bg_image) contenido.bg_type = 'image'
    } else {
      datos['data-seccion-fondo'] = e.fondo
    }
  }

  // ── Entrada al aparecer (la activa EntradaSeccion en el cliente) ──
  if (e.entrada && e.entrada !== 'ninguna') datos['data-seccion-entrada'] = e.entrada

  // ── Tipografía y colores ──
  const vars = { ...variablesCssSeccion(e, 'computador'), ...variablesCelular(e) }
  for (const [k, v] of Object.entries(vars)) {
    variables[k] = v
    // `--seccion-tamano-titulo-movil` no lleva atributo propio: lo lee la regla del tamaño.
    if (!k.endsWith('-movil')) datos[`data-${k.slice(2)}`] = ''
  }
  if (e.tipografia?.modo === 'propia') {
    const roles = [['titulo', e.tipografia.titulo], ['texto', e.tipografia.texto]] as const
    for (const [rol, t] of roles) {
      const fuente = t?.fuente
      if (typeof fuente !== 'string' || fuente.startsWith('tema:')) continue
      const segura = familiaSegura(fuente)
      if (segura) {
        fuentes.push(segura)
      } else {
        // Familia que no se puede escribir en CSS sin escapar: se queda la del sitio.
        delete variables[`--seccion-fuente-${rol}`]
        delete datos[`data-seccion-fuente-${rol}`]
      }
    }
  }

  return { contenido, datos, variables, fuentes, oculta }
}
