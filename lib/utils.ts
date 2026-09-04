import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidUUID(value: string | null | undefined): boolean {
  if (!value) return false
  return UUID_REGEX.test(value)
}

/**
 * Genera la clave de localStorage para el carrito de un sitio.
 * F5: cuando hay outlet activo (branchId numérico), el carrito se separa
 * por sucursal. Sin outlet, usa la clave simple (backward compat).
 */
export function getCartKey(subdomain: string, branchId?: number | null): string {
  return Number.isInteger(branchId)
    ? `cart_${subdomain}_${branchId}`
    : `cart_${subdomain}`
}
