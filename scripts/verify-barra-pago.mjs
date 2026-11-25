/**
 * verify-barra-pago.mjs — barra fija del pago en celular, resumen del pago y opciones de pago
 * (Figma «16 Sitio web» 3059:80757 y 3061:82007; contraentrega 08 y 10/10c; aprobados 2026-11-24).
 *
 *   npm run verify:barra-pago
 *
 * Prueba lo puro (components/site/checkout/barraPago.ts y resumenPago.ts) con los TRES estilos y
 * los CUATRO casos del diseño, que sin ajuste sale C, que contraentrega sin anticipo dice
 * «Confirmar pedido» (no «Pagar $ X»), que cada ícono que el ERP deja elegir se pinta como ícono
 * (nunca la palabra) y revisa en el fuente que el checkout siga conectado (área segura, espaciador,
 * chat 12 px por encima, else de computador). Sin dependencias ni base.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ESTILOS_BARRA_PAGO,
  ESTILO_BARRA_POR_DEFECTO,
  MAX_ACCION_C,
  accionAnticipoC,
  contenidoBarraPago,
  etiquetaAccesibleBoton,
  normalizarEstiloBarraPago,
} from '../components/site/checkout/barraPago.ts'
import {
  ICONOS_METODO,
  ICONO_TIENDA_A_LUCIDE,
  chipEntrega,
  chipsMediosPago,
  descripcionMetodo,
  iconoMetodo,
  iconoSello,
  metodoDeRespaldo,
  metodoDeTraspaso,
  metodoPreseleccionado,
  textoPlanoCorto,
} from '../components/site/checkout/resumenPago.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const fuente = (r) => readFileSync(join(ROOT, r), 'utf8')
const problemas = []
let casos = 0
const igual = (nombre, real, esperado) => {
  casos++
  const a = JSON.stringify(real)
  const b = JSON.stringify(esperado)
  if (a !== b) problemas.push(`${nombre}\n      esperado ${b}\n      obtuvo   ${a}`)
}

// ── Estilo: sin ajuste, C ────────────────────────────────────────────────────────────────────────
igual('los tres estilos', [...ESTILOS_BARRA_PAGO], ['dos_filas', 'dos_lineas', 'partido'])
igual('por defecto C (partido)', ESTILO_BARRA_POR_DEFECTO, 'partido')
for (const v of [undefined, null, '', 'C', 'otro', 3, {}]) igual(`sin ajuste válido (${JSON.stringify(v)}) → C`, normalizarEstiloBarraPago(v), 'partido')
for (const v of ESTILOS_BARRA_PAGO) igual(`ajuste ${v} se respeta`, normalizarEstiloBarraPago(v), v)

// ── Los 4 casos del Figma ────────────────────────────────────────────────────────────────────────
const casoA = { tipo: 'pago', total: '$ 64.900', productos: 3, envio: 'incluido', pasarela: 'Wompi', ahorro: null }
const casoB = { tipo: 'anticipo', total: '$ 64.900', hoy: '$ 20.000', alRecibir: '$ 44.900', pasarela: 'Bold' }
const casoC = { tipo: 'sin_anticipo', total: '$ 64.900', alRecibir: '$ 64.900', medios: 'efectivo, datáfono o Nequi' }
const casoD = { ...casoB, pasarela: 'Mercado Pago' }
const vista = (estilo, caso) => {
  const c = contenidoBarraPago(estilo, caso)
  return { cols: c.columnas.map((x) => `${x.etiqueta}=${x.valor}${x.destacado ? '*' : ''}`), total: c.total, contexto: c.contexto, chip: c.chipAlRecibir, enlace: c.enlace, icono: c.boton.icono, texto: c.boton.texto, linea2: c.boton.linea2, monto: c.boton.monto, montoEtiqueta: c.boton.montoEtiqueta }
}

// A · dos filas (3059:81024)
igual('1a pago normal', vista('dos_filas', casoA), { cols: ['Total · 3 productos=$ 64.900*'], total: null, contexto: null, chip: null, enlace: 'Ver resumen', icono: 'candado', texto: 'Pagar $ 64.900', linea2: null, monto: null, montoEtiqueta: null })
igual('1b anticipo Bold', vista('dos_filas', casoB), { cols: ['Total=$ 64.900', 'Hoy pagas=$ 20.000*', 'Al recibir=$ 44.900'], total: null, contexto: null, chip: null, enlace: null, icono: 'candado', texto: 'Pagar $ 20.000 con Bold', linea2: null, monto: null, montoEtiqueta: null })
igual('1c sin anticipo', vista('dos_filas', casoC), { cols: ['Total=$ 64.900*'], total: null, contexto: null, chip: 'Todo al recibir', enlace: null, icono: 'check', texto: 'Confirmar pedido', linea2: null, monto: null, montoEtiqueta: null })
igual('1d Mercado Pago cabe con «con …»', vista('dos_filas', casoD).texto, 'Pagar $ 20.000 con Mercado Pago')
igual('1d nombre que no cabe: se quita «con …»', vista('dos_filas', { ...casoB, pasarela: 'Pasarela De Pagos Internacional' }).texto, 'Pagar $ 20.000')

// B · botón de dos líneas (3060:81210)
igual('2a pago normal', vista('dos_lineas', casoA), { cols: [], total: '$ 64.900', contexto: null, chip: null, enlace: 'Ver resumen', icono: 'candado', texto: 'Pagar $ 64.900', linea2: 'Pago seguro con Wompi', monto: null, montoEtiqueta: null })
igual('2b anticipo Bold', vista('dos_lineas', casoB), { cols: [], total: '$ 64.900', contexto: null, chip: null, enlace: 'Ver detalle', icono: 'candado', texto: 'Pagar anticipo · $ 20.000', linea2: 'con Bold · al recibir $ 44.900', monto: null, montoEtiqueta: null })
igual('2c sin anticipo', vista('dos_lineas', casoC), { cols: [], total: '$ 64.900', contexto: null, chip: null, enlace: 'Ver detalle', icono: 'check', texto: 'Confirmar pedido', linea2: 'Pagas $ 64.900 al recibir', monto: null, montoEtiqueta: null })
igual('2d Mercado Pago en la línea pequeña', vista('dos_lineas', casoD).linea2, 'con Mercado Pago · al recibir $ 44.900')

// C · botón partido (3060:81617)
igual('3a pago normal', vista('partido', casoA), { cols: [], total: null, contexto: '3 productos · envío incluido', chip: null, enlace: 'Detalle', icono: 'candado', texto: 'Pagar', linea2: null, monto: '$ 64.900', montoEtiqueta: null })
igual('3b anticipo Bold', vista('partido', casoB), { cols: [], total: null, contexto: 'Total $ 64.900 · al recibir $ 44.900', chip: null, enlace: 'Detalle', icono: 'candado', texto: 'Pagar anticipo con Bold', linea2: null, monto: '$ 20.000', montoEtiqueta: null })
igual('3c sin anticipo', vista('partido', casoC), { cols: [], total: null, contexto: 'Pagas todo al recibir: efectivo, datáfono o Nequi', chip: null, enlace: null, icono: 'check', texto: 'Confirmar pedido', linea2: null, monto: '$ 64.900', montoEtiqueta: 'al recibir' })
igual('3c el contexto va en verde', contenidoBarraPago('partido', casoC).contextoAlRecibir, true)
igual('3d «anticipo» sale primero', vista('partido', casoD).texto, 'Pagar con Mercado Pago')
igual('3d la acción de C cabe en su lado', accionAnticipoC('Bold').length <= MAX_ACCION_C, true)
igual('3d el monto nunca cambia', vista('partido', casoD).monto, '$ 20.000')

// Contraentrega SIN anticipo nunca dice «Pagar»: no se cobra nada en línea (error del 2026-11-24).
for (const e of ESTILOS_BARRA_PAGO) {
  const c = contenidoBarraPago(e, casoC)
  igual(`${e}: sin anticipo «Confirmar pedido», nunca «Pagar»`, [c.boton.texto, /pagar/i.test(etiquetaAccesibleBoton(c))], ['Confirmar pedido', false])
}
// Pago normal sin pasarela (efectivo sin condiciones, transferencia): lo de hoy, «Pagar $ X».
igual('sin pasarela: A dice lo de hoy', vista('dos_filas', { ...casoA, pasarela: null }).texto, 'Pagar $ 64.900')
igual('sin pasarela: B sin línea pequeña', vista('dos_lineas', { ...casoA, pasarela: null }).linea2, null)
igual('recoger: sin «envío»', vista('partido', { ...casoA, envio: null, productos: 1 }).contexto, '1 producto')
igual('ahorro en el contexto de C', vista('partido', { ...casoA, ahorro: '$ 5.000' }).contexto, '3 productos · envío incluido · ahorras $ 5.000')

// ── El botón de pagar del checkout (textoBotonAnticipo) ────────────────────────────────────────
const ce = fuente('components/site/contraentrega/OpcionContraentrega.tsx')
igual('textoBotonAnticipo: sin anticipo → «Confirmar pedido»', /if \(!estado\.anticipo\) return 'Confirmar pedido'/.test(ce), true)
igual('textoBotonAnticipo: sin condiciones → null (lo de hoy)', /if \(!estado\?\.disponible\) return null/.test(ce), true)

// ── Resumen del pago, versión 1 ─────────────────────────────────────────────────────────────────
igual('chips de entrega', ['domicilio', 'transportadora', 'recoger', 'comer_aqui'].map((t) => `${chipEntrega(t).etiqueta}:${chipEntrega(t).icono}`), ['Domicilio:truck', 'Transportadora:package', 'Recoger en tienda:store', 'Comer aquí:utensils'])
igual('sellos por defecto → escudo, devolución, paquete', [iconoSello('🔒', 'Compra segura'), iconoSello('✅', 'Devolución garantizada'), iconoSello('🚚', 'Envío rastreado')], [{ linea: 'shield' }, { linea: 'undo' }, { linea: 'package' }])
igual('sello sin ícono (los nuevos del ERP) → escudo', iconoSello('', 'Pago protegido'), { linea: 'shield' })
igual('✅ que no es devolución → insignia', iconoSello('✅', 'Productos originales'), { linea: 'badge' })
igual('emoji propio de la tienda se conserva', iconoSello('🎁', 'Empaque de regalo'), { emoji: '🎁' })

const W = { code: 'wompi_co', name: 'Tarjeta, PSE o Nequi', type: 'gateway' }
const CASH = { code: 'cash', name: 'Pago contra entrega', type: 'native' }
const TR = { code: 'transfer', name: 'Transferencia bancaria', type: 'native' }
const chips = (ms, dom = true) => chipsMediosPago(ms, dom).map((c) => `${c.etiqueta}${c.verde ? '(verde)' : ''}`)
igual('medios: Wompi + transferencia + efectivo (el efectivo al final, en verde)', chips([CASH, W, TR]), ['Tarjeta', 'PSE', 'Nequi', 'Transferencia', 'Efectivo al recibir(verde)'])
igual('medios: solo efectivo, a recoger', chips([CASH], false), ['Efectivo(verde)'])
igual('medios: sin repetidos (Wompi y Bold)', chips([W, { code: 'bold_link', name: 'Bold', type: 'gateway' }]), ['Tarjeta', 'PSE', 'Nequi'])
igual('medios: Mercado Pago no promete Nequi', chips([{ code: 'mp', name: 'MP', type: 'gateway' }]), ['Tarjeta', 'PSE'])
igual('medios: sin métodos, sin sección', chips([]), [])
igual('medios: ya no es la lista fija', fuente('components/site/CheckoutWizard.tsx').includes('Mastercard'), false)

// ── Opciones de pago: ícono a la derecha, nunca la palabra ─────────────────────────────────────
const ICONOS_TIENDA = ['banknotes', 'coins', 'credit-card', 'building-bank', 'arrow-left-right', 'wallet', 'smartphone', 'qr-code', 'globe', 'zap', 'truck', 'store']
// La lista del ERP (PaymentMethodForm.tsx) sigue siendo esta.
try {
  const erp = readFileSync(join(ROOT, '..', 'CascadeProjects', 'go-admin-erp', 'src', 'components', 'finanzas', 'metodos-pago', 'PaymentMethodForm.tsx'), 'utf8')
  const m = /const ICONOS_TIENDA = \[([^\]]+)\]/.exec(erp)
  if (m) igual('ICONOS_TIENDA del ERP sin cambios', m[1].split(',').map((x) => x.trim().replace(/'/g, '')), ICONOS_TIENDA)
} catch {
  // Sin el repo del ERP al lado: se prueba con la lista copiada.
}
const tarjeta = fuente('components/site/checkout/TarjetaMetodoPago.tsx')
for (const nombre of ICONOS_TIENDA) {
  for (const m of [CASH, W, TR, { code: 'otro', name: 'Otro', type: 'native' }]) {
    const r = iconoMetodo({ ...m, icon: nombre })
    casos++
    if ('emoji' in r || !ICONOS_METODO.includes(r.icono)) problemas.push(`«${nombre}» en ${m.code} no se pinta como ícono: ${JSON.stringify(r)}`)
  }
  igual(`«${nombre}» tiene su componente de lucide`, tarjeta.includes(`${/-/.test(ICONO_TIENDA_A_LUCIDE[nombre]) ? `'${ICONO_TIENDA_A_LUCIDE[nombre]}'` : ICONO_TIENDA_A_LUCIDE[nombre]}:`), true)
}
igual('defaults por tipo', [W, { code: 'mp', type: 'gateway' }, { code: 'bold_link', type: 'gateway' }, CASH, TR].map((m) => iconoMetodo(m)), [
  { tono: 'verde', icono: 'wallet' }, { tono: 'azul', icono: 'wallet' }, { tono: 'rojo', icono: 'wallet' }, { tono: 'verde', icono: 'banknote' }, { tono: 'gris', icono: 'landmark' },
])
igual('ícono elegido con el color del tipo', [iconoMetodo({ ...CASH, icon: 'truck' }), iconoMetodo({ ...W, icon: 'credit-card' }), iconoMetodo({ code: 'otro', type: 'native', icon: 'store' })], [
  { tono: 'verde', icono: 'truck' }, { tono: 'verde', icono: 'credit-card' }, { tono: 'gris', icono: 'store' },
])
igual('emoji viejo guardado: tal cual', iconoMetodo({ ...CASH, icon: '💵' }), { emoji: '💵' })
igual('palabra no reconocida: el de su tipo, nunca la palabra', iconoMetodo({ ...CASH, icon: 'camion' }), { tono: 'verde', icono: 'banknote' })
igual('el checkout ya no pinta m.icon como texto', /\{m\.icon \|\|/.test(fuente('components/site/CheckoutWizard.tsx')), false)

igual('instrucciones del ERP en texto plano', descripcionMetodo({ ...CASH, description: '<p>Paga al <strong>recibir</strong> tu pedido&nbsp;</p>' }, true), 'Paga al recibir tu pedido')
igual('descripción por tipo', [descripcionMetodo(W, true), descripcionMetodo(TR, true), descripcionMetodo(CASH, true), descripcionMetodo(CASH, false), descripcionMetodo({ code: 'x', type: 'native' }, true)], [
  'Pago en línea con Wompi', 'Te damos los datos de la cuenta', 'Pagas en efectivo al recibir tu pedido', 'Pagas en efectivo en la tienda', null,
])
igual('texto plano corto recorta con «…»', textoPlanoCorto('a'.repeat(200), 20).length, 20)

// ── Método pedido desde el chat (?metodo=<código>) ─────────────────────────────────────────────
const ACTIVOS = ['wompi_co', 'cash', 'transfer']
igual('traspaso: ?metodo=cash', metodoDeTraspaso('cash', null), 'cash')
igual('traspaso: metodo dentro de customer', metodoDeTraspaso(null, 'bold_link'), 'bold_link')
igual('traspaso: la URL manda sobre customer', metodoDeTraspaso('mp', 'cash'), 'mp')
igual('traspaso: basura no es un código', [metodoDeTraspaso('<script>', 5), metodoDeTraspaso('', '  '), metodoDeTraspaso('a'.repeat(41))], [null, null, null])
igual('sin parámetro: nada se preselecciona (lo de hoy)', metodoPreseleccionado(null, ACTIVOS, null), null)
igual('contraentrega activa y sin condiciones: preseleccionada', metodoPreseleccionado('cash', ACTIVOS, null), 'cash')
igual('contraentrega disponible con condiciones: preseleccionada', metodoPreseleccionado('cash', ACTIVOS, true), 'cash')
igual('contraentrega fuera de zona / bajo el mínimo: no se fuerza', metodoPreseleccionado('cash', ACTIVOS, false), null)
igual('…y queda el primero disponible que no es ella', metodoDeRespaldo('cash', ['cash', 'wompi_co', 'transfer']), 'wompi_co')
igual('método que la tienda web no tiene activo: no se fuerza', metodoPreseleccionado('bold_link', ACTIVOS, null), null)
igual('pasarela activa: preseleccionada', metodoPreseleccionado('wompi_co', ACTIVOS, null), 'wompi_co')
{
  const w = fuente('components/site/CheckoutWizard.tsx')
  igual('el checkout lee ?metodo= junto a cart y customer', w.includes("urlParams.get('metodo')") && w.includes('metodoDeTraspaso(metodoParam, metodoEnCliente)'), true)
  igual('elegir a mano olvida lo que pidió el chat', w.includes('onSeleccionar={() => elegirMetodo(method.id)}') && /const elegirMetodo = \(codigo: string\) => \{\s*setMetodoPedido\(null\)/.test(w), true)
  igual('`metodo` dentro de customer no se guarda como dato del cliente', w.includes('const { metodo, ...datosCliente }'), true)
  igual('sin método pedido el efecto no hace nada', w.includes('if (!metodoPedido) return'), true)
}

// ── Conexiones en el fuente ─────────────────────────────────────────────────────────────────────
const wiz = fuente('components/site/CheckoutWizard.tsx')
const barra = fuente('components/site/checkout/BarraPagoMovil.tsx')
igual('el checkout pinta la barra del celular', wiz.includes('<BarraPagoMovil'), true)
// Checkout v2 (Figma «16 Sitio web» › Checkout v2, lámina D «Un botón que dice la verdad», aprobada
// por el dueño el 2026-11-24): en 1 paso de computador había DOS botones iguales (tarjeta 3 y barra
// fija). Ahora el único es el de debajo del resumen; el celular sigue con esta barra A/B/C.
igual('en computador, un solo botón (debajo del resumen, sin barra fija duplicada)', !wiz.includes('z-40 px-4 py-3 hidden md:block') && /accion=\{isOnePage \? \(/.test(wiz) && wiz.includes('<div className="hidden md:block">'), true)
igual('la barra nueva es solo de celular', barra.includes('md:hidden'), true)
igual('área segura del iPhone', barra.includes('env(safe-area-inset-bottom)'), true)
igual('el espaciador usa el alto real', wiz.includes('style={{ height: altoBarraMovil }}'), true)
igual('el chat sube sobre la barra (useEmpujeChat)', barra.includes('useEmpujeChat(useId(), ref, true, true)'), true)
igual('useEmpujeChat vuelve a medir si cambia el alto', fuente('components/site/barraFija/efectosBarraFija.ts').includes('new ResizeObserver(medir)'), true)
igual('la página lee el estilo del ERP', fuente('app/checkout/page.tsx').includes('checkout_mobile_bar_style'), true)
igual('opciones de pago: radio a la izquierda', fuente('components/site/checkout/TarjetaMetodoPago.tsx').includes('role="radio"'), true)
igual('contraentrega: el desglose sigue dentro de la tarjeta', wiz.includes('sinMontos />') && wiz.includes('<MotivoContraentrega'), true)

if (problemas.length > 0) {
  console.error(`✗ verify-barra-pago: ${problemas.length} de ${casos} fallaron`)
  for (const p of problemas) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`✓ verify-barra-pago: ${casos} comprobaciones (3 estilos × 4 casos, resumen v1, íconos de la tienda)`)
