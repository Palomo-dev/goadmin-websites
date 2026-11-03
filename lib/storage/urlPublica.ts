/**
 * URL pública de un archivo de Storage.
 *
 * Si `path` ya es una URL completa (http/https) se devuelve tal cual, con
 * http pasado a https (imágenes recuperadas de otras tiendas). Si es una
 * ruta relativa se arma igual que siempre: `${base}/storage/v1/object/public/${bucket}/${path}`.
 */
const URL_COMPLETA = /^https?:\/\//i

export function esUrlCompleta(path: string | null | undefined): boolean {
  return typeof path === 'string' && URL_COMPLETA.test(path.trim())
}

export function urlPublicaStorage(path: string, bucket: string, base: string): string {
  if (esUrlCompleta(path)) return path.trim().replace(/^http:\/\//i, 'https://')
  const carpeta = bucket ? `${bucket}/` : ''
  return `${base}/storage/v1/object/public/${carpeta}${path}`
}
