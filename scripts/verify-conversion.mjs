/**
 * Sin `conversion` no hay contadores nuevos. El aviso exige stock real.
 */
import { avisoStock, conversionDesdeColumnas, estadoContador, contadoresEn, conversionManda } from '../lib/website/conversion.ts'

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}

check(conversionDesdeColumnas({ countdown_enabled: false }) === null, 'apagado no crea conversion')
check(contadoresEn(null, 'topbar') === null, 'sin conversion la tienda sigue el camino legacy')
check(contadoresEn({}, 'producto') === null, 'conversion sin contadores no corta el legacy')
check(conversionManda(null, 'producto') === false, 'sin ajustes el contador legacy de la ficha sigue')
check(conversionManda({}, 'producto') === false, 'ajustes vacíos no mandan conversion')
check(conversionManda({ conversion: { contadores: [] } }, 'producto') === true, 'conversion presente apaga la columna legacy')
const diaria = conversionDesdeColumnas({
  countdown_enabled: true,
  countdown_mode: 'daily_reset',
  countdown_show_in_header: false,
  countdown_show_in_cart: true,
  checkout_show_countdown: true,
  countdown_title: 'Oferta',
  countdown_reset_hour: 0,
  countdown_timezone: 'America/Bogota',
})
check(diaria?.contadores[0]?.modo.tipo === 'diario', 'daily_reset es diario')
check(!diaria?.contadores[0]?.ubicaciones.includes('topbar'), 'header apagado no es topbar')
check(diaria?.contadores[0]?.ubicaciones.includes('carrito') && diaria.contadores[0].ubicaciones.includes('checkout'), 'carrito y checkout se copian')
check(avisoStock(null, 5, 'Quedan {n}') === null, 'sin stock no hay aviso')
check(avisoStock(0, 5, 'Quedan {n}') === null, 'stock cero no se anuncia')
check(avisoStock(2, 5, 'Quedan {n}') === 'Quedan 2', 'stock real dentro del umbral')
const promo = {
  id: 'p', activo: true, ubicaciones: ['checkout'],
  modo: { tipo: 'promocion', promotionId: '00000000-0000-4000-8000-000000000001' },
  formato: { dias: false, horas: true, minutos: true, segundos: true, etiquetas: false },
  estilo: { forma: 'pastilla', sombra: false, tamano: 'sm', cajas: 'linea' },
  textoAntes: '', textoDespues: '',
  alTerminar: { tipo: 'ocultar' },
}
check(estadoContador(promo, new Date('2026-10-22T12:00:00Z'), '2020-01-01T00:00:00Z').tipo === 'oculto', 'promoción caducada se oculta')
check(estadoContador({ ...promo, alTerminar: { tipo: 'mensaje', texto: 'Fin' } }, new Date('2026-10-22T12:00:00Z'), null).tipo === 'mensaje', 'sin fin de promoción muestra el mensaje')

if (problemas.length) {
  console.error(problemas.join('\n'))
  process.exit(1)
}
console.log(`ok ${casos} casos`)
