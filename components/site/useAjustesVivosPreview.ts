'use client'

import { useEffect, useState } from 'react'
import { esOrigenEditor, useIsPreviewMode } from '@/components/sections/PreviewBridge'
import { temaPublicoDesdeMensaje, type TemaPublico } from '@/lib/website/v2/temaPublico'

/**
 * Encabezado, pie y tema en edición, aplicados en vivo SOLO en modo preview (`?preview=1`).
 *
 * El editor del ERP envía `{ type: 'goadmin:settings', ajustes, menuEncabezado, tema? }` (con
 * debounce) mientras se edita, sin guardar. `tema` es el estilo general V2 en edición (fuentes,
 * colores, redondeo, botón y movimiento): se valida y se resuelve con la misma regla que el sitio
 * publicado (`temaPublicoDesdeMensaje`). Aquí se guardan en memoria del iframe y
 * `OrganizationLayout` los aplica sobre los ajustes guardados. Nada se escribe ni se cachea.
 *
 * Fuera del preview el hook no escucha nada y devuelve `null`: la web pública no cambia.
 * El origen del mensaje se valida contra los orígenes del editor (mismo criterio que
 * `PreviewBridge`), y solo se aceptan columnas conocidas con valores simples.
 */
export interface ItemMenuVivo {
  id: string
  texto: string
  ruta: string
  hijos: ItemMenuVivo[]
}

export interface AjustesVivos {
  ajustes: Record<string, unknown>
  menuEncabezado: ItemMenuVivo[] | null
  /** Estilo general V2 en edición. `undefined` = el editor no lo mandó: se queda el del servidor. */
  tema?: TemaPublico
}

/** Columnas que el editor puede cambiar en vivo (encabezado, pie y tema). */
const PREFIJOS_PERMITIDOS = ['header_', 'footer_', 'mobile_', 'topbar_', 'cta_', 'nav_', 'show_', 'logo_']
const CLAVES_PERMITIDAS = new Set([
  'menu_position', 'search_style', 'categories_menu_style', 'mega_menu_columns', 'accent_color',
  'cart_icon', 'search_icon', 'auth_icon', 'currency_icon', 'minimal_menu_style', 'actions_order',
  'primary_color', 'secondary_color', 'background_color', 'text_color', 'theme_mode',
  'social_links', 'business_hours',
])
/** Nunca en vivo: cambian qué datos se cargan, eso sí necesita guardar. */
const CLAVES_EXCLUIDAS = new Set(['header_menu_id', 'header_mega_menu_id'])

function clavePermitida(clave: string): boolean {
  if (CLAVES_EXCLUIDAS.has(clave)) return false
  return CLAVES_PERMITIDAS.has(clave) || PREFIJOS_PERMITIDOS.some((p) => clave.startsWith(p))
}

function valorSimple(v: unknown, profundidad = 0): boolean {
  if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) {
    return typeof v !== 'string' || v.length <= 2000
  }
  if (profundidad > 2) return false
  if (Array.isArray(v)) return v.length <= 50 && v.every((x) => valorSimple(x, profundidad + 1))
  if (typeof v === 'object') {
    const entradas = Object.entries(v as Record<string, unknown>)
    return entradas.length <= 50 && entradas.every(([, x]) => valorSimple(x, profundidad + 1))
  }
  return false
}

function menuValido(valor: unknown, profundidad = 0): ItemMenuVivo[] | null {
  if (!Array.isArray(valor) || profundidad > 3) return null
  const items: ItemMenuVivo[] = []
  for (const it of valor.slice(0, 50)) {
    if (!it || typeof it !== 'object') continue
    const i = it as Record<string, unknown>
    if (typeof i.id !== 'string' || typeof i.texto !== 'string' || typeof i.ruta !== 'string') continue
    items.push({
      id: i.id.slice(0, 80),
      texto: i.texto.slice(0, 120),
      ruta: i.ruta.slice(0, 512),
      hijos: menuValido(i.hijos, profundidad + 1) ?? [],
    })
  }
  return items
}

export function useAjustesVivosPreview(): AjustesVivos | null {
  const isPreview = useIsPreviewMode()
  const [vivos, setVivos] = useState<AjustesVivos | null>(null)

  useEffect(() => {
    if (!isPreview) return
    const handler = (e: MessageEvent) => {
      if (!esOrigenEditor(e.origin)) return
      if (!e.data || typeof e.data !== 'object' || e.data.type !== 'goadmin:settings') return
      const crudos = e.data.ajustes
      const ajustes: Record<string, unknown> = {}
      if (crudos && typeof crudos === 'object') {
        for (const [clave, valor] of Object.entries(crudos as Record<string, unknown>).slice(0, 200)) {
          if (clavePermitida(clave) && valorSimple(valor)) ajustes[clave] = valor
        }
      }
      setVivos({ ajustes, menuEncabezado: menuValido(e.data.menuEncabezado), tema: temaPublicoDesdeMensaje(e.data.tema) })
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [isPreview])

  return isPreview ? vivos : null
}
