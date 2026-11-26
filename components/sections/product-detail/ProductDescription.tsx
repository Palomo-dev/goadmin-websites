'use client'

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { PestanasFicha } from './PestanasFicha'
import { filasEnvioFicha, type ClaveFilaEnvio, type FilaEnvioFicha } from './filasEnvio'
import { ChevronDown, Clock, RefreshCw, Truck } from 'lucide-react'
import { ExpandableDescription, renderRichText } from '@/components/site/ExpandableDescription'
import { textoPlano } from '@/lib/texto/textoPlano'
import { textoDimensiones, textoGarantia, textoPeso } from '@/lib/website/v2/contrato/seccionesTienda'
import {
  ETIQUETAS_FILA_FICHA,
  PX_TEXTO,
  leerFilasPropias,
  leerOpcionesDescripcion,
  type FilaFicha,
  type OpcionesDescripcion,
  type ParteDescripcion,
} from '@/lib/website/v2/seccionesFicha'

export const CONTENT_KEYS = ['layout', 'max_height', 'show_specs'] as const

interface ProductDescriptionProps {
  content: {
    layout?: string
    max_height?: number
    show_specs?: boolean
    [clave: string]: unknown
  }
  primaryColor?: string
  data?: {
    product?: any
    categoriaFicha?: { name?: string | null } | null
    faqFicha?: Array<{ question?: string; answer?: string }> | null
    /** Líneas de envío (bloque 2): las calcula ProductDetailRenderer. */
    filasEnvio?: FilaEnvioFicha[] | null
    /** Dentro de la pestaña «Descripción» de la ficha (PestanasFicha). */
    enPestanaFicha?: boolean
  }
}

/**
 * Descripción de la ficha. Sin claves nuevas, lo de siempre (título + «Ver más» por letras). Con
 * las opciones de la sección (Figma 2990:74500, `lib/website/v2/seccionesFicha.ts`): Texto con
 * «Ver más» (por líneas y con degradado), Pestañas, Acordeón o Ficha técnica en tabla, con las
 * partes Descripción, Especificaciones, Envío y devoluciones y Preguntas frecuentes.
 *
 * Los estilos Pestañas y Acordeón pintan la pieza única de pestañas de la tienda (PestanasFicha).
 * Dentro de la pestaña «Descripción» de la ficha (`data.enPestanaFicha`, Figma 3255-99475): solo
 * el texto, con «Ver más» a las 5 líneas (o las elegidas) y la fila Marca · Referencia · Categoría,
 * o en «Ficha en tabla» texto y tabla (sin pestañas dentro de pestañas).
 */
export function ProductDescription({ content, primaryColor = '#3B82F6', data }: ProductDescriptionProps) {
  const product = data?.product
  const opciones = useMemo(() => leerOpcionesDescripcion(content as Record<string, unknown>), [content])
  if (data?.enPestanaFicha === true) {
    return product
      ? <DescripcionEnPestana o={opciones} product={product} categoria={data?.categoriaFicha?.name ?? null} faq={data?.faqFicha ?? null} primaryColor={primaryColor} envio={data?.filasEnvio ?? null} />
      : null
  } else {
    // Fuera de las pestañas de la ficha: lo de siempre.
  }
  if (opciones.conOpciones && product) {
    return <DescripcionConOpciones o={opciones} product={product} categoria={data?.categoriaFicha?.name ?? null} faq={data?.faqFicha ?? null} primaryColor={primaryColor} envio={data?.filasEnvio ?? null} />
  } else {
    // Sin opciones nuevas: lo de siempre.
  }
  if (!product?.description) return null

  return (
    <div>
      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Descripción</h3>
      <ExpandableDescription text={product.description} maxLength={content.max_height || 180} />
    </div>
  )
}

// ─── Con opciones (Figma 2990:74500 / 2990:74788) ─────────────────────────────────────────

function textoColumna(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const t = valor.trim().replace(/\s+/g, ' ')
  return t ? t.slice(0, 120) : null
}

