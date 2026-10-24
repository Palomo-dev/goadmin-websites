export const INTERVALO_PRESENCIA_MS = 30_000

export function rutaPresencia(valor: unknown): string | null {
  if (typeof valor !== 'string' || !valor.startsWith('/') || valor.startsWith('//') || /[?#\u0000-\u001f]/.test(valor)) return null
  // El enlace privado del lienzo nunca se guarda ni divide los conteos de una página.
  const ruta = valor.replace(/^\/vista-previa\/[^/]+(?=\/|$)/, '') || '/'
  if (ruta.length > 500 || ruta.startsWith('//')) return null
  return ruta.replace(/\/+$/, '') || '/'
}

export function sesionPresenciaValida(valor: unknown): valor is string {
  return typeof valor === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor)
}
