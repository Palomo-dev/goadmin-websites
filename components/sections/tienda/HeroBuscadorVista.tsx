'use client'

/**
 * Vista de la portada con buscador (`hero · search`). Ver HeroBuscador.tsx.
 *
 * Sin JavaScript el formulario es un GET a `/search?q=…` y funciona igual. Con JavaScript, el
 * destino lo decide `destinoBuscador`: con texto, la búsqueda global; sin texto y con categoría,
 * la página de esa categoría; sin nada, no navega y vuelve el foco al campo.
 */
import { useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { LayoutGrid, Search, Star } from 'lucide-react'
import { conPrefijo } from '@/lib/outlet/rutaSitio'
import { BOTON_PRIMARIO } from '@/lib/website/botonSitio'
import { textoSobreAcentoSiHex } from '@/lib/website/v2/textoSobreAcento'
import { destinoBuscador, type PortadaBuscador } from '@/lib/website/v2/contrato/seccionesTienda'
import type { CategoriaPortada } from '@/lib/website/portadaTienda'
import { partirResumen } from '@/lib/website/portadaTienda'
import { RADIO_PORTADA } from './comunPortada'

interface Props {
  portada: PortadaBuscador
  titulo: string
  categorias: CategoriaPortada[]
  chip: string | null
  prefijo: string
  primaryColor: string
  solapa: CSSProperties
}

export function HeroBuscadorVista({ portada, titulo, categorias, chip, prefijo, primaryColor, solapa }: Props) {
  const router = useRouter()
  const campo = useRef<HTMLInputElement>(null)
  const [consulta, setConsulta] = useState('')
  const [categoria, setCategoria] = useState('')
  const textoBoton = textoSobreAcentoSiHex(primaryColor) ?? '#FFFFFF'

  const buscar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const destino = destinoBuscador(consulta, categoria || null)
    if (!destino) {
      campo.current?.focus()
      return
    }
    router.push(conPrefijo(destino, prefijo))
  }

  const tarjeta: CSSProperties = portada.inset ? { borderRadius: RADIO_PORTADA } : {}
  const partesChip = chip ? partirResumen(chip) : null

  return (
    <div className={portada.inset ? 'p-2 md:p-4' : ''} data-portada-tienda="search">
      <div
        className="relative flex min-h-[540px] items-end overflow-hidden text-white md:min-h-[620px]"
        style={{ ...tarjeta, backgroundColor: portada.imageUrl ? undefined : primaryColor, ...solapa }}
      >
        {portada.imageUrl && (
          <img src={portada.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="eager" />
        )}
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/70" />

        <div className="relative z-10 mx-auto w-full max-w-7xl px-5 pb-8 pt-24 md:px-10 md:pb-12">
          {partesChip && (
            <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/15 py-1 pl-1 pr-3 text-xs backdrop-blur md:text-sm">
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 font-semibold text-gray-900">
                {partesChip.cifra}
                <Star className="h-3 w-3 fill-current" aria-hidden="true" />
              </span>
              <span>{partesChip.resto}</span>
            </p>
          )}
          {titulo && (
            <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">{titulo}</h1>
          )}
          {portada.subtitle && <p className="mt-4 max-w-2xl text-base opacity-90 md:text-lg">{portada.subtitle}</p>}

          <form
            role="search"
            action={conPrefijo('/search', prefijo)}
            method="get"
            onSubmit={buscar}
            className="mt-8 flex flex-col gap-2 bg-white p-2 text-gray-900 shadow-lg md:flex-row md:items-center"
            style={{ borderRadius: portada.inset ? 'calc(var(--radio-sitio, 12px) * 1.25)' : undefined }}
          >
            <label className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2">
              <Search className="h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />
              <span className="sr-only">{portada.searchPlaceholder}</span>
              <input
                ref={campo}
                type="search"
                name="q"
                value={consulta}
                onChange={(e) => setConsulta(e.target.value)}
                placeholder={portada.searchPlaceholder}
                autoComplete="off"
                className="w-full min-w-0 bg-transparent text-base outline-none placeholder:text-gray-500"
              />
            </label>
            {categorias.length > 0 && (
              <label className="flex items-center gap-3 border-t border-gray-200 px-3 py-2 md:border-l md:border-t-0">
                <LayoutGrid className="h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />
                <span className="sr-only">Categoría</span>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="w-full min-w-0 bg-transparent text-sm font-medium outline-none md:w-48"
                >
                  <option value="">Todas las categorías</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.slug}>{c.name}</option>
                  ))}
                </select>
              </label>
            )}
            <button
              type="submit"
              {...BOTON_PRIMARIO}
              className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{ backgroundColor: primaryColor, color: textoBoton }}
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              Buscar
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
