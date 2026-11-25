/**
 * Rastreo público del pedido con los datos de logística (Fase 1, Figma 2804:13320 celular,
 * 2820:45611 «Ayuda» abierta y 2804:13427 escritorio). Puro: la ruta de tracking, la página y
 * scripts/verify-zonas-envio.mjs.
 *
 * Reglas de privacidad (la ruta las aplica con esto):
 * - Domiciliario: solo el primer nombre (la RPC `logistica_rastreo_publico` ya lo recorta).
 * - Código de entrega: solo si el envío es contraentrega, solo con el token válido del enlace y
 *   solo mientras está en curso (la RPC lo devuelve solo en esos estados).
 * - Dirección: incompleta («Cra 45 #12-… · Chapinero, Bogotá») y solo con el token.
 */

export const ETIQUETA_EVENTO: Record<string, string> = {
  created: 'Pedido confirmado',
  ready_for_pickup: 'Pedido listo',
  assigned: 'Domiciliario asignado',
  picked: 'Recogido',
  in_transit: 'En tránsito',
  out_for_delivery: 'Salió de la tienda',
  failed_attempt: 'No pudimos entregarlo',
  delivered: 'Entregado',
  exception: 'Novedad en la entrega',
  returned: 'Devuelto a la tienda',
  cancelled: 'Envío cancelado',
}

export const MOTIVO_NOVEDAD: Record<string, string> = {
  not_home: 'No había nadie para recibirlo',
  wrong_address: 'La dirección no corresponde',
  incomplete_address: 'Faltan datos en la dirección',
  rejected: 'El pedido fue rechazado al entregarlo',
  damaged: 'El paquete se dañó',
  lost: 'El paquete se extravió',
  access_denied: 'No nos dejaron entrar',
  business_closed: 'El lugar estaba cerrado',
  weather: 'El clima no lo permitió',
  vehicle_issue: 'Tuvimos un problema con el vehículo',
  customer_request: 'Pediste cambiar la entrega',
  other: 'Tuvimos un inconveniente',
}

export interface EventoRastreo {
  estado: string
  etiqueta: string
  fecha: string | null
  motivo: string | null
}

export interface RastreoLogistica {
  estado: string
  /** `own` = domiciliario de la tienda. */
  modo: string | null
  domiciliario: string | null
  /** `date` (sin zona): se muestra con la fecha calendario tal cual. */
  fechaEstimada: string | null
  novedad: string | null
  contraentrega: { monto: number; moneda: string | null; pendiente: boolean } | null
  codigoEntrega: string | null
  eventos: EventoRastreo[]
}

const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

/** Respuesta de `logistica_rastreo_publico` → lo que puede ver el cliente. `verificado` = token válido. */
export function leerRastreoLogistica(crudo: unknown, verificado: boolean): RastreoLogistica | null {
  if (!crudo || typeof crudo !== 'object') return null
  const r = crudo as Record<string, unknown>
  const estado = texto(r.estado)
  if (!estado) return null
  const cod = r.contraentrega && typeof r.contraentrega === 'object' ? (r.contraentrega as Record<string, unknown>) : null
  const monto = cod ? Number(cod.monto) || 0 : 0
  const eventos = Array.isArray(r.eventos) ? (r.eventos as Record<string, unknown>[]) : []
  const motivo = texto(r.motivo_novedad)
  const codigo = verificado && cod ? texto(cod.codigo_entrega) : null
  return {
    estado,
    modo: texto(r.modo),
    domiciliario: texto(r.domiciliario)?.split(/\s+/)[0] ?? null,
    fechaEstimada: texto(r.fecha_estimada),
    novedad: motivo ? MOTIVO_NOVEDAD[motivo] ?? MOTIVO_NOVEDAD.other : null,
    contraentrega: monto > 0 ? { monto, moneda: texto(cod?.moneda), pendiente: texto(cod?.estado) === 'pending' } : null,
    codigoEntrega: codigo && /^\d{4}$/.test(codigo) ? codigo : null,
    eventos: eventos
      .map((e) => {
        const est = texto(e.estado) ?? ''
        const mot = texto(e.motivo)
        return { estado: est, etiqueta: ETIQUETA_EVENTO[est] ?? est, fecha: texto(e.fecha), motivo: mot ? MOTIVO_NOVEDAD[mot] ?? null : null }
      })
      .filter((e) => e.estado),
  }
}

/**
 * «Cra 45 #12-34 apto 502» → «Cra 45 #12-…»: la calle y la placa sin el resto. Sin «#», las dos
 * primeras palabras y «…». Vacío → null.
 */
export function direccionIncompleta(dir: unknown): string | null {
  const d = dir && typeof dir === 'object' ? (dir as Record<string, unknown>) : {}
  const calle = texto(d.address)
  let corta: string | null = null
  if (calle) {
    const m = /^(.*?#\s*\d+)/.exec(calle)
    corta = m ? `${m[1].trim()}-…` : `${calle.split(/\s+/).slice(0, 2).join(' ')}…`
  }
  const lugar = [texto(d.neighborhood), texto(d.city)].filter(Boolean).join(', ')
  const partes = [corta, lugar].filter(Boolean)
  return partes.length ? partes.join(' · ') : null
}

/**
 * «Cra 45 #12-34 apto 502 · Chapinero, Bogotá, Cundinamarca»: la dirección entera. Solo para quien
 * ya probó que el pedido es suyo (número + correo o teléfono en /consultar-pedido) y con el token
 * válido (la ruta solo entrega `deliveryAddress` con él). Texto suelto (pedidos viejos): tal cual.
 * Vacío → null.
 */
export function direccionCompleta(dir: unknown): string | null {
  if (typeof dir === 'string') return texto(dir)
  const d = dir && typeof dir === 'object' ? (dir as Record<string, unknown>) : {}
  const departamento = texto(d.department) ?? texto(d.state)
  const ciudad = texto(d.city)
  const lugar = [texto(d.neighborhood), ciudad, departamento && departamento !== ciudad ? departamento : null].filter(Boolean).join(', ')
  const partes = [texto(d.address), lugar].filter(Boolean)
  return partes.length ? partes.join(' · ') : null
}

export interface CanalesAyuda {
  whatsapp: string | null
  telefono: string | null
  correo: string | null
}

/** wa.me con el mensaje ya escrito y el número del pedido; null sin número válido. */
export function enlaceWhatsApp(numero: string | null, pedido: string): string | null {
  const digitos = (numero ?? '').replace(/\D/g, '')
  if (digitos.length < 7) return null
  return `https://wa.me/${digitos}?text=${encodeURIComponent(`Hola, tengo una pregunta sobre mi pedido ${pedido}.`)}`
}
