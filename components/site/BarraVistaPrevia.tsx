'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ChevronDown, Eye, Link2, Lock, Send, X } from 'lucide-react'

/**
 * Barra de la pestaña de vista previa del borrador (Figma «BarraVistaPrevia» 1886:919747,
 * modo «borrador»): «Vista previa del borrador · no es lo que ven tus clientes», sede,
 * computador / tableta / celular, enlace privado que caduca, copiar, volver al editor y
 * publicar. Debajo, el sitio armado con el borrador en un iframe (`?marco=1`) del ancho del
 * dispositivo elegido, para que las reglas responsive se vean como en ese dispositivo.
 *
 * «Publicar» no publica desde aquí: vuelve al editor con `?accion=publicar`, que abre el
 * diálogo de publicar del ERP (permisos y confirmación de siempre).
 */
export interface SitioSelector {
  id: string
  nombre: string
}

type Dispositivo = 'computador' | 'tableta' | 'celular'

const ANCHO: Record<Dispositivo, string> = {
  computador: '100%',
  tableta: '768px',
  celular: '390px',
}

function horasRestantes(caducaEnSeg: number): number {
  return Math.max(0, Math.round((caducaEnSeg * 1000 - Date.now()) / 3_600_000))
}

export function BarraVistaPrevia({
  rutaMarco,
  sitioActual,
  sitios,
  caducaEn,
  urlEditor,
}: {
  rutaMarco: string
  sitioActual: string
  sitios: SitioSelector[]
  caducaEn: number
  urlEditor: string | null
}) {
  const [dispositivo, setDispositivo] = useState<Dispositivo>('computador')
  const [copiado, setCopiado] = useState(false)
  const [horas, setHoras] = useState<number | null>(null)
  useEffect(() => setHoras(horasRestantes(caducaEn)), [caducaEn])

  const srcMarco = useMemo(() => {
    const q = new URLSearchParams({ marco: '1', sitio: sitioActual })
    return `${rutaMarco}?${q.toString()}`
  }, [rutaMarco, sitioActual])

  const urlPublicar = useMemo(() => {
    if (!urlEditor) return null
    const u = new URL(urlEditor)
    u.searchParams.set('accion', 'publicar')
    return u.toString()
  }, [urlEditor])

  const cambiarSitio = (id: string) => {
    const u = new URL(window.location.href)
    u.searchParams.set('sitio', id)
    window.location.assign(u.toString())
  }

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      setCopiado(false)
    }
  }

  const textoCaduca = horas === null ? 'Enlace privado' : `Enlace privado · caduca en ${horas} h`

  const selectorSede = (clase: string) => (
    <label className={`relative ${clase}`}>
      <span className="sr-only">Sede</span>
      <select
        value={sitioActual}
        onChange={(e) => cambiarSitio(e.target.value)}
        className="h-8 w-full appearance-none rounded-lg border border-slate-300 bg-white pl-3 pr-8 text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#4361ee]"
      >
        {sitios.map((s) => (
          <option key={s.id} value={s.id}>
            Sede: {s.nombre}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
    </label>
  )

  const botonPublicar = urlPublicar ? (
    <a
      href={urlPublicar}
      className="inline-flex h-8 shrink-0 items-center gap-2 rounded-lg bg-[#3651d4] px-3 text-xs font-medium text-white hover:bg-[#2a3ea8]"
    >
      <Send aria-hidden className="h-4 w-4" />
      Publicar
    </a>
  ) : null

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      {/* Escritorio */}
      <div
        role="region"
        aria-label="Vista previa del borrador"
        className="hidden h-11 shrink-0 items-center gap-1.5 border-b border-sky-300 bg-sky-50 px-3 md:flex"
      >
        <Eye aria-hidden className="h-4 w-4 shrink-0 text-sky-700" />
        <p className="shrink-0 text-sm font-medium text-sky-700">Vista previa del borrador</p>
        <p className="min-w-0 truncate text-[13px] text-sky-700">· no es lo que ven tus clientes</p>
        <span className="flex-1" />
        {selectorSede('w-[164px] shrink-0')}
        <div role="radiogroup" aria-label="Dispositivo" className="flex shrink-0 items-center gap-1 rounded-lg bg-slate-100 p-1">
          {(['computador', 'tableta', 'celular'] as Dispositivo[]).map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={dispositivo === d}
              onClick={() => setDispositivo(d)}
              className={`rounded-md px-3 py-1 text-sm font-medium capitalize ${
                dispositivo === d ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-600">
          <Lock aria-hidden className="h-3.5 w-3.5" />
          {textoCaduca}
        </span>
        <button
          type="button"
          onClick={copiar}
          className="inline-flex h-8 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-medium text-slate-900 hover:bg-sky-100"
        >
          <Link2 aria-hidden className="h-4 w-4" />
          <span aria-live="polite">{copiado ? 'Copiado' : 'Copiar'}</span>
        </button>
        {urlEditor ? (
          <a
            href={urlEditor}
            className="inline-flex h-8 shrink-0 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 hover:bg-slate-50"
          >
            <ArrowLeft aria-hidden className="h-4 w-4" />
            Volver al editor
          </a>
        ) : null}
        {botonPublicar}
      </div>

      {/* Celular */}
      <div
        role="region"
        aria-label="Vista previa del borrador"
        className="flex shrink-0 flex-col gap-2 border-b border-sky-300 bg-sky-50 px-4 py-2.5 md:hidden"
      >
        <div className="flex items-center gap-2">
          <Eye aria-hidden className="h-4 w-4 shrink-0 text-sky-700" />
          <div className="min-w-0 flex-1 text-sky-700">
            <p className="text-sm font-medium">Vista previa del borrador</p>
            <p className="text-xs">No es lo que ven tus clientes</p>
          </div>
          {urlEditor ? (
            <a href={urlEditor} aria-label="Volver al editor" className="rounded-lg p-2 text-slate-700 hover:bg-sky-100">
              <X aria-hidden className="h-4 w-4" />
            </a>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {selectorSede('min-w-0 flex-1')}
          {botonPublicar}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 justify-center overflow-auto">
        <iframe
          key={srcMarco}
          src={srcMarco}
          title="Sitio con el borrador"
          className="h-full border-0 bg-white transition-[width] duration-300"
          style={{ width: ANCHO[dispositivo], maxWidth: '100%' }}
        />
      </div>
    </div>
  )
}
