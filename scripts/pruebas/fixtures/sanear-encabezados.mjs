/**
 * sanear-encabezados.mjs — arma `encabezados.json` (fixture de la matriz del buscador) a partir de
 * la extracción de SOLO LECTURA hecha por MCP de Supabase (proyecto taqjemqjtumhwptchcxk).
 *
 *   node scripts/pruebas/fixtures/sanear-encabezados.mjs <extraccion.json>
 *
 * <extraccion.json>: arreglo con una entrada por tienda, tal como lo devuelve la consulta de abajo
 * (cada fila trae `t` = el JSON de la tienda como texto, o directamente el objeto).
 *
 * Qué se extrae (los 14 sitios con revisión V2 publicada, `website_site_states.published_revision_id`):
 * - `documento`: lo que `ajustesPublicosDesdeDocumento` y `menusPublicosDesdeDocumento`
 *   (lib/website/v2/vistaPublica.ts) necesitan para el encabezado: `shell.header` completo, el pie
 *   reducido a `footer_show_categories`, `tema` sin tarjeta/paginación/carrusel/sección,
 *   `identidad.alturaLogo` (sin nombre ni logos), el menú principal del encabezado y las páginas
 *   que ese menú enlaza (id, slug, título, publicada, tipo).
 * - `legacy`: columnas de `website_settings` (fila principal) que el documento no pisa y que el
 *   encabezado lee (posición del menú, moneda, colores y fuentes de respaldo, giros activos).
 * - `categoriasDelMenu`: categorías que referencian los ítems de tipo categoría (id, name, slug).
 * - `menuCategories`: categorías activas (id, name, slug, parent_id), solo si la tienda las carga
 *   (`show_categories_in_header` o `footer_show_categories`), igual que getOrgContext.
 *
 * Consulta usada (read-only):
 *
 *   with base as (
 *     select s.organization_id oid, r.document d, o.type_id
 *     from website_site_states s
 *     join website_site_revisions r on r.id = s.published_revision_id
 *     join organizations o on o.id = s.organization_id
 *     where s.branch_id is null),
 *   m as (select oid, (select x from jsonb_array_elements(d->'menus') x
 *                      where x->>'id' = d->'shell'->'header'->>'menuPrincipalId') menu from base)
 *   select jsonb_build_object('id', oid, 'type_id', type_id, 'legacy', …, 'documento', …,
 *                             'categoriasDelMenu', …, 'menuCategories', …)
 *
 * El nombre de la organización, su subdominio y el nombre de `identidad` se reemplazan por
 * «Tienda <id>» ya en la consulta; aquí se vuelve a sanear: URLs absolutas → «/», correos,
 * teléfonos (también los de WhatsApp de la barra móvil) → valores de ejemplo. El repo es público.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const entrada = process.argv[2]
if (!entrada) {
  console.error('uso: node scripts/pruebas/fixtures/sanear-encabezados.mjs <extraccion.json>')
  process.exit(2)
}

const crudo = JSON.parse(readFileSync(entrada, 'utf8'))
const filas = (Array.isArray(crudo) ? crudo : [crudo]).map((f) => (typeof f?.t === 'string' ? JSON.parse(f.t) : f))

const TELEFONO = /\+?\d[\d\s().-]{6,}\d/g
const URL_ABSOLUTA = /https?:\/\/[^\s"']+/g
const CORREO = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/g

function sanearTexto(clave, valor) {
  // Ids, colores y uuids no se tocan.
  if (/^#[0-9a-f]{3,8}$/i.test(valor) || /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(valor)) return valor
  if (clave === 'entidadId' || clave === 'id' || clave === 'paginaId') return valor
  return valor
    .replace(URL_ABSOLUTA, '/')
    .replace(CORREO, 'tienda@example.com')
    .replace(TELEFONO, '+57 300 0000000')
}

function sanear(valor, clave = '') {
  if (typeof valor === 'string') return sanearTexto(clave, valor)
  if (Array.isArray(valor)) return valor.map((v) => sanear(v, clave))
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, sanear(v, k)]))
  }
  return valor
}

const tiendas = filas
  .map((f) => {
    const t = sanear(f)
    return {
      id: t.id,
      nombre: `Tienda ${t.id}`,
      subdomain: `tienda-${t.id}`,
      type_id: t.type_id ?? null,
      legacy: t.legacy ?? {},
      documento: t.documento,
      categoriasDelMenu: t.categoriasDelMenu ?? [],
      menuCategories: t.menuCategories ?? [],
    }
  })
  .sort((a, b) => a.id - b.id)

const salida = {
  _nota:
    'Encabezados reales de las tiendas con sitio V2 publicado (solo lectura por MCP; ver sanear-encabezados.mjs). '
    + 'Ajustes efectivos = ajustesPublicosDesdeDocumento(documento, legacy, null); menú = menusPublicosDesdeDocumento. '
    + 'Sin nombres, logos, dominios ni teléfonos reales.',
  extraido: new Date().toISOString().slice(0, 10),
  tiendas,
}

const destino = fileURLToPath(new URL('./encabezados.json', import.meta.url))
writeFileSync(destino, `${JSON.stringify(salida, null, 2)}\n`)
console.log(`encabezados.json: ${tiendas.length} tiendas (${tiendas.map((t) => t.id).join(', ')})`)
