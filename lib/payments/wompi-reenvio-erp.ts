/**
 * Reenvío al ERP de los eventos de Wompi que no son de la tienda.
 *
 * Wompi admite UNA sola «URL de eventos» por comercio y ambiente. Decisión del dueño
 * (2026-11-08): esa URL es la de la tienda (`https://{dominio}/api/webhooks/wompi_co`), y la
 * tienda pasa al ERP —cuerpo crudo y cabeceras de firma intactos— todo evento cuya referencia
 * no reconoce (sesiones QR del POS y del folio, links de pago, pagos pendientes del ERP).
 *
 * Seguridad:
 *  - La tienda NO decide la organización ni valida nada por el ERP: el ERP identifica la
 *    conexión POR LA FIRMA (checksum con el `events_secret` de cada conexión Wompi), igual que
 *    si Wompi le hubiera llamado directo. No se le manda host ni organización en cabeceras.
 *  - Nunca se reenvía algo que ya vino reenviado (cabecera `x-goadmin-reenviado`): una URL del
 *    ERP mal configurada que apunte a la tienda no forma un ciclo. Que un tercero ponga esa
 *    cabecera solo evita el reenvío (= la respuesta 404 de siempre).
 *  - Un solo intento, con tiempo límite. Si el ERP falla (5xx, caído o tarda), se responde 5xx
 *    para que sea Wompi quien reintente.
 *  - En los registros solo van referencia, estado HTTP y duración: nunca el cuerpo, la firma,
 *    secretos ni cabeceras de autorización.
 */

/** Cabecera que marca un evento ya reenviado por la tienda. */
export const CABECERA_REENVIADO = 'x-goadmin-reenviado'

/** Receptor de Wompi en el ERP (`go-admin-erp/src/app/api/integrations/wompi/webhook/route.ts`). */
export const RUTA_WEBHOOK_WOMPI_ERP = '/api/integrations/wompi/webhook'

/** Tiempo límite del reenvío. Wompi espera la respuesta; no conviene acercarse a su límite. */
export const TIEMPO_LIMITE_REENVIO_MS = 8000

/** Un evento de Wompi pesa ~2 KB. Algo mucho mayor no es de Wompi: no se reenvía. */
export const TAMANO_MAXIMO_REENVIO = 256 * 1024

/** Las únicas cabeceras que viajan al ERP. Ni cookies, ni `authorization`, ni `host`. */
const CABECERAS_QUE_VIAJAN = ['content-type', 'x-event-checksum', 'user-agent'] as const

/** Misma base que `lib/erp-auto-confirm.ts` y compañía: `NEXT_PUBLIC_APP_URL` o la del ERP. */
const ERP_POR_DEFECTO = 'https://app.goadmin.io'

/**
 * URL del receptor de Wompi del ERP. Solo https (http únicamente contra localhost, para
 * desarrollo). `null` si la base configurada no es una URL válida.
 */
