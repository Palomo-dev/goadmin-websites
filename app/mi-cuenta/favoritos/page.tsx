import { redirect } from 'next/navigation'

/**
 * Los favoritos viven ahora en la página pública /favoritos (Figma 2764:61164, aprobado
 * 2026-11-22), con o sin sesión. Esta ruta queda para los enlaces viejos.
 */
export default function FavoritosCuentaPage(): never {
  redirect('/favoritos')
}
