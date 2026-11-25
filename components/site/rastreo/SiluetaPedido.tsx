/**
 * Silueta del pedido mientras se busca o se carga (Figma «16 Sitio web» › Consultar pedido v2,
 * D2 3104:84306 y M2 3105:84427): la forma de la consulta en gris, sin datos, y «Buscando tu
 * pedido…». La usan /consultar-pedido (mientras responde la búsqueda) y `OrderTracker` incrustado
 * (mientras llega el seguimiento), para que el paso de una a otra no salte.
 */
import { Loader2 } from 'lucide-react'

export function SiluetaPedido({ texto = 'Buscando tu pedido…' }: { texto?: string }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5" data-silueta-pedido="">
      <div aria-hidden="true" className="flex animate-pulse flex-col gap-4">
        <span className="h-5 w-28 rounded-full bg-slate-200" />
        <span className="h-7 w-3/4 rounded-lg bg-slate-200" />
        <span className="h-3.5 w-1/2 rounded bg-slate-200" />
        <div className="grid grid-cols-4 gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="h-1 rounded-full bg-slate-200" />
          ))}
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="h-12 w-12 flex-shrink-0 rounded-[10px] bg-slate-200" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="h-3.5 w-2/3 rounded bg-slate-200" />
              <span className="h-3 w-1/3 rounded bg-slate-200" />
            </div>
            <span className="h-3.5 w-14 rounded bg-slate-200" />
          </div>
        ))}
      </div>
      <p role="status" className="flex items-center gap-2 text-sm text-slate-600">
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" style={{ color: 'var(--primary-color)' }} />
        {texto}
      </p>
    </div>
  )
}
