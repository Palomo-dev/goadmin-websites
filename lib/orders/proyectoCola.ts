/**
 * Proyecto de Vercel que envía los correos de las colas del sitio.
 *
 * Dos proyectos de Vercel comparten este repositorio (y su `vercel.json`). Solo
 * `goadmin-websites` (alias 8fs1) envía; el otro responde `otro_proyecto` sin tocar nada.
 * Si `VERCEL_PROJECT_ID` no está expuesto, no se puede saber: se procesa, y el reclamo en la
 * base (fila del registro o sello del pedido) es lo que evita el doble envío.
 */

export const PROYECTO_COLAS_CORREO = 'prj_VJXk9thDpwIrOGzc6K6SHTKROlhL'

export function otroProyecto(): boolean {
  const id = process.env.VERCEL_PROJECT_ID
  return !!id && id !== PROYECTO_COLAS_CORREO
}
