/**
 * Contrato de paginación y carrusel sin jest: estilos, override, móvil y
 * el caso sin ajustes (clases de hoy).
 *   node --experimental-strip-types scripts/verify-paginacion-carrusel.mjs
 */
import {
  clasesFlecha,
  clasesPaginacion,
  numerosDePagina,
  resolverCarrusel,
  resolverPaginacion,
  BASE_CARRUSEL_PRODUCTO,
} from '../lib/website/v2/paginacionCarrusel.ts'

const fallos = []
const ok = (cond, msg) => { if (!cond) fallos.push(msg) }

const hoy = resolverPaginacion({ legado: 'grilla', porPagina: 12 }, null, null, false)
ok(hoy.activo === false, 'sin ajuste no está activo')
ok(clasesPaginacion(hoy).contenedor === 'flex items-center justify-center gap-1 mt-8', 'contenedor de la rejilla')
ok(clasesPaginacion(hoy).numero.includes('min-w-[36px] h-9 rounded-lg'), 'número de la rejilla')
ok(JSON.stringify(numerosDePagina(2, 17, true)) === JSON.stringify([1, 2, 3, '…', 17]), '1 2 3 … 17')

const cat = resolverPaginacion({ legado: 'categoria', porPagina: 12 }, null, null, false)
ok(clasesPaginacion(cat).contenedor === 'flex items-center justify-center gap-2 mt-10', 'contenedor de categoría')

for (const estilo of ['numerada', 'compacta', 'cargar_mas', 'infinito', 'anterior_siguiente']) {
  const r = resolverPaginacion({ legado: 'grilla', porPagina: 12 }, { estilo }, null, false)
  ok(r.activo && r.estilo === estilo, `estilo ${estilo}`)
}
for (const flecha of ['chevron', 'circulo', 'cuadrado', 'larga', 'hover']) {
  const clase = clasesFlecha(flecha, 'md', true)
  ok(clase.includes('focus-visible:ring-2'), `foco en ${flecha}`)
}
const seccion = resolverPaginacion(
  { legado: 'grilla', porPagina: 12 },
  { estilo: 'compacta', porPaginaEscritorio: 24, porPaginaMovil: 8 },
  { usar_global: false, estilo: 'cargar_mas' },
  false,
)
ok(seccion.estilo === 'cargar_mas' && seccion.porPagina === 24, 'la sección pisa el estilo y hereda la cantidad')
const movil = resolverPaginacion({ legado: 'grilla', porPagina: 12 }, { porPaginaEscritorio: 24, porPaginaMovil: 8 }, null, true)
const escritorio = resolverPaginacion({ legado: 'grilla', porPagina: 12 }, { porPaginaEscritorio: 24, porPaginaMovil: 8 }, null, false)
ok(movil.porPagina === 8 && escritorio.porPagina === 24, 'móvil contra escritorio')
const carrusel = resolverCarrusel(BASE_CARRUSEL_PRODUCTO, null, null, false)
ok(carrusel.activo === false && carrusel.indicador === 'puntos' && carrusel.estiloFlechas === 'hover', 'carrusel de hoy')

if (fallos.length) {
  console.error(fallos.join('\n'))
  process.exit(1)
}
console.log('verify:paginacion-carrusel ok')
