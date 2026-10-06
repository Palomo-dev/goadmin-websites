/**
 * Mesa de muestra para el lienzo del editor (vista previa sin QR): las secciones de mesa se ven
 * como en las láminas 04, 08 y 17 («Mesa 7», «Terraza», tres rondas, total 236.000) en vez de
 * quedar vacías. Solo se usa con `?preview=1`; el sitio público nunca la muestra.
 */

import type { MesaGuardada } from '@/lib/restaurant/mesaQR'
import type { CuentaMesa, PedidoMesa } from '@/lib/restaurant/mesa-modelo'
import type { LineaRonda } from '@/lib/restaurant/mesaStore'

export const MESA_MUESTRA: MesaGuardada = {
  mesa: '00000000-0000-4000-8000-000000000007',
  sede: null,
  expira: Number.MAX_SAFE_INTEGER,
  nombre: 'Mesa 7',
  zona: 'Terraza',
  nombreSede: 'Sede Centro',
}

const hoy = new Date()
const a = (h: number, m: number) => new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), h, m).toISOString()

export const PEDIDO_MUESTRA: PedidoMesa = {
  mesa: { id: MESA_MUESTRA.mesa, nombre: 'Mesa 7', zona: 'Terraza', sedeId: null, sede: 'Sede Centro' },
  sesion: { estado: 'active', abiertaDesde: a(19, 42), personas: 4, mesero: 'Camilo' },
  rondas: [
    {
      clave: 'r1', numero: 1, origen: 'mesero', creada: a(19, 48), comensal: null, estado: 'servida', listaAt: null, subtotal: 74000,
      items: [
        { id: 'a', nombre: 'Burrata', cantidad: 1, total: 42000, modificadores: [], nota: null, comensal: 'Ana', estado: 'servida', pagada: false },
        { id: 'b', nombre: 'Empanaditas', cantidad: 1, total: 26000, modificadores: [], nota: null, comensal: 'Yo', estado: 'servida', pagada: false },
        { id: 'c', nombre: 'Agua', cantidad: 1, total: 6000, modificadores: [], nota: null, comensal: 'Luis', estado: 'servida', pagada: false },
      ],
    },
    {
      clave: 'r2', numero: 2, origen: 'web', creada: a(20, 5), comensal: 'Luis', estado: 'en_preparacion', listaAt: null, subtotal: 76000,
      items: [
        { id: 'd', nombre: 'Ceviche de corvina', cantidad: 2, total: 76000, modificadores: [], nota: null, comensal: 'Luis', estado: 'en_preparacion', pagada: false },
      ],
    },
  ],
  total: 150000,
  impuesto: 11111,
  impuestoIncluido: true,
  solicitudes: [],
}

export const RONDA_MUESTRA: LineaRonda[] = [
  { id: 'm1', productId: 1, nombre: 'Lomo al carbón', precio: 72000, cantidad: 1, modificadores: ['Término medio', 'Papas rústicas'], nota: null, comensal: 'Yo', imagen: null },
  { id: 'm2', productId: 2, nombre: 'Limonada de coco', precio: 14000, cantidad: 1, modificadores: [], nota: 'Sin hielo', comensal: 'Ana', imagen: null },
]

export const CUENTA_MUESTRA: CuentaMesa = {
  ...PEDIDO_MUESTRA,
  rondas: [
    ...PEDIDO_MUESTRA.rondas,
    {
      clave: 'r3', numero: 3, origen: 'web', creada: a(20, 31), comensal: 'Yo', estado: 'enviada', listaAt: null, subtotal: 86000,
      items: [
        { id: 'e', nombre: 'Lomo al carbón', cantidad: 1, total: 72000, modificadores: [], nota: null, comensal: 'Yo', estado: 'enviada', pagada: false },
        { id: 'f', nombre: 'Limonada de coco', cantidad: 1, total: 14000, modificadores: [], nota: null, comensal: 'Ana', estado: 'enviada', pagada: false },
      ],
    },
  ],
  total: 236000,
  impuesto: 17481,
  cuenta: {
    moneda: 'COP',
    total: 236000,
    pagado: 0,
    saldo: 236000,
    tolerancia: 1,
    propina: 0,
    impuesto: 17481,
    impuestoIncluido: true,
    porComensal: [
      { comensal: 'Yo', total: 98000, pendiente: 98000, lineas: 2 },
      { comensal: 'Ana', total: 56000, pendiente: 56000, lineas: 2 },
      { comensal: 'Luis', total: 82000, pendiente: 82000, lineas: 2 },
    ],
    abonos: [],
    pasarela: 'wompi_co',
  },
}
