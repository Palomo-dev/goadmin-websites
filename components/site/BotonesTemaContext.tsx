'use client'

import { createContext, useContext } from 'react'

/**
 * ¿El tema pide mayúsculas o efecto al pasar el mouse en los botones (plantillas de tienda,
 * CONTRATO P0 §3)? Es lo mismo que `data-botones-mayusculas` o `data-tema-hover` en la raíz
 * (OrganizationLayoutCliente), legible desde un componente.
 *
 * Las reglas de app/globals.css para esas dos opciones alcanzan los botones marcados con
 * `data-boton` dentro de las secciones. El botón del encabezado y los de la tarjeta de producto no
 * llevan esa marca (ponérsela les cambiaría el redondeo y el «Contorno» de hoy), así que llevan
 * `data-boton-tema` **solo cuando alguna de las dos opciones está activa**. Sin ellas (todo sitio
 * de hoy, y fuera del layout) no hay atributo: el HTML y el CSS efectivo quedan como antes.
 */
const BotonesTemaContext = createContext(false)

export const BotonesTemaProvider = BotonesTemaContext.Provider

const MARCA = { 'data-boton-tema': '' } as const
const SIN_MARCA = {} as const

/** Atributos para un botón del encabezado o de la tarjeta: `{}` sin las opciones. */
export function useMarcaBotonTema(): { 'data-boton-tema'?: '' } {
  return useContext(BotonesTemaContext) ? MARCA : SIN_MARCA
}
