/**
 * verify-distribucion-banner.mjs — sin claves nuevas no hay distribución,
 * y los grupos de banners cubren la grilla sin huecos.
 *
 *   npm run verify:distribucion-banner
 */
import {
  avisoDistribucion,
  bloquesDistribucion,
  cubreSinHuecos,
  grupoDistribucion,
  posicionFocal,
  radioBotonBanner,
  usarDistribucionNueva,
} from '../lib/website/distribucionBanner.ts'

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}

check(usarDistribucionNueva(null) === null, 'sin contenido no cambia')
check(usarDistribucionNueva({}) === null, 'objeto vacío no cambia')
check(usarDistribucionNueva({ layout: 'carousel', banners: [{ title: 'A' }] }) === null, 'el layout viejo no activa la distribución nueva')
check(usarDistribucionNueva({ banner_layout: 'grid' }) === null, 'cuadrícula sola es la de hoy')
check(usarDistribucionNueva({ banner_layout: 'hero_plus_2' })?.layout === 'hero_plus_2', 'grande + 2 sí cambia')
check(usarDistribucionNueva({ banner_layout: 'inventada' }) === null, 'un nombre desconocido se ignora')
check(usarDistribucionNueva({ banner_style: { gap: 12 } })?.layout === 'grid', 'un estilo sin distribución usa la cuadrícula')
check(usarDistribucionNueva({ banner_style: { gap: 400 } }) === null, 'un gap inválido no deja estilo')
check(usarDistribucionNueva({ banner_style: { section_bg: 'red;url(x)' } }) === null, 'un color inválido no se pinta')
check(usarDistribucionNueva({ banners: [{ image_url_mobile: 'https://ejemplo.test/a.jpg' }] })?.layout === 'grid', 'la foto de celular activa el render nuevo')

const patrones = ['hero_plus_2', '2_plus_hero', 'hero_plus_4', 'split_50', 'triple_center']
for (const layout of patrones) {
  const n = grupoDistribucion(layout)
  const bloques = bloquesDistribucion(layout, n, true)
  check(bloques.length === 1, `${layout} con ${n} es un solo grupo`)
  check(cubreSinHuecos(bloques[0]), `${layout} cubre la grilla sin huecos`)
}

const sobra = bloquesDistribucion('hero_plus_2', 4, true)
check(sobra.length === 2, 'sobra uno y va en una fila propia')
check(sobra[1].celdas.length === 1 && sobra[1].columnas === 1, 'ese uno ocupa el ancho completo')
check(cubreSinHuecos(sobra[0]) && cubreSinHuecos(sobra[1]), 'el grupo y la fila no tienen huecos')

const oculto = bloquesDistribucion('split_50', 3, false)
check(oculto.length === 1 && oculto[0].celdas.length === 2, 'sin ancho completo el suelto no entra')

const falta = avisoDistribucion('hero_plus_4', 3, true)
check(falta?.tipo === 'falta' && falta.texto.includes('faltan 2'), 'avisa si faltan banners')
const sobran = avisoDistribucion('hero_plus_2', 4, true)
check(sobran?.tipo === 'sobra' && sobran.texto.includes('ancho completo'), 'avisa que el último ocupa el ancho')
check(avisoDistribucion('grid', 8, true) === null, 'la cuadrícula acepta cualquier cantidad')
check(avisoDistribucion('circles', 8, true) === null, 'los círculos aceptan cualquier cantidad')

check(posicionFocal('top') === 'center top', 'el foco de arriba es seguro')
check(posicionFocal('20% 80%') === '20% 80%', 'un porcentaje válido se conserva')
check(posicionFocal('20% 120%') == null, 'un porcentaje fuera de rango se descarta')
check(posicionFocal('center;color:red') == null, 'un foco con CSS no pasa')
check(radioBotonBanner('square', false) === 0, 'botón cuadrado')
check(radioBotonBanner('pill', false) === 9999, 'botón píldora')
check(radioBotonBanner('circle', true) === 9999, 'círculo solo con ícono')
check(radioBotonBanner('circle', false) == null, 'círculo sin ícono no aplica')

const dosFilas = bloquesDistribucion('hero_plus_2', 5, true)
check(dosFilas.length === 2 && dosFilas[1].columnas === 2, 'dos sobrantes llenan una fila de dos')
check(cubreSinHuecos(dosFilas[1]), 'la fila de sobrantes no tiene huecos')

if (problemas.length) {
  console.error(problemas.join('\n'))
  process.exit(1)
}
console.log(`ok ${casos} casos`)
