import { createPublicClient } from './server'

const BUCKET_NAME = 'organization_images'

/**
 * Estructura de carpetas en el bucket:
 * /{organization_id}/logo/logo.png
 * /{organization_id}/favicon/favicon.ico
 * /{organization_id}/hero/hero.jpg
 * /{organization_id}/og/og-image.jpg
 * /{organization_id}/gallery/image1.jpg, image2.jpg...
 * /{organization_id}/products/{product_id}/image.jpg
 */

/**
 * Obtiene la URL pública de una imagen del storage
 */
export function getPublicImageUrl(path: string): string {
  const supabase = createPublicClient()
  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path)
  return data.publicUrl
}

/**
 * Obtiene las imágenes de una organización
 */
export async function getOrganizationImages(organizationId: number, folder: string = 'gallery') {
  const supabase = createPublicClient()
  
  const path = `${organizationId}/${folder}`
  
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(path, {
      limit: 50,
      sortBy: { column: 'created_at', order: 'desc' }
    })
  
  if (error || !data) return []
  
  return data
    .filter(file => !file.name.startsWith('.'))
    .map(file => ({
      name: file.name,
      url: getPublicImageUrl(`${path}/${file.name}`),
      size: file.metadata?.size || 0,
      created_at: file.created_at
    }))
}

/**
 * Obtiene el logo de una organización
 */
export async function getOrganizationLogo(organizationId: number): Promise<string | null> {
  const supabase = createPublicClient()
  
  const path = `${organizationId}/logo`
  
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(path, { limit: 1 })
  
  if (error || !data || data.length === 0) return null
  
  const logoFile = data.find(f => f.name.match(/\.(png|jpg|jpeg|svg|webp)$/i))
  if (!logoFile) return null
  
  return getPublicImageUrl(`${path}/${logoFile.name}`)
}

/**
 * Obtiene las imágenes de productos de una organización
 */
export async function getProductImages(organizationId: number, productId: number | string) {
  const supabase = createPublicClient()
  
  const path = `${organizationId}/products/${productId}`
  
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(path, {
      limit: 10,
      sortBy: { column: 'name', order: 'asc' }
    })
  
  if (error || !data) return []
  
  return data
    .filter(file => file.name.match(/\.(png|jpg|jpeg|webp|gif)$/i))
    .map(file => ({
      name: file.name,
      url: getPublicImageUrl(`${path}/${file.name}`)
    }))
}

/**
 * Obtiene la imagen de hero/banner de una organización
 */
export async function getHeroImage(organizationId: number): Promise<string | null> {
  const supabase = createPublicClient()
  
  const path = `${organizationId}/hero`
  
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(path, { limit: 1 })
  
  if (error || !data || data.length === 0) return null
  
  const heroFile = data.find(f => f.name.match(/\.(png|jpg|jpeg|webp)$/i))
  if (!heroFile) return null
  
  return getPublicImageUrl(`${path}/${heroFile.name}`)
}

/**
 * Genera una URL con transformaciones de imagen (resize, etc.)
 */
export function getTransformedImageUrl(
  path: string, 
  options: { width?: number; height?: number; quality?: number } = {}
): string {
  const supabase = createPublicClient()
  
  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path, {
    transform: {
      width: options.width || 800,
      height: options.height,
      quality: options.quality || 80
    }
  })
  
  return data.publicUrl
}
