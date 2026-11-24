import { redirect } from 'next/navigation'

/**
 * /auth/reset-password — destino del enlace viejo de Supabase («Reset password»).
 *
 * Desde el 2026-11-24 la tienda ya no manda enlaces de Supabase: la contraseña se cambia con el
 * código de la tienda en /auth?tab=forgot (/api/auth/forgot-password y …/restablecer). Un enlace
 * viejo que alguien aún tenga en el correo lleva ahí.
 */
export default function ResetPasswordPage() {
  redirect('/auth?tab=forgot')
}
