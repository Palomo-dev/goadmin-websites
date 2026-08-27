/**
 * Rate limiter simple en memoria por IP.
 *
 * Mantiene un mapa de IP → timestamps de solicitudes recientes.
 * Si una IP excede `maxRequests` dentro de `windowMs`, se rechaza.
 *
 * Nota: esto es una protección básica para bots. Para producción a escala
 * se debería usar Upstash Redis o Vercel KV, pero esto cubre el caso
 * de uso de reservas (5/hora/IP) sin dependencias externas.
 */

interface RateLimitEntry {
  timestamps: number[]
}

const store = new Map<string, RateLimitEntry>()

// Limpiar entradas expiradas cada 10 minutos para evitar memory leak
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000
let lastCleanup = Date.now()

function cleanupExpired(windowMs: number) {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return
  lastCleanup = now
  for (const [ip, entry] of store.entries()) {
    entry.timestamps = entry.timestamps.filter(ts => now - ts < windowMs)
    if (entry.timestamps.length === 0) {
      store.delete(ip)
    }
  }
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number // timestamp ms
}

/**
 * Verifica si una IP puede hacer una solicitud.
 * @param ip - Dirección IP del cliente
 * @param maxRequests - Máximo de solicitudes permitidas
 * @param windowMs - Ventana de tiempo en milisegundos
 * @returns { allowed, remaining, resetAt }
 */
export function checkRateLimit(
  ip: string,
  maxRequests: number = 5,
  windowMs: number = 60 * 60 * 1000 // 1 hora por defecto
): RateLimitResult {
  cleanupExpired(windowMs)

  const now = Date.now()
  let entry = store.get(ip)

  if (!entry) {
    entry = { timestamps: [] }
    store.set(ip, entry)
  }

  // Filtrar timestamps dentro de la ventana
  entry.timestamps = entry.timestamps.filter(ts => now - ts < windowMs)

  if (entry.timestamps.length >= maxRequests) {
    const oldest = entry.timestamps[0]
    return {
      allowed: false,
      remaining: 0,
      resetAt: oldest + windowMs,
    }
  }

  entry.timestamps.push(now)

  return {
    allowed: true,
    remaining: maxRequests - entry.timestamps.length,
    resetAt: now + windowMs,
  }
}

/**
 * Extrae la IP del cliente desde los headers de Next.js.
 * Considera proxies (x-forwarded-for) y Vercel.
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIP = request.headers.get('x-real-ip')
  if (realIP) return realIP.trim()
  return 'unknown'
}
