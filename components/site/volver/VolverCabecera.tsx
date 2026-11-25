'use client'

/**
 * «Volver» dentro de una cabecera (la del checkout, el dueño 2026-11-25): el MISMO botón ←
 * cuadrado de la tienda (BotonVolver, el de EncabezadoPagina: fondo tenue del color de marca y la
 * flecha en el color de marca; su fondo es propio, así que sobre una cabecera oscura se ve igual)
 * seguido de las migas con el color del texto de la cabecera.
 *
 * - Computador: ← + todas las migas («Inicio › Carrito › Finalizar compra»).
 * - Celular: ← + la miga más útil (`migaCelular`, p. ej. «Carrito»), sin desbordar.
 *
 * El ← va a donde venía el cliente o al padre (useDestinoVolver, igual que en las páginas).
 */
import Link from '@/components/site/Enlace'
import type { DestinoPadre, Miga } from '@/lib/navegacion/volver'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import { BotonVolver } from './BotonVolver'
import { MigasTienda } from './EncabezadoPagina'

export function VolverCabecera({
  migas,
  padre,
  migaCelular,
  primaryColor,
  className = '',
}: {
  migas: readonly Miga[]
  padre: DestinoPadre
  /** La miga que se ve en el celular junto al ← (con enlace). Sin ella, solo el ←. */
  migaCelular?: Miga | null
  primaryColor?: string | null
  className?: string
}) {
  const { ruta } = useRutaSitio()
  return (
    <div className={`flex min-w-0 items-center gap-2 md:gap-2.5 ${className}`} data-volver-cabecera="">
      <BotonVolver compacto padre={padre} primaryColor={primaryColor} />
      <MigasTienda migas={migas} heredarColor className="hidden md:block" />
      {migaCelular?.href ? (
        <Link href={ruta(migaCelular.href)} className="min-w-0 truncate text-xs font-medium text-current opacity-80 hover:opacity-100 md:hidden" data-miga-celular="">
          {migaCelular.etiqueta}
        </Link>
      ) : null}
    </div>
  )
}
