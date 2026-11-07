'use client'

/**
 * Marca gigante del pie (`footer_brand_display: 'giant'`, plantillas de tienda Radiante, Roble y
 * Marea): el nombre de la tienda en la fuente de títulos, ajustado al ancho del pie, y encima, si
 * la hay, la figura de `footer_brand_figure_url` (PNG recortado, Marea).
 *
 * Tamaño: arranca con una estimación en unidades del contenedor (`cqw`, sin saltos en el primer
 * pintado) y, ya en el navegador y con la fuente cargada, se mide el texto y se ajusta para que
 * ocupe el ancho exacto. Peso y mayúsculas por familia (`PRESENTACION_MARCA`): el resto, el texto
 * tal cual lo escribió la tienda en 400.
 *
 * Sin la opción no se monta (SiteFooter pasa `null`): el pie de hoy.
 */
import { useEffect, useRef, useState } from 'react'

/** Cómo luce la marca con la fuente de títulos de cada plantilla (láminas aprobadas). */
export const PRESENTACION_MARCA: Readonly<Record<string, { peso: number; mayusculas: boolean }>> = {
  // Marea: Archivo Black en mayúsculas (la hoja pide 800/900 con la marca gigante).
  Archivo: { peso: 900, mayusculas: true },
  // Radiante: Instrument Serif solo existe en 400.
  'Instrument Serif': { peso: 400, mayusculas: true },
}
const PRESENTACION_POR_DEFECTO = { peso: 400, mayusculas: false }

/** Ancho medio de un carácter en em: solo para el primer pintado (después se mide). */
const ANCHO_CARACTER_EM = 0.6

export function presentacionMarca(fuenteTitulos: string | null | undefined): { peso: number; mayusculas: boolean } {
  const familia = (fuenteTitulos ?? '').replace(/['"]/g, '').split(',')[0].trim()
  return PRESENTACION_MARCA[familia] ?? PRESENTACION_POR_DEFECTO
}

export function PieMarca({ nombre, figuraUrl }: { nombre: string; figuraUrl: string | null }) {
  const cajaRef = useRef<HTMLDivElement>(null)
  const textoRef = useRef<HTMLSpanElement>(null)
  const [tamano, setTamano] = useState<number | null>(null)
  const [presentacion, setPresentacion] = useState(PRESENTACION_POR_DEFECTO)
  const texto = nombre.trim()

  // La fuente de títulos sale del tema (variable CSS de la raíz del sitio).
  useEffect(() => {
    const caja = cajaRef.current
    if (!caja) return
    const p = presentacionMarca(getComputedStyle(caja).getPropertyValue('--font-heading'))
    setPresentacion((actual) => (actual.peso === p.peso && actual.mayusculas === p.mayusculas ? actual : p))
  }, [])

  // Se mide con el peso y las mayúsculas ya puestos (dependen de `presentacion`).
  useEffect(() => {
    const caja = cajaRef.current
    const span = textoRef.current
    if (!caja || !span) return
    let vivo = true
    const medir = () => {
      if (!vivo) return
      // Se mide a 100 px y se escala al ancho de la caja.
      span.style.fontSize = '100px'
      const ancho = span.getBoundingClientRect().width
      span.style.fontSize = ''
      const disponible = caja.clientWidth
      if (ancho > 0 && disponible > 0) setTamano(Math.floor((disponible / ancho) * 100 * 0.995))
    }
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(caja)
    document.fonts?.ready.then(medir)
    return () => {
      vivo = false
      ro.disconnect()
    }
  }, [texto, presentacion])

  if (!texto) return null
  const estimado = `calc(100cqw / ${Math.max(texto.length, 1) * ANCHO_CARACTER_EM})`

  return (
    <div
      ref={cajaRef}
      className="relative mt-10 select-none overflow-hidden"
      style={{ containerType: 'inline-size' }}
      data-pie-marca=""
      aria-hidden="true"
    >
      {figuraUrl && (
        // Figura recortada encima de la marca (alineada abajo a la izquierda, como Marea).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={figuraUrl}
          alt=""
          loading="lazy"
          className="pointer-events-none absolute bottom-0 left-[4%] z-10 h-[118%] w-auto max-w-[30%] object-contain object-bottom"
        />
      )}
      <span
        ref={textoRef}
        className="relative block whitespace-nowrap text-current"
        style={{
          fontFamily: 'var(--font-heading), var(--font-body), ui-sans-serif, system-ui, sans-serif',
          fontSize: tamano ? `${tamano}px` : estimado,
          fontWeight: presentacion.peso,
          textTransform: presentacion.mayusculas ? 'uppercase' : 'none',
          lineHeight: 0.8,
          letterSpacing: '-0.02em',
          width: 'max-content',
          paddingTop: '0.06em',
        }}
      >
        {texto}
      </span>
    </div>
  )
}
