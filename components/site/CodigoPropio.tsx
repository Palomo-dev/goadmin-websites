'use client'

/**
 * Código a medida de Sitio web › Configuración › «Código y píxeles» (ERP, `custom_code`).
 *
 * Solo inyecta lo que el ERP ya define, sin interfaz propia:
 * - Bloques ya validados con las reglas del ERP (lib/website/ajustesSitio.ts → `bloquesCodigo`):
 *   activos, nombre, alcance `todas`|`/ruta`, ≤ 20 000 caracteres, ≤ 20 bloques. El ERP muestra al
 *   guardar el aviso «se ejecuta en cada visita» y sella autor y fecha; aquí no se reescribe ni se
 *   «limpia» el código: se ejecuta tal cual lo aprobó la organización, o no se ejecuta.
 * - Alcance: se compara con la ruta SIN el prefijo de la sede. Un bloque de `/gracias` se
 *   inyecta al llegar a `/gracias` aunque se llegue navegando en el cliente.
 * - Posición: `head` → al final de <head>; `body` → antes de </body>.
 * - Cada bloque se inyecta UNA vez por carga de la página (ids ya inyectados en memoria del
 *   módulo): navegar de ida y vuelta no lo duplica.
 * - El ERP no tiene opción para excluir el checkout: `/checkout` recibe los bloques cuyo alcance
 *   lo cubre (`todas` o `/checkout`), igual que hoy recibe `custom_scripts`.
 *
 * Mismo mecanismo de ejecución que `CustomScripts` (legado): los <script> de un fragmento HTML no
 * se ejecutan con innerHTML, así que se recrean en orden y se espera a los que tienen `src`.
 * Sin bloques (todas las organizaciones hoy) no renderiza ni ejecuta nada.
 */
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { bloquesParaRuta, type BloqueCodigo } from '@/lib/website/ajustesSitio'
import { quitarPrefijo } from '@/lib/outlet/rutaSitio'

const inyectados = new Set<string>()

function inyectar(bloque: BloqueCodigo) {
  const destino = bloque.posicion === 'head' ? document.head : document.body
  const contenedor = document.createElement('div')
  contenedor.innerHTML = bloque.codigo
  const nodos = Array.from(contenedor.childNodes)
  // Código sin etiquetas: JavaScript suelto (igual que CustomScripts).
  if (!nodos.some((n) => n.nodeType === Node.ELEMENT_NODE)) {
    const script = document.createElement('script')
    script.textContent = bloque.codigo
    script.dataset.codigoPropio = bloque.id
    destino.appendChild(script)
    return
  }
  let i = 0
  const siguiente = () => {
    while (i < nodos.length) {
      const nodo = nodos[i++]
      if (nodo.nodeType !== Node.ELEMENT_NODE) continue
      const el = nodo as Element
      if (el.tagName !== 'SCRIPT') {
        const copia = el.cloneNode(true) as Element
        copia.setAttribute('data-codigo-propio', bloque.id)
        destino.appendChild(copia)
        continue
      }
      const script = document.createElement('script')
      Array.from(el.attributes).forEach((a) => script.setAttribute(a.name, a.value))
      script.dataset.codigoPropio = bloque.id
      if (el.textContent) script.textContent = el.textContent
      if (script.hasAttribute('src')) {
        script.onload = siguiente
        script.onerror = () => {
          console.warn('[CodigoPropio] No cargó un script del bloque', bloque.nombre)
          siguiente()
        }
        destino.appendChild(script)
        return
      }
      destino.appendChild(script)
    }
  }
  siguiente()
}

export function CodigoPropio({ bloques, prefijoSede = '' }: { bloques: readonly BloqueCodigo[] | null | undefined; prefijoSede?: string }) {
  const pathname = usePathname() ?? '/'
  useEffect(() => {
    if (!bloques || bloques.length === 0) return
    for (const bloque of bloquesParaRuta(bloques, quitarPrefijo(pathname, prefijoSede))) {
      if (inyectados.has(bloque.id)) continue
      inyectados.add(bloque.id)
      try {
        inyectar(bloque)
      } catch (error) {
        console.warn('[CodigoPropio] Error al inyectar el bloque', bloque.nombre, error)
      }
    }
  }, [bloques, pathname, prefijoSede])
  return null
}
