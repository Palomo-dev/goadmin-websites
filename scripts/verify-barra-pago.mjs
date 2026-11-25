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
 * chat 12 px por encima). Desde el 2026-11-25 también la barra de computador (Figma 3214:110908):
 * los tres estilos con los cuatro casos, el resumen corto de la izquierda, el estado apagado con
 * motivo y que el botón siga siendo el mismo (`handleSubmit`, mismo `disabled`). Sin dependencias
 * ni base.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ESTILOS_BARRA_PAGO,
  ESTILO_BARRA_POR_DEFECTO,
  MAX_ACCION_C,
  MAX_ACCION_C_COMPUTADOR,
  MAX_TEXTO_BOTON_A_COMPUTADOR,
  accionAnticipoC,
  contenidoBarraPago,
  contenidoBarraPagoComputador,
  etiquetaAccesibleBoton,
  motivoBarraApagada,
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
// 2026-11-25: el dueño quiere de vuelta la barra fija en computador («sticky cart»): la de siempre.
igual('en computador, la barra A/B/C (BarraPagoComputador) con el mismo estilo de la tienda', wiz.includes('<BarraPagoComputador') && wiz.includes('contenidoBarraPagoComputador(normalizarEstiloBarraPago(settings.barraPagoMovil), casoBarra,'), true)
igual('la barra nueva es solo de celular', barra.includes('md:hidden'), true)
igual('área segura del iPhone', barra.includes('env(safe-area-inset-bottom)'), true)
igual('el espaciador usa el alto real', wiz.includes('style={{ height: altoBarraMovil }}'), true)
igual('el chat sube sobre la barra (useEmpujeChat)', barra.includes('useEmpujeChat(useId(), ref, true, true)'), true)
igual('useEmpujeChat vuelve a medir si cambia el alto', fuente('components/site/barraFija/efectosBarraFija.ts').includes('new ResizeObserver(medir)'), true)
igual('la página lee el estilo del ERP', fuente('app/checkout/page.tsx').includes('checkout_mobile_bar_style'), true)
igual('opciones de pago: radio a la izquierda', fuente('components/site/checkout/TarjetaMetodoPago.tsx').includes('role="radio"'), true)
igual('contraentrega: el desglose sigue dentro de la tarjeta', wiz.includes('sinMontos />') && wiz.includes('<MotivoContraentrega'), true)

// ── Computador (Figma 3214:110908, aprobada 2026-11-25) ────────────────────────────────────────
const R = { productos: 3, envio: 'incluido', ahorro: null, cobroEnBase: null }
const casoT = { tipo: 'confirmar', total: '$ 64.900', productos: 3, envio: 'incluido', medio: 'transferencia' }
const vistaPc = (estilo, caso, r = R) => {
  const c = contenidoBarraPagoComputador(estilo, caso, r)
  return {
    productos: c.productos,
    contexto: c.contexto.map((p) => `${p.icono ? `[${p.icono}]` : ''}${p.texto}${p.verde ? '(verde)' : ''}`),
    cols: c.columnas.map((x) => `${x.etiqueta}=${x.valor}${x.destacado ? '*' : ''}`),
    total: c.total,
    icono: c.boton.icono,
    texto: c.boton.texto,
    linea2: c.boton.linea2,
    monto: c.boton.monto,
    montoEtiqueta: c.boton.montoEtiqueta,
  }
}
const ahorro5 = { ...R, ahorro: '$ 5.000' }

// A · los montos al lado del botón; la pasarela y «anticipo» caben dentro
igual('pc A1 pago Wompi', vistaPc('dos_filas', casoA, ahorro5), { productos: '3 productos', contexto: ['[paquete]Envío incluido', '[porcentaje]Ahorras $ 5.000(verde)'], cols: ['Total=$ 64.900*'], total: null, icono: 'candado', texto: 'Pagar $ 64.900 con Wompi', linea2: null, monto: null, montoEtiqueta: null })
igual('pc A2 anticipo Bold', vistaPc('dos_filas', casoB), { productos: '3 productos', contexto: ['[paquete]Envío incluido', '[billete]Contraentrega'], cols: ['Total=$ 64.900', 'Hoy pagas=$ 20.000*', 'Al recibir=$ 44.900'], total: null, icono: 'candado', texto: 'Pagar anticipo $ 20.000 con Bold', linea2: null, monto: null, montoEtiqueta: null })
igual('pc A3 transferencia', vistaPc('dos_filas', casoT), { productos: '3 productos', contexto: ['[paquete]Envío incluido', 'Pagas con transferencia'], cols: ['Total=$ 64.900*'], total: null, icono: 'check', texto: 'Confirmar pedido', linea2: null, monto: null, montoEtiqueta: null })
igual('pc A sin anticipo: «Confirmar pedido» y todo al recibir en verde', vistaPc('dos_filas', casoC), { productos: '3 productos', contexto: ['[paquete]Envío incluido', '[billete]Pagas todo al recibir: efectivo, datáfono o Nequi(verde)'], cols: ['Total=$ 64.900*'], total: null, icono: 'check', texto: 'Confirmar pedido', linea2: null, monto: null, montoEtiqueta: null })
igual('pc A Mercado Pago cabe', vistaPc('dos_filas', casoD).texto, 'Pagar anticipo $ 20.000 con Mercado Pago')
igual('pc A nombre que no cabe: sin «con …»', vistaPc('dos_filas', { ...casoB, pasarela: 'Pasarela De Pagos Internacional' }).texto, 'Pagar anticipo $ 20.000')
igual('pc A el texto nunca pasa su máximo', ['Wompi', 'Mercado Pago', 'Pasarela De Pagos Internacional'].every((p) => vistaPc('dos_filas', { ...casoB, pasarela: p }).texto.length <= MAX_TEXTO_BOTON_A_COMPUTADOR), true)
igual('pc A sin pasarela: «Pagar $ X» (lo de hoy)', vistaPc('dos_filas', { ...casoA, pasarela: null }).texto, 'Pagar $ 64.900')

