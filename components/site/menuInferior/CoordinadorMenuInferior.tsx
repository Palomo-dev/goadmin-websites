'use client'
import { useEffect, useId } from 'react'
import { empujeChatBarra } from '@/lib/website/v2/barraFija'
import type { PaginaMenu } from '@/lib/website/menuInferior'
import { registrarEmpujeChat } from '../barraFija/efectosBarraFija'
import { useBarraFijaCelularVisible } from './estadoMenuInferior'

/**
 * Páginas especiales para TODAS las tiendas (Figma 2844:70510, aprobado 2026-11-23), también las
 * que no usan el menú inferior v2:
 *
 * - Marca `<html data-pagina-menu>` con la página de la ruta. app/globals.css quita las barras de
 *   antes (BarraPestanas, MobileBottomNav, la del constructor) en checkout, carrito y pedido (F3), y
 *   las baja mientras se ve la barra fija de compra en la ficha (F1).
 * - La burbuja del chat queda 12 px sobre esas barras (F4), como sobre la de la ficha. El menú
 *   inferior v2 registra el suyo (MenuInferior).
 */
const SELECTOR_BARRAS = '[data-barra-inferior], [data-barra-app], [data-barra-constructor], [data-barra-movil-giro], [data-barra-cta]'

export function CoordinadorMenuInferior({ pagina }: { pagina: PaginaMenu }) {
  const barraFija = useBarraFijaCelularVisible()
  const id = useId()

  useEffect(() => {
    const raiz = document.documentElement
    raiz.setAttribute('data-pagina-menu', pagina)
    return () => raiz.removeAttribute('data-pagina-menu')
  }, [pagina])

  useEffect(() => {
    const visible = pagina !== 'sin-menu' && !(pagina === 'ficha' && barraFija)
    const medir = () => {
      const barra = Array.from(document.querySelectorAll<HTMLElement>(SELECTOR_BARRAS)).find((el) => el.offsetHeight > 0)
      const alto = barra ? barra.offsetHeight + (parseFloat(getComputedStyle(barra).bottom) || 0) : 0
      registrarEmpujeChat(id, empujeChatBarra(alto, visible, true))
    }
    medir()
    // Las barras del encabezado se montan fuera de él (FueraDelEncabezado) un instante después.
    const t = window.setTimeout(medir, 600)
    window.addEventListener('resize', medir)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('resize', medir)
    }
  }, [id, pagina, barraFija])

  useEffect(() => () => registrarEmpujeChat(id, 0), [id])
  return null
}
