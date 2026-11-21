/**
 * Botón de pagos de Bold en el navegador (integración personalizada documentada por Bold:
 * developers.bold.co › Botón de pagos › Integración personalizada): `new BoldCheckout({...})`
 * y `checkout.open()`, que lleva al pago de Bold.
 *
 * Lo usan el checkout (abre Bold directo al tocar «Pagar», sin página intermedia) y la
 * página `/checkout/bold` (respaldo si el checkout no pudo abrirlo). La firma de integridad
 * la arma el servidor (`/api/checkout/init` → `buildBoldCheckout`).
 */

export const URL_LIBRERIA_BOLD = 'https://checkout.bold.co/library/boldPaymentButton.js'

export interface InstanciaBold {
  open: () => void
}
type ConstructorBold = new (config: Record<string, string>) => InstanciaBold

function constructorBold(): ConstructorBold | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { BoldCheckout?: ConstructorBold }
  return typeof w.BoldCheckout === 'function' ? w.BoldCheckout : null
}

let cargando: Promise<void> | null = null

/** Carga la librería una sola vez; resuelve cuando `BoldCheckout` existe. */
export function cargarLibreriaBold(): Promise<void> {
  if (constructorBold()) return Promise.resolve()
  if (cargando) return cargando
  cargando = new Promise<void>((resolve, reject) => {
    const listo = () => (constructorBold() ? resolve() : reject(new Error('BoldCheckout no disponible')))
    let script = document.querySelector<HTMLScriptElement>(`script[src="${URL_LIBRERIA_BOLD}"]`)
    if (script) {
      script.addEventListener('load', listo, { once: true })
      script.addEventListener('error', () => reject(new Error('No cargó la librería de Bold')), { once: true })
      // Ya había cargado antes de escuchar: comprobar en el siguiente ciclo.
      setTimeout(() => constructorBold() && resolve(), 0)
      return
    }
    script = document.createElement('script')
    script.src = URL_LIBRERIA_BOLD
    script.async = true
    script.onload = listo
    script.onerror = () => {
      script?.remove()
      reject(new Error('No cargó la librería de Bold'))
    }
    document.head.appendChild(script)
  }).catch((err) => {
    cargando = null // un fallo de red no deja la carga rota para siempre
    throw err
  })
  return cargando
}

/** Parámetros que `/api/checkout/init` pone en la URL de `/checkout/bold`. */
const CLAVES = ['orderId', 'amount', 'currency', 'apiKey', 'description', 'integritySignature', 'redirectionUrl', 'customerData', 'billingAddress'] as const

/** Configuración de `BoldCheckout` desde esos parámetros; null si falta lo obligatorio. */
export function configBoldDesdeParametros(p: URLSearchParams): Record<string, string> | null {
  const config: Record<string, string> = {}
  for (const k of CLAVES) {
    const v = p.get(k)
    if (v) config[k] = v
  }
  if (!config.currency) config.currency = 'COP'
  return config.apiKey && config.orderId && config.amount ? config : null
}

/** Crea el checkout de Bold (la librería ya debe estar cargada). */
export function crearCheckoutBold(config: Record<string, string>): InstanciaBold {
  const Bold = constructorBold()
  if (!Bold) throw new Error('BoldCheckout no disponible')
  return new Bold(config)
}

/**
 * Abre el pago de Bold desde la URL `/checkout/bold?...` que devolvió el servidor, sin pasar
 * por esa página. Devuelve false si no pudo (la pantalla entonces navega a la URL de respaldo).
 */
export async function abrirBoldDesdeUrl(url: string): Promise<boolean> {
  try {
    const u = new URL(url, window.location.origin)
    if (!u.pathname.endsWith('/checkout/bold')) return false
    const config = configBoldDesdeParametros(u.searchParams)
    if (!config) return false
    await cargarLibreriaBold()
    crearCheckoutBold(config).open()
    return true
  } catch (err) {
    console.error('[Bold] no se pudo abrir directo; se usa la página intermedia', err)
    return false
  }
}
