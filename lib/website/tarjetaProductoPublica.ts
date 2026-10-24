/** Adaptación única del inspector nuevo al render compartido por borrador y publicación. */
import { aplicarEstiloTarjeta, etiquetasDeEstilo, posicionBotonInterna, radioForma, type EstiloBotonTarjeta } from './tarjetaProducto'

type BotonBase = { action: string; label?: string; label_when_parent?: string }

export function tarjetaProductoPublica(content: Record<string, unknown> | undefined, elegir: boolean, botonesOriginales?: readonly BotonBase[]) {
  const estilo = aplicarEstiloTarjeta(content?.product_card_style)
  if (!estilo) return { estilo: null, contenido: content ?? {}, botones: null, etiquetas: null }
  const contenido: Record<string, unknown> = { ...content, ...estilo }
  if (estilo.card_preset === 'overlay') contenido.card_layout = 'overlay'
  if (estilo.show_reviews != null) contenido.show_rating = estilo.show_reviews
  if (estilo.reviews_position) contenido.rating_position = estilo.reviews_position
  if (estilo.reviews_style) contenido.rating_style = estilo.reviews_style === 'number_star' ? 'compact' : 'stars'
  if (estilo.card_shadow === 'none') contenido.card_shadow_hover = 'none'
  if (estilo.card_shadow === 'hover') { contenido.card_shadow = 'none'; contenido.card_shadow_hover = 'md' }
  const boton = (base: BotonBase, cfg: EstiloBotonTarjeta | undefined) => {
    if (cfg?.show === false) return null
    const posicion = posicionBotonInterna(cfg?.button_position)
    const radio = radioForma(cfg?.button_shape, cfg?.button_style === 'icon_only')
    return {
      ...base,
      ...(cfg?.button_style ? { variant: cfg.button_style === 'icon_only' ? 'solid' : cfg.button_style, icon_only: cfg.button_style === 'icon_only' } : {}),
      ...(cfg?.button_size ? { size: cfg.button_size } : {}),
      ...(cfg?.button_width ? { full_width: cfg.button_width !== 'auto' } : {}),
      ...(posicion ? { position: posicion } : {}),
      ...(cfg?.button_visibility ? { visibility: cfg.button_visibility } : {}),
      ...(cfg?.gradient_1 || cfg?.bg ? { bg_color: cfg.gradient_1 ?? cfg.bg } : {}),
      ...(cfg?.gradient_2 ? { bg_color_end: cfg.gradient_2 } : {}),
      ...(cfg?.gradient_angle != null ? { gradient_angle: cfg.gradient_angle } : {}),
      ...(cfg?.text ? { text_color: cfg.text } : {}),
      ...(cfg?.border ? { border_color: cfg.border } : {}),
      ...(cfg?.hover ? { hover_color: cfg.hover } : {}),
      ...(radio != null ? { radius: radio } : {}),
      ...(cfg?.icon != null ? { icon: cfg.icon } : {}),
      ...(cfg?.icon_side ? { icon_position: cfg.icon_side } : {}),
    }
  }
  const cambiaBotones = estilo.add || estilo.buy || estilo.choose
  const base = botonesOriginales?.length ? botonesOriginales : [{ action: 'add_to_cart' }, { action: 'buy_now' }]
  const botones = cambiaBotones ? base.flatMap((btn) => {
    const esCompra = ['add_to_cart', 'buy_now', 'choose'].includes(btn.action)
    if (elegir && esCompra && btn.action !== 'choose') {
      const nuevo = boton(btn, estilo.choose ?? estilo.add)
      return nuevo ? [nuevo] : []
    }
    const cfg = btn.action === 'add_to_cart' ? estilo.add : btn.action === 'buy_now' ? estilo.buy : btn.action === 'choose' ? estilo.choose : undefined
    const nuevo = boton(btn, cfg)
    return nuevo ? [nuevo] : []
  }) : null
  return { estilo, contenido, botones, etiquetas: etiquetasDeEstilo(estilo) }
}
