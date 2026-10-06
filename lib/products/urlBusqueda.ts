/**
 * URL del buscador de productos para los componentes del navegador.
 *
 * No lleva la organización: `/api/products/search` la resuelve por el host (getOrgContext).
 * Solo en localhost se reenvían `subdomain` y `outlet` de la página, que es como el middleware
 * simula el host en desarrollo (fuera de localhost los ignora).
 */
export function urlBusquedaProductos(q: string): string {
  const params = new URLSearchParams({ q })
  if (typeof window !== 'undefined' && window.location.hostname.includes('localhost')) {
    const pagina = new URLSearchParams(window.location.search)
    for (const nombre of ['subdomain', 'outlet']) {
      const valor = pagina.get(nombre)
      if (valor) params.set(nombre, valor)
    }
  }
  return `/api/products/search?${params.toString()}`
}
