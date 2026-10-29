/**
 * URL del buscador de productos para los componentes del navegador.
 *
 * No lleva la organización: `/api/products/search` la resuelve por el host (getOrgContext).
 * Solo en localhost se reenvían `subdomain` y `outlet` de la página, que es como el middleware
 * simula el host en desarrollo (fuera de localhost los ignora).
 *
 * `categoria` (slug, opcional) limita las sugerencias a esa categoría y sus subcategorías.
 */
export function urlBusquedaProductos(q: string, categoria?: string | null): string {
  const params = new URLSearchParams({ q })
  if (categoria) params.set('categoria', categoria)
  reenviarSimulacionLocal(params)
  return `/api/products/search?${params.toString()}`
}

/**
 * Página de resultados (`/search?q=…&categoria=…`). Sin prefijo de sede: quien llama lo pone
 * con `ruta()` de `useRutaSitio`.
 */
export function urlResultadosBusqueda(q: string, categoria?: string | null): string {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (categoria) params.set('categoria', categoria)
  reenviarSimulacionLocal(params)
  const qs = params.toString()
  return `/search${qs ? `?${qs}` : ''}`
}

function reenviarSimulacionLocal(params: URLSearchParams) {
  if (typeof window !== 'undefined' && window.location.hostname.includes('localhost')) {
    const pagina = new URLSearchParams(window.location.search)
    for (const nombre of ['subdomain', 'outlet']) {
      const valor = pagina.get(nombre)
      if (valor) params.set(nombre, valor)
    }
  }
}
