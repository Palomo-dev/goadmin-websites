/**
 * Nombre de una mesa de restaurante: cómo se compara y cómo se muestra. Puro (sin React ni
 * Supabase): lo usan el servidor (`lib/orders/mesaPedido.ts`) y el navegador (checkout,
 * confirmación y seguimiento).
 *
 * Los nombres reales ya traen la palabra: en `restaurant_tables` todas las mesas se llaman
 * «Mesa 4», «Mesa A1»… (MCP 2026-10-06: ninguna sin el prefijo, máximo 30 por organización). El
 * cliente que escribe su mesa a mano pone «4», «mesa 4» o «MESA-4», y el QR antiguo trae
 * «MESA-5».
 */

/**
 * Clave de comparación: sin tildes, sin mayúsculas, sin la palabra «mesa» al inicio, sin espacios
 * ni signos y sin ceros a la izquierda en un número. «Mesa 04», «mesa-4» y «4» → «4»;
 * «Mesa A1» y «a1» → «a1». `''` si no queda nada («Mesa»).
 */
export function claveNombreMesa(valor: string): string {
  const simple = valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  const sinPalabra = simple.replace(/^mesa(?:\s+|(?=\d)|$)/, '')
  return sinPalabra.replace(/\s+/g, '').replace(/^0+(?=\d)/, '')
}

/** «Mesa 4» para mostrar, sin repetir la palabra si el nombre ya la trae («Mesa Mesa 4»). */
export function etiquetaMesa(nombre: string | null | undefined): string {
  const n = (nombre ?? '').trim()
  if (!n) return 'Mesa'
  return /^mesa(?:\b|\d)/i.test(n) ? n : `Mesa ${n}`
}
