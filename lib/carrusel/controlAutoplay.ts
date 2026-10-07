/**
 * Reloj del avance automático de un carrusel, sin React ni DOM.
 *
 * Avanza cada `intervaloMs` solo si no hay ningún motivo de pausa activo:
 * - `puntero`: el puntero está encima (solo si el interruptor «Pausar al pasar el mouse» está on);
 * - `foco`: el foco del teclado está dentro del carrusel (siempre: nadie lee una tarjeta que se va);
 * - `pestana`: la pestaña está oculta (`document.hidden`);
 * - `movimiento`: el visitante pidió reducir el movimiento (`prefers-reduced-motion: reduce`);
 * - `fin`: sin bucle, llegó al último y no hay a dónde avanzar.
 *
 * `useAutoplayCarrusel` (lib/carrusel/useCarrusel.ts) lo conecta al DOM; el script
 * `scripts/verify-interruptores.mjs` lo prueba con un reloj falso.
 */

export type MotivoPausa = 'puntero' | 'foco' | 'pestana' | 'movimiento' | 'fin'

export interface Reloj {
  setInterval: (fn: () => void, ms: number) => unknown
  clearInterval: (id: unknown) => void
}

export interface ControlAutoplay {
  pausar: (motivo: MotivoPausa) => void
  reanudar: (motivo: MotivoPausa) => void
  /** ¿Corre el reloj ahora mismo? */
  corriendo: () => boolean
  detener: () => void
}

/**
 * `avanzar` devuelve `false` cuando ya no hay a dónde ir (sin bucle): el reloj se pausa por `fin`.
 */
export function crearControlAutoplay(opciones: {
  intervaloMs: number
  avanzar: () => boolean | void
  reloj?: Reloj
}): ControlAutoplay {
  const reloj: Reloj = opciones.reloj ?? {
    setInterval: (fn, ms) => globalThis.setInterval(fn, ms),
    clearInterval: (id) => globalThis.clearInterval(id as ReturnType<typeof setInterval>),
  }
  const motivos = new Set<MotivoPausa>()
  let id: unknown = null
  let detenido = false

  const sincronizar = () => {
    const debeCorrer = !detenido && motivos.size === 0
    if (debeCorrer && id === null) {
      id = reloj.setInterval(() => {
        if (opciones.avanzar() === false) pausar('fin')
      }, opciones.intervaloMs)
    } else if (!debeCorrer && id !== null) {
      reloj.clearInterval(id)
      id = null
    }
  }
  function pausar(motivo: MotivoPausa) {
    motivos.add(motivo)
    sincronizar()
  }
  function reanudar(motivo: MotivoPausa) {
    motivos.delete(motivo)
    sincronizar()
  }
  sincronizar()
  return {
    pausar,
    reanudar,
    corriendo: () => id !== null,
    detener: () => {
      detenido = true
      sincronizar()
    },
  }
}
