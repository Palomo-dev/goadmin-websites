'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Menu as MenuIcon, UtensilsCrossed, ReceiptText, BellRing, Star, ListOrdered } from 'lucide-react'
import type { OrganizationWithDetails } from '@/types/database'
import { textoSobreAcentoSiHex } from '@/lib/website/v2/textoSobreAcento'
import { irA, setMesaQR, useMesaQRStore } from '@/lib/restaurant/mesaStore'
import { HojaInferior } from '@/components/sections/restaurant/mesa/comun'
import { usePasosMesa } from '@/components/site/PasosMesaContext'
import { pasoConEncabezado } from '@/lib/restaurant/pasosMesa'

/**
 * Encabezado mínimo de la Carta QR en la mesa (Figma 2032:75742, lámina 01): ☰, logo y nombre
 * del restaurante. Sin buscador, carrito, «Reservar Mesa» ni el menú de navegación del sitio.
 *
 * No es fijo: desde la carta manda la barra de la mesa («Mesa 7 · Terraza», Mesero, Cuenta), que
 * se fija arriba al bajar (ServicioMesa). Colores y fuentes: los del tema del sitio.
 * ☰ abre una hoja con lo que la página tiene: la carta, el pedido, la cuenta, el mesero y la
 * valoración (solo las secciones que existan).
 */
export function EncabezadoMesa({ organization, primaryColor }: { organization: OrganizationWithDetails; primaryColor: string }) {
  const [abierta, setAbierta] = useState(false)
  const hayPedido = useMesaQRStore((e) => e.hayPedido)
  const hayCuenta = useMesaQRStore((e) => e.hayCuenta)
  const hayServicio = useMesaQRStore((e) => e.hayServicio)
  const hayValorar = useMesaQRStore((e) => e.hayValorar)
  // Carta QR por pasos: ☰ ofrece solo los pasos que existen en la página.
  const porPasos = usePasosMesa()
  const hay = (paso: 'carta' | 'pedido' | 'cuenta' | 'valorar', sinPasos: boolean) => (porPasos.activo ? porPasos.pasos.includes(paso) : sinPasos)
  const iniciales = organization.name.split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase()

  const ir = (accion: () => void) => {
    setAbierta(false)
    accion()
  }
  const verCarta = () => {
    if (porPasos.activo) {
      irA('carta')
      return
    }
    irA('')
    const carta = document.getElementById('carta-qr-inicio')
    if (carta) carta.scrollIntoView({ behavior: 'smooth' })
    else window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const opciones = [
    { texto: 'Ver la carta', icono: UtensilsCrossed, accion: verCarta, hay: hay('carta', true) },
    { texto: 'Pedido de la mesa', icono: ListOrdered, accion: () => irA('pedido'), hay: hay('pedido', hayPedido) },
    { texto: 'Llamar al mesero', icono: BellRing, accion: () => setMesaQR({ servicioAbierto: true }), hay: porPasos.activo ? porPasos.mesero : hayServicio },
    { texto: 'La cuenta', icono: ReceiptText, accion: () => irA('cuenta'), hay: hay('cuenta', hayCuenta) },
    { texto: 'Valorar la visita', icono: Star, accion: () => irA('valorar'), hay: hay('valorar', hayValorar) },
  ].filter((o) => o.hay)

  // Por pasos: el encabezado va solo en el paso de inicio (lámina 01). La carta lleva arriba la
  // barra de la mesa y las demás láminas son pantallas con su propia flecha atrás.
  if (porPasos.activo && porPasos.paso && !pasoConEncabezado(porPasos.paso, porPasos.pasos)) return null

  return (
    <header
      // Sin z-index propio: así la hoja de ☰ (z-70) queda por encima de la barra del pedido.
      className="relative w-full"
      style={{ backgroundColor: 'var(--background-color)', color: 'var(--text-color)' }}
      data-encabezado-mesa=""
    >
      <div className="mx-auto flex max-w-[1180px] items-center gap-3 px-4 py-6 md:px-6">
        <button
          type="button"
          aria-label="Abrir menú de la mesa"
          aria-expanded={abierta}
          onClick={() => setAbierta(true)}
          className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
        >
          <MenuIcon className="h-6 w-6" aria-hidden="true" />
        </button>
        {organization.logo_url ? (
          <Image
            src={organization.logo_url}
            alt=""
            width={108}
            height={36}
            className="h-9 w-auto shrink-0 object-contain"
            priority
          />
        ) : (
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center text-sm font-semibold"
            style={{
              backgroundColor: primaryColor,
              color: textoSobreAcentoSiHex(primaryColor) ?? '#ffffff',
              borderRadius: 'min(var(--radio-sitio, 4px), 8px)',
              fontFamily: 'var(--font-heading)',
            }}
            aria-hidden="true"
          >
            {iniciales}
          </span>
        )}
        <span className="min-w-0 truncate text-[22px] font-semibold leading-tight" style={{ fontFamily: 'var(--font-heading)' }}>
          {organization.name}
        </span>
      </div>

      <HojaInferior abierta={abierta} onCerrar={() => setAbierta(false)} etiqueta="Menú de la mesa">
        <nav aria-label="Menú de la mesa">
          <ul className="flex flex-col">
            {opciones.map((o) => (
              <li key={o.texto}>
                <button
                  type="button"
                  onClick={() => ir(o.accion)}
                  className="flex min-h-[48px] w-full items-center gap-3 rounded-lg px-2 text-left text-base font-medium"
                >
                  <o.icono className="h-5 w-5 shrink-0" aria-hidden="true" />
                  {o.texto}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </HojaInferior>
    </header>
  )
}
