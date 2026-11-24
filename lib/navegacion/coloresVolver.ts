/**
 * Colores del botón «Volver» con el color de la tienda (decisión del dueño, 2026-11-24): fondo
 * tenue del color principal y la flecha en ese color, corregida hasta leerse sobre el fondo.
 * Usa las utilidades de contraste del sitio (`contrasteColor`, `textoSobreAcento`).
 *
 * Sin un hex válido (color raro o ausente), `null`: quien llama pinta el botón «Neutro» del Figma
 * (borde gris, flecha oscura).
 */
import { CONTRASTE_AA_GRANDE, ajustarHastaContraste, contraste, mezclarHex, normalizarHex } from '@/lib/website/v2/contrasteColor'
import { fondoOscuro, textoSobreAcento } from '@/lib/website/v2/textoSobreAcento'

/** Un ícono de interfaz pide 3:1 contra su fondo (WCAG 1.4.11). */
const MINIMO_ICONO = CONTRASTE_AA_GRANDE

export interface ColoresBotonVolver {
  /** Fondo tenue sobre página clara (Figma 2983:72584: #FDF1E6 con #E8892F). */
  fondo: string
  flecha: string
  /** Lo mismo sobre página oscura (sitios en modo oscuro). */
  fondoOscuro: string
  flechaOscura: string
  /** Borde al pasar el mouse: el color de la tienda. */
  borde: string
}

export function coloresBotonVolver(primario: string | null | undefined): ColoresBotonVolver | null {
  const p = normalizarHex(primario)
  if (!p) return null
  const fondo = mezclarHex(p, '#FFFFFF', 0.88)
  const fondoOsc = mezclarHex(p, '#111827', 0.78)
  return {
    fondo,
    flecha: ajustarHastaContraste(p, fondo, MINIMO_ICONO) ?? p,
    fondoOscuro: fondoOsc,
    flechaOscura: ajustarHastaContraste(p, fondoOsc, MINIMO_ICONO) ?? p,
    borde: p,
  }
}

export interface ColoresBarraVolver {
  /** `oscura`: la barra toma el fondo de la cabecera; `clara`: blanca con borde (Figma 2992:75028). */
  tono: 'oscura' | 'clara'
  /** Fondo de la barra (solo con cabecera de color propio). */
  fondo: string | null
  /** «Neveras» y los íconos. */
  texto: string | null
  /** «Volver a». */
  textoSecundario: string | null
  /** La flecha: el color de la tienda si se lee sobre la barra; si no, el del texto. */
  flecha: string | null
  /** Caja tenue detrás de la flecha (solo en la barra clara). */
  caja: ColoresBotonVolver | null
}

/**
 * Barra «← Volver a …» del celular: usa el color de la cabecera (`header_bg_color`). Sin color de
 * cabecera, la barra clara (o la oscura del modo oscuro, por clases) con la caja del color de la
 * tienda.
 */
export function coloresBarraVolver(colorCabecera: string | null | undefined, primario: string | null | undefined): ColoresBarraVolver {
  const cab = normalizarHex(colorCabecera)
  const p = normalizarHex(primario)
  const caja = coloresBotonVolver(p)
  if (cab && fondoOscuro(cab)) {
    const texto = textoSobreAcento(cab)
    const flecha = p && (contraste(p, cab) ?? 0) >= MINIMO_ICONO ? p : texto
    return { tono: 'oscura', fondo: cab, texto, textoSecundario: mezclarHex(texto, cab, 0.25), flecha, caja: null }
  }
  if (cab) {
    const texto = textoSobreAcento(cab)
    return { tono: 'clara', fondo: cab, texto, textoSecundario: mezclarHex(texto, cab, 0.4), flecha: caja?.flecha ?? null, caja }
  }
  return { tono: 'clara', fondo: null, texto: null, textoSecundario: null, flecha: caja?.flecha ?? null, caja }
}

/** `header_bg_color` de los ajustes del sitio (el mismo que pinta la cabecera); `null` sin él. */
export function colorCabeceraDe(ajustes: unknown): string | null {
  const valor = (ajustes as { header_bg_color?: unknown } | null | undefined)?.header_bg_color
  return typeof valor === 'string' && normalizarHex(valor) ? valor : null
}
