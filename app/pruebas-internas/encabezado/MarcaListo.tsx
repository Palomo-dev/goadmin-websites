'use client'

import { useEffect } from 'react'

/**
 * Arnés de pruebas: marca `<html data-pruebas-listo>` cuando la página ya hidrató y pasaron dos
 * cuadros (el encabezado decide celular/computador en un efecto y se vuelve a pintar). La matriz
 * del buscador espera esta marca antes de medir.
 */
export function MarcaListo() {
  useEffect(() => {
    let b = 0
    const a = requestAnimationFrame(() => {
      b = requestAnimationFrame(() => document.documentElement.setAttribute('data-pruebas-listo', '1'))
    })
    return () => {
      cancelAnimationFrame(a)
      cancelAnimationFrame(b)
      document.documentElement.removeAttribute('data-pruebas-listo')
    }
  }, [])
  return null
}