/** Filas de la ficha técnica: columnas de `products` elegidas + filas propias del producto. */
export function filasFicha(product: any, categoria: string | null, o: Pick<OpcionesDescripcion, 'filas' | 'ocultarVacias' | 'filasPropias'>): { nombre: string; valor: string }[] {
  const valorDe = (f: FilaFicha): string | null => {
    switch (f) {
      case 'marca': return textoColumna(product?.brand)
      case 'referencia': return textoColumna(product?.reference)
      case 'medidas': return textoDimensiones(product?.length_cm, product?.width_cm, product?.height_cm)
      case 'peso': return textoPeso(product?.weight_kg)
      case 'garantia': return textoGarantia(product?.warranty_months)
      case 'categoria': return textoColumna(categoria)
      default: return null
    }
  }
  const filas = o.filas
    .map((f) => ({ nombre: ETIQUETAS_FILA_FICHA[f], valor: valorDe(f) ?? '' }))
    .filter((f) => !o.ocultarVacias || f.valor)
    .map((f) => ({ nombre: f.nombre, valor: f.valor || '—' }))
  return o.filasPropias ? [...filas, ...leerFilasPropias(product?.specifications)] : filas
}

/** Fila corta bajo la descripción en su pestaña (Figma 3256-99475): solo datos reales. */
const FILAS_EN_PESTANA = { filas: ['marca', 'referencia', 'categoria'] as FilaFicha[], ocultarVacias: true, filasPropias: false }

/** Parte «Envío»: las mismas líneas del bloque «Envío y devoluciones» (sin «Cobertura», como siempre). */
const LINEAS_ENVIO: Partial<Record<ClaveFilaEnvio, { icono: typeof Clock; titulo: string }>> = {
  entrega: { icono: Clock, titulo: 'Tiempo de entrega' },
  costo: { icono: Truck, titulo: 'Costo de envío' },
  devoluciones: { icono: RefreshCw, titulo: 'Cambios y devoluciones' },
}

interface PropsConOpciones {
  o: OpcionesDescripcion
  product: any
  categoria: string | null
  faq: Array<{ question?: string; answer?: string }> | null
  primaryColor: string
  /** Líneas de envío de la ficha (`filasEnvioFicha`). Sin ellas, las frases de siempre. */
  envio?: FilaEnvioFicha[] | null
}

/**
 * Descripción dentro de la pestaña «Descripción» de la ficha. Solo la parte «Descripción»: las
 * demás (Características, Envío y devoluciones, Reseñas…) son pestañas del bloque «Pestañas de la
 * ficha». Del «Estilo» valen «Texto con Ver más» (con «Líneas antes de Ver más», 5 si no se eligió)
 * y «Ficha en tabla» (texto a la izquierda, tabla a la derecha); «Pestañas» y «Acordeón» serían
 * pestañas dentro de pestañas y se ven como «Texto con Ver más». Sin nada que mostrar, nada (y la
 * pestaña no aparece).
 */
