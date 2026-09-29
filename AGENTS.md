# goadmin-websites — instrucciones para Codex

Sitios públicos multi-tenant servidos desde un solo despliegue: e-commerce, restaurantes,
hoteles, gym y parking. Next.js 14 App Router + TypeScript estricto + Tailwind + Supabase.
Español de Colombia en código, comentarios, commits y UI.

**Aquí nace el 99 % de los envíos y de los cobros reales del negocio.** Hay 83
organizaciones con sitio activo y varias vendiendo de verdad. Cualquier cambio en el
checkout, en `/api/orders` o en los webhooks de pasarela toca dinero de terceros.

Repo hermano: **`go-admin-erp`**. Comparten el mismo proyecto Supabase. Si un cambio toca
los dos, van **PRs separados** declarando la dependencia, y este repo nunca apunta a algo
que no esté ya desplegado en el ERP.

**El repositorio es público: nunca escribas el nombre de una organización cliente.** Ni en
comentarios, ni en docs, ni en fixtures. Usa el id (`org 120`) o una descripción. La
evidencia —porcentajes, conteos, importes— se conserva; la identidad no.

## Base de datos — siempre por MCP

Proyecto Supabase: **`jgmgphmzusbluqhuqihj`** (Postgres 15), el mismo que el ERP.

Todo cambio de esquema se aplica con las herramientas MCP de Supabase y se versiona en el
repo del ERP según su `docs/POLITICA-MIGRACIONES.md` (`.sql` + rollback en el mismo
commit). Desde este repo no se cambia esquema. **Consulta el esquema real por MCP antes de
escribir un `select`**: este repo ya mandó a producción una función que pedía nueve
columnas inexistentes y devolvía "envío no encontrado" para cualquier guía.

## Git

- `git commit` local **sólo si el usuario lo pide**.
- `git push` y crear PRs requieren **autorización explícita en la conversación actual**.
- El árbol suele tener cambios sin commitear de otras personas. Arma cada commit con
  `git add` de rutas explícitas. **Nunca `git add -A`.** Si tu cambio comparte archivo con
  trabajo ajeno en curso, no lo commitees: pregunta.
- Commits: `feat(GO-<id>): <desc>` · PR: `GO-<id> – <título>`.

## Multi-tenancy: la regla que no se salta

El aislamiento entre organizaciones depende de que **cada query filtre por
`organization_id`**, y ese valor sale **siempre** del contexto (`lib/get-org-context.ts`),
**nunca del body ni del query string**.

Motivo: `createServerSupabaseClient`, `createAuthClient` y `createPublicClient`
(`lib/supabase/server.ts`) resuelven la key como
`SUPABASE_SERVICE_ROLE_KEY || NEXT_PUBLIC_SUPABASE_ANON_KEY`. En producción usan service
role, así que **RLS no se aplica en el servidor de este repo**. No hay red de seguridad
debajo de tu `where`.

- `createAdminClient()` es el único estricto: devuelve `null` si falta la key, en vez de
  degradar a `anon` en silencio. Prefiérelo y falla ruidosamente.
- `getSupabaseForPublicRead()` de `lib/supabase/queries.ts` **es service role**, a pesar del
  nombre. No asumas que RLS te está filtrando algo.
- `lib/supabase/client.ts` es el único cliente de navegador (anon key, sujeto a RLS).
- Las tablas de transporte (`shipments`, `transport_carriers`, `delivery_attempts`,
  `proof_of_delivery`) y las de integraciones (`integration_*`,
  `organization_payment_methods`) **ya no admiten lectura anónima**. Si un cambio necesita
  leerlas desde el navegador, la respuesta es un route handler, no una política.

## Tipos: el compilador sólo protege lo que esté declarado

`types/database.ts` está **escrito a mano** y cubre sólo tablas del sitio. No incluye
todas las tablas que el código consulta, y hay ~70 `as any` en `lib/supabase/queries.ts`:
cada uno es un punto ciego donde un nombre de columna inexistente compila sin queja.

Si tocas una función que consulta una tabla no declarada: declara la tabla con sus columnas
reales (consúltalas por MCP) y quita el `as any` **de esa función**. No los quites todos de
golpe.

## Compuertas antes de cerrar trabajo

```
npm run typecheck        # tsc --noEmit
npx next build
npm run verify:tracking  # contrato de /tracking con el esquema real
```

