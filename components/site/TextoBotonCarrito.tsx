'use client'

import { useEffect, useState } from 'react'
import { Price } from './CurrencyProvider'
import {
  indiceAlAbrir,
  partirMensajeMonto,
  reglaBotonCarrito,
  segundosBotonCarrito,
  textoBotonCarrito,
  textosBotonCarrito,
  transicionBotonCarrito,
  type BotonCarrito,
  type EstadoCarritoBoton,
} from '@/lib/website/v2/cabeceraTienda'

/**
 * Último índice de «al abrir» por botón (cajón / página): «en orden» sigue la lista entre
 * aperturas y «al azar» no repite el anterior. Vive en la pestaña (sessionStorage) para que una
 * recarga no vuelva a empezar; sin almacenamiento, en memoria.
 */
const ultimos = new Map<string, number>()
function leerUltimo(alcance: string): number | null {
  if (ultimos.has(alcance)) return ultimos.get(alcance) ?? null
  try {
    const v = sessionStorage.getItem(`boton_carrito_${alcance}`)
    return v === null ? null : Number(v)
  } catch {
    return null
  }
}
function guardarUltimo(alcance: string, i: number) {
  ultimos.set(alcance, i)
  try {
    sessionStorage.setItem(`boton_carrito_${alcance}`, String(i))
  } catch {
    // Sin almacenamiento: queda en memoria.
  }
}

/** «Reducir movimiento» del visitante (la transición pasa a «sin efecto»). */
function useReducirMovimiento(): boolean {
  const [reducir, setReducir] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducir(mq.matches)
    const alCambiar = () => setReducir(mq.matches)
    mq.addEventListener?.('change', alCambiar)
    return () => mq.removeEventListener?.('change', alCambiar)
  }, [])
  return reducir
}

/** Pausa con el mouse (o el dedo) encima: se esparce en el botón que contiene el texto. */
export function usePausaBoton(): [boolean, { onPointerEnter: () => void; onPointerLeave: () => void; onFocus: () => void; onBlur: () => void }] {
  const [pausado, setPausado] = useState(false)
  return [
    pausado,
    {
      onPointerEnter: () => setPausado(true),
      onPointerLeave: () => setPausado(false),
      onFocus: () => setPausado(true),
      onBlur: () => setPausado(false),
    },
  ]
}

/**
 * Texto del botón principal del carrito según su modo (Figma 2773:62797 · 2774:63297 ·
 * 2774:64169 · 2775:64409). Lo usan el cajón (CartDrawer) y «Comprar» de /carrito.
 * - fijo: siempre el mismo · al_abrir: uno nuevo en cada apertura (azar sin repetir / en orden)
 * - mientras_abierto: rota cada N s con fundido/deslizar/sin efecto; se pausa con `pausado`; el
 *   ancho es el del texto más largo (no salta) · segun_carrito: la regla que gana, con el monto
 *   en la moneda del visitante.
 */
export function TextoBotonCarrito({
  boton,
  abierto,
  estado,
  alcance,
  pausado = false,
}: {
  boton: BotonCarrito
  /** El cajón está abierto (la página: siempre). Cada apertura nueva elige texto en «al abrir». */
  abierto: boolean
  estado: EstadoCarritoBoton
  alcance: 'cajon' | 'pagina'
  pausado?: boolean
}) {
  const lista = textosBotonCarrito(boton)
  const reducir = useReducirMovimiento()
  const clave = JSON.stringify(boton)

  // «Al abrir»: se elige durante el render (estado derivado) al pasar a abierto o cambiar el botón,
  // así no se pinta un cuadro con el texto anterior.
  const [indice, setIndice] = useState(0)
  const [eleccion, setEleccion] = useState<{ abierto: boolean; clave: string } | null>(null)
  if (boton.modo === 'al_abrir' && (eleccion === null || eleccion.abierto !== abierto || eleccion.clave !== clave)) {
    setEleccion({ abierto, clave })
    if (abierto && (eleccion === null || !eleccion.abierto || eleccion.clave !== clave)) {
      const i = indiceAlAbrir(boton, typeof window === 'undefined' ? null : leerUltimo(alcance))
      setIndice(i)
      if (typeof window !== 'undefined') guardarUltimo(alcance, i)
    }
  }

  // «Mientras está abierto»: arranca en el primero al abrir y avanza cada N s si no está en pausa.
  const [paso, setPaso] = useState(0)
  const segundos = segundosBotonCarrito(boton)
  useEffect(() => {
    if (boton.modo !== 'mientras_abierto') return
    if (!abierto) {
      setPaso(0)
      return
    }
    if (pausado || lista.length <= 1) return
    const t = setInterval(() => setPaso((p) => p + 1), segundos * 1000)
    return () => clearInterval(t)
  }, [boton.modo, abierto, pausado, segundos, lista.length])

  if (boton.modo === 'segun_carrito') {
    const { plantilla, monto } = reglaBotonCarrito(boton, estado)
    if (monto === null) return <span data-texto-boton="segun_carrito">{plantilla}</span>
    const { antes, despues } = partirMensajeMonto(plantilla)
    return (
      <span data-texto-boton="segun_carrito">
        {antes}
        <Price value={monto} />
        {despues}
      </span>
    )
  }

  if (boton.modo === 'mientras_abierto') {
    const actual = lista.length > 0 ? paso % lista.length : 0
    const transicion = transicionBotonCarrito(boton, reducir)
    return (
      // Todos los textos en la misma celda: el ancho es el del más largo y el botón no salta.
      <span className="inline-grid" data-texto-boton="mientras_abierto" aria-live="off">
        {lista.map((t, i) => (
          <span
            key={i === actual ? `${i}-${paso}` : i}
            aria-hidden={i !== actual}
            className={`[grid-area:1/1] ${i === actual ? (transicion === 'fundido' ? 'texto-boton-fundido' : transicion === 'deslizar' ? 'texto-boton-deslizar' : '') : 'invisible'}`}
          >
            {t}
          </span>
        ))}
      </span>
    )
  }

  if (boton.modo === 'al_abrir') return <span data-texto-boton="al_abrir">{lista[indice] ?? textoBotonCarrito(boton)}</span>
  return <span data-texto-boton="fijo">{textoBotonCarrito(boton)}</span>
}
