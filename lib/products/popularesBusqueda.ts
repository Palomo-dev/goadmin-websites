/** Sugerencias reales: ventas acumuladas del catálogo visible, sin términos ajenos a la tienda. */
export function popularesBusqueda(productos: readonly { name?: string | null; sales_count?: number | null }[], limite = 5): string[] {
  const vistos = new Set<string>()
  return [...productos]
    .filter((p) => typeof p.name === 'string' && p.name.trim() && Number(p.sales_count) > 0)
    .sort((a, b) => Number(b.sales_count) - Number(a.sales_count) || String(a.name).localeCompare(String(b.name), 'es'))
    .flatMap((p) => {
      const nombre = p.name!.trim()
      const clave = nombre.toLocaleLowerCase('es')
      if (vistos.has(clave)) return []
      vistos.add(clave)
      return [nombre]
    })
    .slice(0, limite)
}
