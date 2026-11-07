/**
 * Sección `welcome_popup · coupon` («Ventana de bienvenida», Hogar; PLANO §3).
 *
 * Una ventana con el cupón que escribe el dueño. No pinta nada en el flujo de la página: se abre
 * sola a los `delay_s` segundos, una vez por visitante (`frequency: 'once'`, `localStorage`) o una
 * vez por sesión (`'session'`, `sessionStorage`), con la clave `goadmin:bienvenida:<org>`.
 *
 * - Apagada (`enabled: false`, el default de la plantilla) o sin un código válido, no existe
 *   (`ventanaBienvenidaVisible`). En la vista previa del editor, un aviso.
 * - El cupón es texto: no se consulta `coupons` desde el navegador ni se toca el checkout. El
 *   visitante lo copia y lo escribe en «Código de cupón» al pagar, el campo de siempre, que es el
 *   que lo valida.
 * - Si el navegador no deja leer ni escribir el almacenamiento (modo privado estricto, cookies
 *   bloqueadas), la ventana NO se abre: sin poder recordarla, saldría en cada página.
 * - En la vista previa del editor no se abre sola: se pinta en línea para poder editarla.
 *
 * Sin 'use client': el manifiesto lee `VentanaBienvenida.CONTENT_KEYS`. La ventana vive en
 * `VentanaBienvenidaVista.tsx`.
 */

import { claveAlmacenBienvenida, CLAVES_SECCION_TIENDA, normalizarVentanaBienvenida, ventanaBienvenidaVisible } from '@/lib/website/v2/contrato/seccionesTienda'
import { conPrefijo } from '@/lib/outlet/rutaSitio'
import { textoSobreAcentoSiHex } from '@/lib/website/v2/textoSobreAcento'
import { EditorHint } from '../restaurant/EditorHint'
import { VentanaBienvenidaVista } from './VentanaBienvenidaVista'
import type { DatosPaginaTienda } from './datosTienda'

export const CONTENT_KEYS = CLAVES_SECCION_TIENDA['welcome_popup.coupon']

interface VentanaBienvenidaProps {
  content: Record<string, unknown>
  primaryColor?: string
  organization?: { id?: number | string; name?: string | null }
  data?: DatosPaginaTienda
}

export function VentanaBienvenida({ content, primaryColor = '#111111', organization, data }: VentanaBienvenidaProps) {
  const v = normalizarVentanaBienvenida(content)
  if (!ventanaBienvenidaVisible(v) || organization?.id === undefined || organization?.id === null) {
    return (
      <EditorHint title="Ventana de bienvenida apagada">
        {v.enabled ? 'Escribe un código de cupón real (letras, números, - o _).' : 'Préndela y escribe el código de un cupón real para que se abra.'}
      </EditorHint>
    )
  }
  const prefijo = typeof data?.prefijoSede === 'string' ? data.prefijoSede : ''
  const nombre = typeof organization.name === 'string' ? organization.name.trim() : ''

  return (
    <VentanaBienvenidaVista
      clave={claveAlmacenBienvenida(organization.id)}
      frecuencia={v.frequency}
      retrasoS={v.delayS}
      saludo={nombre ? `Bienvenida a ${nombre}` : ''}
      titulo={v.title}
      texto={v.text}
      codigo={v.couponCode}
      imagen={v.imageUrl}
      cta={v.ctaText && v.ctaUrl ? { texto: v.ctaText, href: conPrefijo(v.ctaUrl, prefijo) } : null}
      colorBoton={{ fondo: primaryColor, texto: textoSobreAcentoSiHex(primaryColor) ?? '#FFFFFF' }}
    />
  )
}

VentanaBienvenida.CONTENT_KEYS = CONTENT_KEYS
