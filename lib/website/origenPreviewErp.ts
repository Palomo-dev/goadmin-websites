/**
 * Previews de Vercel del proyecto del ERP en el equipo de Juan (rama `go-admin-erp-git-<rama>` o
 * despliegue `go-admin-<hash>`). Regex anclada: solo https, solo ese equipo, sin subdominios extra.
 * La lista fija de orígenes del editor no cambia; esto solo se suma a ella.
 */
export const PREVIEW_ERP_VERCEL = /^https:\/\/go-admin-(erp-git-[a-z0-9-]+|[a-z0-9]+)-juan-camilo-gallegos-projects\.vercel\.app$/

export function esPreviewErpVercel(origen: string): boolean {
  return typeof origen === 'string' && PREVIEW_ERP_VERCEL.test(origen)
}