**`npm run lint` no lintea nada.** `next lint` no está configurado: abre el prompt
interactivo de ESLint y sale con código 0. No reportes "lint pasa" desde aquí. Configurar
ESLint es una decisión de repo, no parte de una épica.

**No hay framework de tests** — ni jest, ni vitest, ni playwright, ni un solo archivo de
prueba. No reportes "npm test pasa": en un repo sin tests eso siempre pasa y no verifica
nada. `scripts/verify-tracking.mjs` es el modelo para verificar contratos con el esquema
sin añadir dependencias: lee los `select` del propio fuente y los ejecuta contra la base
real, así que un nombre de columna inexistente lo hace fallar.

## Rendimiento: la tienda puede tumbar la base

El 2026-09-14 Postgres se reinició por una ráfaga de `GET /` sobre la home de una tienda
con `force-dynamic` y ~500 productos sin caché. Antes de añadir una consulta a una página
pública, pregúntate cuántas veces por render y por visitante se ejecuta. `react.cache` y
los helpers `getDefaultTax` cacheados existen para eso.

## Archivos que hay que tratar con cuidado

| Archivo | Por qué |
|---|---|
| `components/site/CheckoutWizard.tsx` (~67 KB) | el checkout de 83 sitios |
| `app/api/orders/route.ts` | creación de pedidos |
| `app/api/checkout/init/route.ts` | inicio del pago |
| `app/api/shipping/calculate/route.ts` | alimenta el checkout de todos los sitios |
| `app/api/webhooks/*` | confirmación de pagos |

Para estos: refactor de extracción primero, funcionalidad después; commit aislado; y
cualquier `if` nuevo lleva su `else` con el comportamiento actual sin tocar.

## Webhooks de pasarela

- **Verifica la firma y falla cerrado.** Si no encuentras el secreto, responde 401. Nunca
  "procesar igual porque no hay secreto": eso convierte el endpoint en un botón de
  "marcar como pagado". El de Wompi (`app/api/webhooks/wompi_co/route.ts`) tiene un
  interruptor `WOMPI_WEBHOOK_ENFORCE_SIGNATURE`: en `false` observa y registra el veredicto
  en `integration_events`; en `true` bloquea. Se pasa a `true` cuando los veredictos
  registrados confirmen `match` con tráfico real.
- El secreto de eventos vive en `integration_credentials` con **`purpose='events_secret'`**.
  `credential_type` para esas filas vale `'secret'`. Filtrar por la columna equivocada
  devuelve 0 filas — y así estuvo meses.
- `secret_ref` debe contener el **uuid de `vault.secrets`**, no el secreto. Se lee con el
  RPC `fn_get_provider_secret(connection_id, purpose)`, que devuelve `NULL` si aún no está
  en el vault. Las credenciales anteriores a Vault tienen el valor en claro en `secret_ref`;
  el código lo distingue por la forma de uuid.
- La `organization_id` se resuelve desde la conexión o el pedido, **nunca desde el payload**.
- `integration_events.connection_id` es **NOT NULL**, `status` sólo admite `received`,
  `processed` o `error`, y `event_time` es `GENERATED ALWAYS`. Un insert que viole
  cualquiera de las tres falla en silencio si no compruebas `error`: pasó dos veces.
- `idx_integration_events_dedupe` es UNIQUE `(connection_id, external_event_id)`. Un
  registro auxiliar de la misma transacción va con `external_event_id` en null.

## `/tracking` y envíos

- `getShipmentByTracking(trackingNumber, organizationId)` exige la organización: sin ella,
  el sitio de cualquier organización rastreaba guías de cualquier otra.
- `tracking_number` no es único entre organizaciones: `.maybeSingle()` sobre el más
  reciente, nunca `.single()`.
- El origen del envío no vive en `shipments`; no lo pintes.

## `lib/rateLimit.ts`

Existe y **no se usa en ninguna ruta**. Si tocas `/api/orders` o `/api/checkout/init`,
aplícalo por IP y por email.

## Cuándo parar y preguntar

- Un cambio afectaría al checkout de organizaciones que no son la del alcance.
- Tu cambio comparte archivo con trabajo ajeno sin commitear.
- Necesitas leer desde el navegador una tabla que ya no admite anon.
- Un hallazgo nuevo invalida el plan que estabas siguiendo.