// B · igual que en celular (la regla del botón no se duplica)
igual('pc B1 pago Wompi', vistaPc('dos_lineas', casoA, ahorro5), { productos: '3 productos', contexto: ['[paquete]Envío incluido', '[porcentaje]Ahorras $ 5.000(verde)'], cols: [], total: '$ 64.900', icono: 'candado', texto: 'Pagar $ 64.900', linea2: 'Pago seguro con Wompi', monto: null, montoEtiqueta: null })
igual('pc B2 anticipo Bold', vistaPc('dos_lineas', casoB), { productos: '3 productos', contexto: ['[paquete]Envío incluido', '[billete]Contraentrega con anticipo'], cols: [], total: '$ 64.900', icono: 'candado', texto: 'Pagar anticipo · $ 20.000', linea2: 'con Bold · al recibir $ 44.900', monto: null, montoEtiqueta: null })
igual('pc B3 transferencia', vistaPc('dos_lineas', casoT), { productos: '3 productos', contexto: ['[paquete]Envío incluido', 'Pagas con transferencia'], cols: [], total: '$ 64.900', icono: 'check', texto: 'Confirmar pedido', linea2: 'Pagas con transferencia', monto: null, montoEtiqueta: null })
for (const caso of [casoA, casoB, casoC, casoD, casoT]) {
  igual(`pc B = botón del celular (${caso.tipo}${caso.pasarela ? ` ${caso.pasarela}` : ''})`, contenidoBarraPagoComputador('dos_lineas', caso, R).boton, contenidoBarraPago('dos_lineas', caso).boton)
}

// C · botón partido (por defecto): acción con la pasarela, monto siempre a la derecha
igual('pc C1 pago Wompi', vistaPc('partido', casoA, ahorro5), { productos: '3 productos', contexto: ['[paquete]Envío incluido', '[porcentaje]Ahorras $ 5.000(verde)'], cols: [], total: null, icono: 'candado', texto: 'Pagar con Wompi', linea2: null, monto: '$ 64.900', montoEtiqueta: null })
igual('pc C2 anticipo Bold: «hoy» sobre el monto, total y puerta a la izquierda', vistaPc('partido', casoB), { productos: '3 productos', contexto: ['[billete]Total $ 64.900', 'al recibir $ 44.900'], cols: [], total: null, icono: 'candado', texto: 'Pagar anticipo con Bold', linea2: null, monto: '$ 20.000', montoEtiqueta: 'hoy' })
igual('pc C3 transferencia', vistaPc('partido', casoT), { productos: '3 productos', contexto: ['[paquete]Envío incluido', 'Pagas con transferencia'], cols: [], total: null, icono: 'check', texto: 'Confirmar pedido', linea2: null, monto: '$ 64.900', montoEtiqueta: null })
igual('pc C sin anticipo: «al recibir» sobre el monto', vistaPc('partido', casoC), { productos: '3 productos', contexto: ['[paquete]Envío incluido', '[billete]Pagas todo al recibir: efectivo, datáfono o Nequi(verde)'], cols: [], total: null, icono: 'check', texto: 'Confirmar pedido', linea2: null, monto: '$ 64.900', montoEtiqueta: 'al recibir' })
igual('pc C Mercado Pago: en computador sí cabe «anticipo»', vistaPc('partido', casoD).texto, 'Pagar anticipo con Mercado Pago')
igual('pc C nombre largo: «Pagar con …» (el CSS recorta)', accionAnticipoC('Pasarela De Pagos Internacional', MAX_ACCION_C_COMPUTADOR), 'Pagar con Pasarela De Pagos Internacional')
igual('pc C sin pasarela: «Pagar»', vistaPc('partido', { ...casoA, pasarela: null }).texto, 'Pagar')
igual('celular C sigue igual con Mercado Pago (máximo del celular)', vista('partido', casoD).texto, 'Pagar con Mercado Pago')

