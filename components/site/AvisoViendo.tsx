import { personasEstables, textoConNumero, type AvisoViendoConfig } from '@/lib/website/urgenciaSeccion'

/** «N personas viendo». No se pinta si el aviso está apagado. El número es estable por semilla. */
export function AvisoViendo({
  config,
  semilla,
  className = 'text-xs text-gray-500',
}: {
  config: AvisoViendoConfig | null | undefined
  semilla: string
  className?: string
}) {
  if (!config?.activo) return null
  return (
    <p className={className} data-urgencia-viendo="">
      {textoConNumero(config.plantilla || '{n} personas viendo', personasEstables(semilla))}
    </p>
  )
}