function DescripcionEnPestana({ o, product, categoria, faq, envio }: PropsConOpciones) {
  const enTabla = o.estilo === 'tabla'
  const opciones = useMemo<OpcionesDescripcion>(
    () => ({
      ...o,
      estilo: enTabla ? 'tabla' : 'ver_mas',
      lineas: o.lineas ?? 5,
      partes: enTabla ? ['descripcion', 'especificaciones'] : ['descripcion'],
    }),
    [o, enTabla],
  )
  const partes = usePartes(opciones, product, categoria, faq, envio)
  const fila = useMemo(() => filasFicha(product, categoria, FILAS_EN_PESTANA), [product, categoria])
  const conTexto = partes.lista.includes('descripcion')
  if (enTabla) {
    const conTabla = partes.lista.includes('especificaciones')
    if (!conTexto && !conTabla) return null
    return (
      <div className="grid gap-8 lg:grid-cols-2" data-descripcion="pestana-tabla">
        {conTexto && <div>{partes.cuerpo('descripcion', false)}</div>}
        {conTabla && partes.tabla}
      </div>
    )
  } else {
    // Texto con «Ver más» (también con Pestañas y Acordeón: dentro de una pestaña no aplican).
  }
  const conFila = fila.length > 0
  if (!conTexto && !conFila) return null
  return (
    <div className={partes.ancho} data-descripcion="pestana">
      {conTexto && partes.cuerpo('descripcion', true)}
      {conFila && (
        <dl
          className={`inline-flex flex-wrap gap-x-8 gap-y-3 border-t pt-4 text-sm ${conTexto ? 'mt-6' : ''}`}
          style={{ borderColor: 'color-mix(in srgb, var(--text-color, #111827) 12%, transparent)' }}
          data-fila-descripcion=""
        >
          {fila.map((f) => (
            <div key={f.nombre} className="flex min-w-0 flex-col-reverse">
              <dt className="text-xs text-gray-500 dark:text-gray-400">{f.nombre}</dt>
              <dd className="font-medium text-gray-900 [overflow-wrap:anywhere] dark:text-white">{f.valor}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

/** Partes con contenido y el cuerpo de cada una (lo comparten todos los estilos). */
function usePartes(o: OpcionesDescripcion, product: any, categoria: string | null, faq: PropsConOpciones['faq'], envio: PropsConOpciones['envio'] = null) {
  const lineasEnvio = (envio ?? filasEnvioFicha(null, null)).filter((f) => LINEAS_ENVIO[f.clave])
  const descripcion = useMemo(() => textoPlano(product?.description ?? ''), [product?.description])
  const filas = useMemo(() => filasFicha(product, categoria, o), [product, categoria, o])
  const preguntas = (faq ?? []).filter((f) => f?.question && f?.answer)
  const estiloTexto: CSSProperties = { fontSize: PX_TEXTO[o.tamanoTexto] }
  const ancho = o.ancho === 'comodo' ? 'max-w-[760px]' : ''

  // Partes con contenido (sin contenido no se pintan ni su pestaña).
  const lista = o.partes.filter((p) => {
    if (p === 'descripcion') return Boolean(descripcion.trim())
    if (p === 'especificaciones') return filas.length > 0
    if (p === 'preguntas') return preguntas.length > 0
    return true
  })

  const tabla = (
    <dl className={`overflow-hidden text-sm ${o.tabla === 'sin' ? '' : 'rounded-xl border border-gray-200 dark:border-gray-700'}`} data-ficha-tabla={o.tabla}>
      {filas.map((f, i) => (
        <div
          key={`${f.nombre}-${i}`}
          className={`grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 px-4 py-2.5 ${o.tabla === 'rayada' && i % 2 === 0 ? 'bg-gray-50 dark:bg-gray-800/50' : ''} ${o.tabla === 'lineas' && i > 0 ? 'border-t border-gray-200 dark:border-gray-700' : ''}`}
        >
          <dt className="text-gray-600 dark:text-gray-300">{f.nombre}</dt>
          <dd className="font-medium text-gray-900 dark:text-white">{f.valor}</dd>
        </div>
      ))}
    </dl>
  )

  const cuerpo = (p: ParteDescripcion, recortar: boolean): ReactNode => {
    if (p === 'descripcion') return recortar && o.estilo === 'ver_mas' ? <TextoVerMas texto={descripcion} o={o} /> : <div style={estiloTexto}>{renderRichText(descripcion, o.vinetas)}</div>
    if (p === 'especificaciones') return tabla
    if (p === 'envio') {
      return (
        <ul className="space-y-3">
          {lineasEnvio.map(({ clave, texto }) => {
            const { icono: Icono, titulo } = LINEAS_ENVIO[clave]!
            return (
            <li key={clave} className="flex items-start gap-3">
              <Icono className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />
              <span>
                <span className="block text-sm font-medium text-gray-900 dark:text-white">{titulo}</span>
                <span className="block text-sm text-gray-600 dark:text-gray-300">{texto}</span>
              </span>
            </li>
            )
          })}
        </ul>
      )
    }
    return (
      <dl className="space-y-3">
        {preguntas.map((f, i) => (
          <div key={i}>
            <dt className="text-sm font-medium text-gray-900 dark:text-white">{f.question}</dt>
            <dd className="mt-1 text-sm text-gray-600 dark:text-gray-300">{f.answer}</dd>
          </div>
        ))}
      </dl>
    )
  }

  return { lista, tabla, cuerpo, ancho }
}

function DescripcionConOpciones({ o, product, categoria, faq, primaryColor, envio }: PropsConOpciones) {
  const { lista: partes, tabla, cuerpo, ancho } = usePartes(o, product, categoria, faq, envio)
  if (partes.length === 0) return null

  // A · Texto con «Ver más»: cada parte con su título, apiladas.
  if (o.estilo === 'ver_mas') {
    return (
      <div className={`space-y-8 ${ancho}`} data-descripcion="ver_mas">
        {partes.map((p) => (
          <section key={p}>
            <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">{o.titulos[p]}</h3>
            {cuerpo(p, true)}
          </section>
        ))}
      </div>
    )
  }

  // D · Ficha técnica en tabla: descripción (y envío/preguntas) a la izquierda, tabla a la derecha.
  if (o.estilo === 'tabla') {
    const izquierda = partes.filter((p) => p !== 'especificaciones')
    return (
      <div className="grid gap-8 lg:grid-cols-2" data-descripcion="tabla">
        <div className="space-y-6">
          {izquierda.map((p) => (
            <section key={p}>
              <h3 className="mb-2 text-xl font-bold text-gray-900 dark:text-white">{o.titulos[p]}</h3>
              {cuerpo(p, false)}
            </section>
          ))}
        </div>
        {partes.includes('especificaciones') && (
          <section>
            <h3 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">{o.titulos.especificaciones}</h3>
            {tabla}
          </section>
        )}
      </div>
    )
  }

  // B · Pestañas (en celular, acordeón si así se eligió) y C · Acordeón: la pieza única de
  // pestañas de la tienda (PestanasFicha), con teclado y sin JavaScript apiladas.
  return (
    // `key`: «Abierta al cargar» se ve en vivo en el lienzo (el estado nace con ella).
    <PestanasFicha
      key={o.abierta}
      items={partes.map((p) => ({ id: p, titulo: o.titulos[p], contenido: cuerpo(p, false) }))}
      colorActivo={o.colorPestana === 'tienda' ? primaryColor : 'currentColor'}
      celular={o.celular === 'acordeon' ? 'acordeon' : 'pestanas'}
      estilo={o.estilo === 'acordeon' ? 'acordeon' : 'pestanas'}
      variasAbiertas={o.variasAbiertas}
      abierta={o.abierta}
      etiqueta="Descripción del producto"
      titulos="parte"
      ancho={ancho}
      marca={o.estilo === 'acordeon' ? 'data-descripcion-acordeon' : 'data-descripcion-pestanas'}
    />
  )
}

/** «Ver más» por líneas (con degradado) o por letras (como hoy) si no se eligieron líneas. */
function TextoVerMas({ texto, o }: { texto: string; o: OpcionesDescripcion }) {
  const [abierto, setAbierto] = useState(false)
  // Por letras (como hoy), con la viñeta y el tamaño del texto elegidos (antes no llegaban aquí).
  if (o.lineas === null) {
    return (
      <div style={{ fontSize: PX_TEXTO[o.tamanoTexto] }}>
        <ExpandableDescription text={texto} maxLength={o.letras} vineta={o.vinetas} />
      </div>
    )
  }
  const largo = texto.split('\n').filter((l) => l.trim()).length > o.lineas || texto.length > o.lineas * 90
  const alto = `${o.lineas * 1.65}em`
  return (
    <div>
      <div className="relative overflow-hidden" style={{ fontSize: PX_TEXTO[o.tamanoTexto], maxHeight: !abierto && largo ? alto : undefined }}>
        {renderRichText(texto, o.vinetas)}
        {!abierto && largo && <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-transparent dark:from-gray-900" />}
      </div>
      {largo && (
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          className="mt-2 inline-flex items-center gap-1 text-sm font-medium"
          style={{ color: 'var(--primary-color, #2563eb)' }}
        >
          {abierto ? 'Ver menos' : 'Ver más'}
          <ChevronDown className={`h-4 w-4 transition-transform ${abierto ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
