/**
 * Lectura de la respuesta de error de `/api/orders` en el checkout.
 *
 * Extraído tal cual de `components/site/CheckoutWizard.tsx` (sin cambio de comportamiento).
 */

export function mensajeErrorPedido(status: number, data: any): string {
  if (status === 409 && data.details) {
    return `Stock insuficiente:\n${data.details.join('\n')}`
  }
  return data.error || 'Error al crear la orden'
}