export function urlWebhookWompiErp(base: string | undefined = process.env.NEXT_PUBLIC_APP_URL): string | null {
  const valor = (base ?? '').trim() || ERP_POR_DEFECTO
  let url: URL
  try {
    url = new URL(valor)
  } catch {
    return null
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return null
  return `${url.origin}${RUTA_WEBHOOK_WOMPI_ERP}`
}

/** ¿El evento ya pasó por un reenvío de la tienda? */
export function yaReenviado(cabeceras: Headers): boolean {
  return cabeceras.has(CABECERA_REENVIADO)
}

/**
 * ¿Se reenvía al ERP? Solo cuando la búsqueda del pedido web terminó sin filas (sin error, o
 * PGRST116 de `.single()`) y el evento no viene ya reenviado. Un error real de la base no se
 * reenvía: podría ser un pedido de la tienda y el ERP lo daría por recibido (200), con lo que
 * Wompi dejaría de reintentar.
 */
export function debeReenviarAlErp(p: { pedido: unknown; error: unknown; cabeceras: Headers }): boolean {
  if (p.pedido) return false
  const codigo = p.error && typeof p.error === 'object' ? (p.error as { code?: unknown }).code : undefined
  if (p.error && codigo !== 'PGRST116') return false
  return !yaReenviado(p.cabeceras)
}

export interface RespuestaReenvio {
  /** Código que se le devuelve a Wompi. */
  status: number
  /** Cuerpo que se le devuelve a Wompi (el del ERP cuando respondió). */
  cuerpo: string
  contentType: string
  /** `true` si el evento llegó al ERP (respondiera lo que respondiera). */
  reenviado: boolean
}

export interface ParametrosReenvio {
  /** Bytes exactos que mandó Wompi (`new Uint8Array(await request.arrayBuffer())`). */
  cuerpo: Uint8Array<ArrayBuffer>
  /** Cabeceras de la petición de Wompi. */
  cabeceras: Headers
  /** Host por el que entró la petición (para no reenviarse a sí misma). */
  hostEntrante: string | null
  /** Solo para el registro. */
  referencia?: string | null
  /** Inyectables para las pruebas. */
  url?: string | null
  fetchImpl?: typeof fetch
  tiempoLimiteMs?: number
}

const json = (status: number, cuerpo: Record<string, unknown>, reenviado = false): RespuestaReenvio => ({
  status,
  cuerpo: JSON.stringify(cuerpo),
  contentType: 'application/json',
  reenviado,
})

/**
 * Reenvía el evento al ERP y devuelve lo que hay que contestarle a Wompi.
 *  - ERP 2xx/4xx → ese mismo código y cuerpo (un 401 del ERP = ninguna conexión firmó).
 *  - ERP 5xx → ese 5xx (Wompi reintenta).
 *  - ERP caído o sin respuesta a tiempo → 502 / 504 (Wompi reintenta).
 *  - Sin URL válida del ERP → 503 (Wompi reintenta; es configuración).
 */
export async function reenviarWompiAlErp(p: ParametrosReenvio): Promise<RespuestaReenvio> {
  const ref = p.referencia ? String(p.referencia).slice(0, 80) : '(sin referencia)'
  const url = p.url === undefined ? urlWebhookWompiErp() : p.url

  if (!url) {
    console.error(`[Wompi Reenvío] ref=${ref}: NEXT_PUBLIC_APP_URL no es una URL válida del ERP; no se reenvía`)
    return json(503, { error: 'Reenvío al ERP no configurado' })
  }
  if (p.cuerpo.byteLength > TAMANO_MAXIMO_REENVIO) {
    console.error(`[Wompi Reenvío] ref=${ref}: cuerpo de ${p.cuerpo.byteLength} bytes; no se reenvía`)
    return json(413, { error: 'Evento demasiado grande' })
  }
  const destino = new URL(url)
  const host = (p.hostEntrante ?? '').trim().toLowerCase().replace(/:\d+$/, '')
  if (host && destino.hostname.toLowerCase() === host) {
    // La URL del ERP apunta a esta misma tienda: reenviar sería hablarse a sí misma.
    console.error(`[Wompi Reenvío] ref=${ref}: la URL del ERP es este mismo host; no se reenvía`)
    return json(404, { error: 'Orden no encontrada', reference: p.referencia ?? null })
  }

  const cabeceras = new Headers()
  for (const nombre of CABECERAS_QUE_VIAJAN) {
    const valor = p.cabeceras.get(nombre)
    if (valor) cabeceras.set(nombre, valor)
  }
  if (!cabeceras.has('content-type')) cabeceras.set('content-type', 'application/json')
  cabeceras.set(CABECERA_REENVIADO, 'wompi_co')

  const controlador = new AbortController()
  const limite = setTimeout(() => controlador.abort(), p.tiempoLimiteMs ?? TIEMPO_LIMITE_REENVIO_MS)
  const inicio = Date.now()
  try {
    const res = await (p.fetchImpl ?? fetch)(url, {
      method: 'POST',
      headers: cabeceras,
      body: p.cuerpo,
      signal: controlador.signal,
      redirect: 'manual',
      cache: 'no-store',
    })
    const cuerpo = await res.text()
    const ms = Date.now() - inicio
    if (res.status >= 500) {
      console.error(`[Wompi Reenvío] ref=${ref} → ERP ${res.status} en ${ms} ms; Wompi reintentará`)
    } else {
      console.log(`[Wompi Reenvío] ref=${ref} → ERP ${res.status} en ${ms} ms`)
    }
    // Una redirección no es una respuesta del receptor: que Wompi reintente.
    const status = res.status >= 300 && res.status < 400 ? 502 : res.status
    return {
      status,
      cuerpo: status === res.status ? cuerpo : JSON.stringify({ error: 'El ERP respondió con una redirección' }),
      contentType: status === res.status ? res.headers.get('content-type') || 'application/json' : 'application/json',
      reenviado: true,
    }
  } catch (err) {
    const ms = Date.now() - inicio
    const tiempoAgotado = controlador.signal.aborted
    console.error(
      `[Wompi Reenvío] ref=${ref}: ${tiempoAgotado ? 'el ERP no respondió a tiempo' : 'no se pudo llegar al ERP'} (${ms} ms); Wompi reintentará`
    )
    return json(tiempoAgotado ? 504 : 502, { error: 'ERP no disponible' })
  } finally {
    clearTimeout(limite)
  }
}