// Resumen corto de la izquierda
igual('pc recoger: sin envío', vistaPc('partido', { ...casoA, envio: null }, { ...R, productos: 1, envio: null }).contexto, [])
igual('pc 1 producto en singular', vistaPc('partido', casoA, { ...R, productos: 1 }).productos, '1 producto')
igual('pc envío gratis', vistaPc('partido', casoA, { ...R, envio: 'gratis' }).contexto, ['[paquete]Envío gratis'])
{
  const c = contenidoBarraPagoComputador('partido', casoA, { ...R, cobroEnBase: 'Se cobra en COP: $ 64.900' })
  igual('pc «Se cobra en COP» al final del contexto, marcado', c.contexto[c.contexto.length - 1], { texto: 'Se cobra en COP: $ 64.900', icono: null, verde: false, cobroEnBase: true })
}
// Contraentrega SIN anticipo nunca dice «Pagar» en computador
for (const e of ESTILOS_BARRA_PAGO) {
  const c = contenidoBarraPagoComputador(e, casoC, R)
  igual(`pc ${e}: sin anticipo nunca «Pagar»`, /pagar/i.test(etiquetaAccesibleBoton(c)), false)
}
igual('pc etiqueta accesible de C con anticipo', etiquetaAccesibleBoton(contenidoBarraPagoComputador('partido', casoB, R)), 'Pagar anticipo con Bold, hoy $ 20.000')

// Estado apagado: solo con un motivo que el checkout ya conoce
igual('apagado con motivo', motivoBarraApagada(true, false, 'No llega a tu dirección con pago contra entrega.'), 'No llega a tu dirección con pago contra entrega.')
igual('apagado sin motivo: solo el botón apagado', [motivoBarraApagada(true, false, null), motivoBarraApagada(true, false, '  '), motivoBarraApagada(true, false, undefined)], [null, null, null])
igual('procesando: nunca motivo', motivoBarraApagada(true, true, 'algo'), null)
igual('encendido: nunca motivo', motivoBarraApagada(false, false, 'algo'), null)

// Conexiones de la barra de computador
{
  const pc = fuente('components/site/checkout/BarraPagoComputador.tsx')
  igual('pc solo computador, fija abajo, z-40, fondo blanco', pc.includes('fixed inset-x-0 bottom-0 z-40 hidden border-t bg-white') && pc.includes('md:block'), true)
  igual('pc componente cliente sin módulos de servidor', /^'use client'\r?\n/.test(pc) && !/from '@\/lib\/supabase|server-only|next\/headers/.test(pc), true)
  igual('pc el botón usa la etiqueta accesible y el mismo spinner', pc.includes("'aria-label': procesando ? undefined : etiquetaAccesibleBoton(c)") && pc.includes('Procesando...'), true)
  igual('pc foco visible en los botones', pc.includes('focus-visible:ring-2'), true)
  igual('pc estado apagado: «Falta un dato para pagar» + «Ir al campo»', pc.includes('Falta un dato para pagar') && pc.includes('Ir al campo'), true)
  igual('pc siempre visible: sin IntersectionObserver ni inert', !/IntersectionObserver|inert/.test(pc), true)
  igual('pc el checkout la pinta con handleSubmit y el disabled de siempre', /<BarraPagoComputador[\s\S]*?deshabilitado=\{submitting \|\| ceBloqueada\}[\s\S]*?onPagar=\{\(\) => handleSubmit\(\)\}/.test(wiz), true)
  igual('pc «Ver resumen» = irAlResumen; motivo solo el que ya existe (contraentrega)', /<BarraPagoComputador[\s\S]*?onDetalle=\{irAlResumen\}/.test(wiz) && wiz.includes('motivoBarraApagada(submitting || ceBloqueada, submitting, motivoCe)'), true)
  igual('pc espaciador con el alto real de la barra', wiz.includes('style={{ height: altoBarraComputador }}'), true)
  igual('pc la barra vieja ya no está', !wiz.includes('z-40 px-4 py-3 hidden md:block'), true)
}

if (problemas.length > 0) {
  console.error(`✗ verify-barra-pago: ${problemas.length} de ${casos} fallaron`)
  for (const p of problemas) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`✓ verify-barra-pago: ${casos} comprobaciones (3 estilos × 4 casos en celular y en computador, resumen v1, íconos de la tienda)`)
