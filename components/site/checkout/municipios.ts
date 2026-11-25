/**
 * Buscador de «Ciudad o municipio» del checkout v2 (Figma «16 Sitio web» › Checkout v2, A1b
 * 3138-92776 y pieza 3138-92609): lista oficial (DANE, tabla `municipalities`) con buscador, sin
 * mapas ni geolocalización paga. Filtra en el navegador, sin tildes ni mayúsculas, primero lo que
 * empieza por lo escrito y luego lo que lo contiene.
 *
 * Puro (sin React ni imports): lo usan `MunicipioBuscador.tsx` y `scripts/verify-checkout-v2.mjs`.
 */

export interface Municipio {
  code: string
  name: string
  state_code: string
  state_name: string
}

/** Sin tildes, en minúsculas y sin espacios de más («Bogotá, D.C.» → «bogota, d.c.»). */
export function normalizarTexto(t: string): string {
  return (t || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** «Envigado · Antioquia»; Bogotá sale una sola vez (su departamento se llama igual). */
export function etiquetaMunicipio(m: Municipio): string {
  return normalizarTexto(m.name) === normalizarTexto(m.state_name) || !m.state_name ? m.name : `${m.name} · ${m.state_name}`
}

/**
 * Municipios que coinciden con lo escrito: primero los que empiezan así (por nombre), luego los que
 * lo contienen o cuyo departamento empieza así. Sin texto: las capitales más pedidas primero.
 */
export function buscarMunicipios(lista: readonly Municipio[], consulta: string, max = 8): Municipio[] {
  const q = normalizarTexto(consulta)
  if (!q) {
    const preferidos = ['11001', '05001', '76001', '08001', '13001', '68001']
    const arriba = preferidos.map((c) => lista.find((m) => m.code === c)).filter((m): m is Municipio => !!m)
    return [...arriba, ...lista.filter((m) => !preferidos.includes(m.code))].slice(0, max)
  }
  const empieza: Municipio[] = []
  const contiene: Municipio[] = []
  for (const m of lista) {
    const n = normalizarTexto(m.name)
    if (n.startsWith(q)) empieza.push(m)
    else if (n.includes(q) || normalizarTexto(m.state_name).startsWith(q) || normalizarTexto(`${m.name} ${m.state_name}`).includes(q)) contiene.push(m)
  }
  return [...empieza, ...contiene].slice(0, max)
}

/**
 * El municipio que corresponde a lo que ya hay guardado (ciudad y, si se sabe, departamento). Sirve
 * para reconocer «Medellín» escrito a mano o guardado de antes. null si no hay uno solo.
 */
export function municipioExacto(lista: readonly Municipio[], ciudad: string, stateCode?: string | null): Municipio | null {
  const c = normalizarTexto(ciudad)
  if (!c) return null
  const iguales = lista.filter((m) => normalizarTexto(m.name) === c || normalizarTexto(etiquetaMunicipio(m)) === c || normalizarTexto(m.name.split(',')[0]) === c)
  const delDepto = stateCode ? iguales.filter((m) => m.state_code === stateCode) : iguales
  if (delDepto.length === 1) return delDepto[0]
  if (!stateCode && iguales.length > 1) {
    // Nombre repetido en varios departamentos (p. ej. «Barbosa»): no se adivina.
    return null
  }
  return delDepto[0] ?? null
}

// ─── Carga del país y de la lista (una sola petición, nunca «Cargando» para siempre) ───────────

/** País por defecto cuando no se detecta (en localhost /api/locations/detect responde null). */
export const PAIS_POR_DEFECTO = 'COL'

/** Alfa-2 que puede llegar de otra parte → alfa-3 de la tabla `countries` (la de `municipalities`). */
const ALFA2_A_ALFA3: Readonly<Record<string, string>> = {
  CO: 'COL', MX: 'MEX', US: 'USA', CL: 'CHL', BR: 'BRA', ES: 'ESP', CA: 'CAN', GB: 'GBR', JP: 'JPN', AU: 'AUS',
}

/**
 * Código de país para pedir la lista: alfa-3 en mayúsculas («COL»). Un alfa-2 conocido se traduce
 * («CO» → «COL»). Vacío o con otra forma: null (nunca se pide la lista sin país).
 */
export function paisParaLista(codigo: string | null | undefined): string | null {
  const c = (codigo || '').trim().toUpperCase()
  if (/^[A-Z]{3}$/.test(c)) return c
  if (/^[A-Z]{2}$/.test(c)) return ALFA2_A_ALFA3[c] ?? null
  return null
}

type Pedir = (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>

/** La promesa, o el valor de respaldo si tarda más de `ms` o falla: nunca queda colgada. */
function conEspera<T>(p: Promise<T>, ms: number, respaldo: T): Promise<T> {
  return new Promise<T>((resolver) => {
    const t = setTimeout(() => resolver(respaldo), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolver(v)
      },
      () => {
        clearTimeout(t)
        resolver(respaldo)
      },
    )
  })
}

/**
 * Cargador de la página: el país del visitante se pregunta UNA vez y la lista de cada país se pide
 * UNA vez, aunque el campo se monte varias veces (React en modo estricto, 1 paso que pliega y
 * despliega, cambio de entrega). Las promesas siempre terminan:
 * - país: el detectado (alfa-3); si es null, falla o tarda, `PAIS_POR_DEFECTO`;
 * - lista: los municipios; si la respuesta no es 200, falla o tarda, `[]` (el campo pasa a los
 *   campos de siempre, con texto libre).
 */
export function crearCargadorUbicacion(pedir: Pedir, esperaPaisMs = 3000, esperaListaMs = 8000) {
  let pais: Promise<string> | null = null
  const listas = new Map<string, Promise<Municipio[]>>()
  return {
    pais(): Promise<string> {
      pais ??= conEspera(
        pedir('/api/locations/detect')
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => paisParaLista((d as { country_code?: unknown } | null)?.country_code as string | null) ?? PAIS_POR_DEFECTO),
        esperaPaisMs,
        PAIS_POR_DEFECTO,
      )
      return pais
    },
    municipios(codigo: string | null | undefined): Promise<Municipio[]> {
      const c = paisParaLista(codigo)
      if (!c) return Promise.resolve([])
      let p = listas.get(c)
      if (!p) {
        p = conEspera(
          pedir(`/api/locations/municipios?country_code=${encodeURIComponent(c)}`)
            .then((r) => (r.ok ? r.json() : []))
            .then((d) => (Array.isArray(d) ? (d as Municipio[]) : [])),
          esperaListaMs,
          [] as Municipio[],
        )
        listas.set(c, p)
      }
      return p
    },
  }
}
