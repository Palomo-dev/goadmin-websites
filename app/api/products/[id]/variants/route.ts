import { NextRequest, NextResponse } from 'next/server'
import { getProductModifierGroups, getProductModifierGroupsDe, getProductVariants } from '@/lib/supabase/queries'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { organizacionDePeticion, sedeDeOrganizacion } from '@/lib/api/organizacion-peticion'
import { gruposDeProducto } from '@/lib/products/modificadores'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const productId = Number(id)

  if (!id || !Number.isInteger(productId) || productId <= 0) {
    return NextResponse.json({ variants: [], modifierGroups: [] }, { status: 400 })
  }

  // La organización sale del host; el `organizationId` del query solo se compara (403).
  const org = await organizacionDePeticion(searchParams.get('organizationId'), 'Variants API')
  if (!org.ok) return org.respuesta

  // Con sede, las variantes aplican su carta (precio web, oculto, agotado), igual que la ficha.
  const sede = await sedeDeOrganizacion(
    createAdminClient() || createPublicClient(),
    org.organizationId,
    searchParams.get('branchId'),
  )
  if (sede === 'invalida') {
    return NextResponse.json({ variants: [], modifierGroups: [] }, { status: 400 })
  }

  // Grupos de modificadores del producto (acompañante, adiciones), de la organización del host.
  // Regla del cobro (`gruposDeProducto`, lib/products/modificadores.ts): una variante con grupos
  // propios visibles usa los suyos; si no, los del padre. Por eso se devuelven los dos:
  // `modifierGroups` (los efectivos del producto pedido) y `variantModifierGroups` (id de variante →
  // sus grupos, solo las que tienen). El navegador elige con `mapaGruposDeVariantes` + `gruposDeProducto`.
  // Si el producto pedido es a su vez una variante sin grupos propios (la carta clásica lista las
  // variantes sueltas), `modifierGroups` trae los de su padre: la misma herencia del cobro.
  const [variants, propiosProducto] = await Promise.all([
    getProductVariants(productId, org.organizationId, sede),
    getProductModifierGroups(productId, org.organizationId),
  ])
  let modifierGroups = propiosProducto
  if (propiosProducto.length === 0) {
    const cliente = createAdminClient() || createPublicClient()
    const { data: fila } = await (cliente as any)
      .from('products')
      .select('parent_product_id')
      .eq('id', productId)
      .eq('organization_id', org.organizationId)
      .maybeSingle()
    const padre = fila?.parent_product_id != null ? Number(fila.parent_product_id) : null
    if (padre) {
      const gruposPadre = await getProductModifierGroups(padre, org.organizationId)
      modifierGroups = gruposDeProducto(
        { id: productId, parent_product_id: padre },
        new Map([[productId, propiosProducto], [padre, gruposPadre]]),
      )
    }
  }
  const idsVariantes = ((variants || []) as { id: number }[]).map((v) => Number(v.id))
  const propios = await getProductModifierGroupsDe(idsVariantes, org.organizationId)
  const variantModifierGroups: Record<string, unknown[]> = {}
  propios.forEach((grupos, id) => {
    variantModifierGroups[String(id)] = grupos
  })

  return NextResponse.json({ variants, modifierGroups, variantModifierGroups })
}
