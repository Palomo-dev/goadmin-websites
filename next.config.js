/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Supabase Storage sirve las imágenes con `cache-control: public, max-age=3600`.
    // Vercel usa max(minimumCacheTTL, max-age del origen) como TTL de la imagen
    // optimizada, y factura una transformación en cada MISS *y* en cada STALE.
    // Sin esto el TTL efectivo era 1 hora => cada variante se re-transformaba y
    // se re-facturaba cada hora (~1.1M transformaciones / 8 días).
    // Los archivos llevan timestamp en el nombre (scraped_<ts>_0.png), así que una
    // imagen nueva siempre es una URL nueva: no hay riesgo de servir contenido viejo.
    minimumCacheTTL: 2678400, // 31 días

    // Un solo formato => una transformación por variante en vez de dos.
    formats: ['image/webp'],

    // Por defecto Next incluye también 2048 y 3840. Son fotos de producto dentro de
    // grillas (sizes máximo 100vw), nunca se ven a 4K, pero sí entran en el srcset y
    // los bots las piden. 3840px era el 12% de las transformaciones.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],

    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'jgmgphmzusbluqhuqihj.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

module.exports = nextConfig
