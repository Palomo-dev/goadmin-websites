/**
 * Secciones de la Carta QR en la mesa para el SectionRenderer (servidor).
 *
 * Sin directiva de cliente a propósito, como MenuFull.tsx: el manifiesto del sitio
 * (lib/sectionManifest.ts) lee `CONTENT_KEYS` de cada componente desde un route handler, y en un
 * módulo 'use client' esa lectura no es posible. Aquí se declaran las claves (las del contrato
 * lib/website/v2/contrato/seccionesMesa.ts) y se recorta lo que viaja al navegador: de la
 * organización, id, nombre y subdominio; de los datos de la página, la sede y las sedes.
 */

import type { OrganizationWithDetails } from '@/types/database'
import {
  CLAVES_CUENTA_MESA,
  CLAVES_PEDIDO_MESA,
  CLAVES_PORTADA_MESA,
  CLAVES_SERVICIO_MESA,
  CLAVES_VALORAR_VISITA,
} from '@/lib/website/v2/contrato/seccionesMesa'
import { PortadaMesa } from './PortadaMesa'
import { ServicioMesa } from './ServicioMesa'
import { PedidoMesa } from './PedidoMesa'
import { CuentaMesa } from './CuentaMesa'
import { ValorarVisita } from './ValorarVisita'
import type { PropsSeccionMesa } from './comun'

interface PropsServidor {
  content: Record<string, unknown>
  organization: OrganizationWithDetails
  data?: Record<string, unknown>
  sectionVariant?: string
  sectionId?: string
}

function recortar(p: PropsServidor): PropsSeccionMesa {
  return {
    content: p.content || {},
    organization: { id: p.organization.id, name: p.organization.name, subdomain: p.organization.subdomain ?? null },
    data: {
      branchId: typeof p.data?.branchId === 'number' ? p.data.branchId : null,
      ...(p.data?.sedesRestaurante ? { sedesRestaurante: p.data.sedesRestaurante } : {}),
    },
    sectionVariant: p.sectionVariant,
    sectionId: p.sectionId,
  }
}

export function SeccionPortadaMesa(p: PropsServidor) {
  return <PortadaMesa {...recortar(p)} />
}
SeccionPortadaMesa.CONTENT_KEYS = CLAVES_PORTADA_MESA

export function SeccionServicioMesa(p: PropsServidor) {
  return <ServicioMesa {...recortar(p)} />
}
SeccionServicioMesa.CONTENT_KEYS = CLAVES_SERVICIO_MESA

export function SeccionPedidoMesa(p: PropsServidor) {
  return <PedidoMesa {...recortar(p)} />
}
SeccionPedidoMesa.CONTENT_KEYS = CLAVES_PEDIDO_MESA

export function SeccionCuentaMesa(p: PropsServidor) {
  return <CuentaMesa {...recortar(p)} />
}
SeccionCuentaMesa.CONTENT_KEYS = CLAVES_CUENTA_MESA

export function SeccionValorarVisita(p: PropsServidor) {
  return <ValorarVisita {...recortar(p)} />
}
SeccionValorarVisita.CONTENT_KEYS = CLAVES_VALORAR_VISITA
