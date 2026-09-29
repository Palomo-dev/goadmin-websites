# Contexto — `branch_id` en el sitio público y arquitectura multi-sucursal

Traspaso de una sesión de análisis del 2026-09-09. Estado verificado contra producción
el 2026-09-29. Toca **los dos repos**: `goadmin-websites` y `go-admin-erp`.

> Proyecto Supabase: `jgmgphmzusbluqhuqihj` (compartido por ambos repos).

---

## 1. Resumen en tres líneas

- Se investigó una supuesta caída del sitio de la **org 135**: no había caída, era un
  *cold start* de ~7 s. Nada roto en BD ni migraciones.
- De paso se encontró que unos cambios locales sin commitear **duplicaban lógica que la BD
  ya resolvía con triggers**. Se corrigieron y ya están en `main`.
- **Queda un pendiente real**: una migración escrita y versionada que **nunca se aplicó a
  producción**. Ver §6.

---

## 2. El falso positivo inicial

El reporte fue "la página ya no me funciona". La comprobación:

- `GET /` respondía **200 OK** con el HTML correcto (logo, CSS y chunks de Next bien).
- Tardaba **7,3 s**. Cold start de Vercel serverless + SSR consultando Supabase.

No hubo ruptura de esquema. Los cambios del ERP que se sospechaban culpables ni estaban
desplegados. **Si vuelve a pasar, mirar cold start y queries por render antes que el
esquema** — y recordar el incidente del 2026-09-14 (Postgres reiniciado por ráfaga de
`GET /` con `force-dynamic` y ~500 productos sin caché).

---

## 3. La arquitectura real: la BD ya asigna `branch_id`

Esto es lo que hay que saber antes de tocar cualquier `insert` con `branch_id`. Está
documentado en `go-admin-erp/docs/arquitectura-multisucursal.md` (§8, "Fase 9").

### 3.1 Dos capas de triggers

**`fn_branch_set_default()`** — `BEFORE INSERT`, `SECURITY DEFINER`. Solo actúa si
`NEW.branch_id IS NULL`. Prioridad:

1. Sucursal asignada **única** del usuario en la organización (`member_branches` vía `auth.uid()`)
2. Sucursal principal (`branches.is_main = true`)
3. Primera sucursal de la organización

Está en **12 tablas**: `accounts_payable`, `accounts_receivable`, `bank_transactions`,
`bank_transfers`, `cash_counts`, `cash_movements`, `class_reservations`, `credit_notes`,
`payments`, `rates`, `reservations`, `table_sessions`.

**`fn_auto_assign_customer_branch()`** — función **aparte**, solo en `customers`
(trigger `trg_auto_assign_customer_branch`, migración `20260908062907`). Prioridad:
`is_main` → primera `is_active`. **Ignora `member_branches`.**

### 3.2 El detalle que lo cambia todo para el sitio público

Las rutas de este repo escriben con **service role**, donde `auth.uid()` es `NULL`. Por
tanto **el paso 1 nunca aplica** y el trigger siempre cae a `is_main`.

Consecuencia práctica: cualquier helper del sitio que calcule "la sucursal principal de la
org" está **reimplementando el trigger**. No aporta nada y añade una consulta por insert.

### 3.3 Por qué apareció el problema

| Fecha | Qué pasó |
|---|---|
| 2026-09-07 | Commit `21449d1d` en el ERP: filtros `.eq('branch_id', …)` en 28 páginas de 9 módulos, incluido CRM clientes |
| 2026-09-08 | Migración `20260908062907_auto_assign_branch_id_customers`: el trigger de `customers` |
| 2026-09-09 | Cambios en el sitio resolviendo **el mismo problema por tercera vez** |

El filtro del ERP es **estricto** (`.eq`), así que un cliente con la sucursal equivocada
queda **invisible** al filtrar. De ahí el impulso de asignarla desde la app.

### 3.4 La regla de decisión

> **Envía `branch_id` solo cuando la app sepa algo que la BD no puede deducir. Si no,
> omítelo y deja que el trigger lo resuelva.**

La guía §9 del documento de arquitectura pide enviarlo explícitamente; el trigger es la
**red de seguridad**, no el mecanismo. Pero desde el sitio público lo único que la BD no
puede deducir es: **el outlet que eligió el comprador** y **la sucursal del espacio
reservado**.

---

## 4. Lo que quedó aplicado en `goadmin-websites`

Todo en `main`, commit **`9ad5083`**. `npm run typecheck` limpio.

### `app/api/orders/route.ts` — sin cambios, ya estaba bien

```ts
branch_id: Number.isFinite(branchId) ? branchId : null
```

Traduce a: *si el comprador eligió outlet, propágalo; si no, que el trigger decida*.

⚠️ **No cambiar esto a `resolvedBranchId`.** `resolvedBranchId` prioriza
`is_web_stock_source`, que es criterio de **inventario** (de qué bodega sale el stock), no
comercial. El cliente pertenece al outlet donde compró o a la principal, nunca a la bodega
que despachó.

### `app/api/reservations/route.ts` — sucursal derivada del espacio

La sucursal de una reserva es **la del espacio reservado**. El bloque que resolvía
`space_type_id` ahora trae también `branch_id`, y se aplica a la reserva **y** al cliente:

```ts
if (spaceId) { … .select('space_type_id, branch_id') … }
```

Incluye una validación de pertenencia: **`spaces` no tiene `organization_id`**, así que un
`spaceId` de otro tenant habría asignado una sucursal ajena. Se comprueba contra `branches`
antes de usarla (mismo patrón F5 que ya usa `orders`).

Si no hay espacio concreto (reserva por tipo, o multi-room) queda `null` → trigger.
`space_types` **no** tiene `branch_id`, así que no hay de dónde derivarla en ese caso.

### `app/api/parking/passes/route.ts` y `lib/supabase/queries.ts` — revertidos

Se eliminó un helper `getMainBranchId()` que reimplementaba el paso 2 del trigger.
`parking/passes` no recibe ninguna sucursal ni outlet en el payload, así que no tenía nada
que aportar.

De paso: **`getOrCreateCustomer()` en `queries.ts` es código muerto** — cero llamadores en
todo el repo. Si alguien la va a usar, revisar antes.

### `components/site/CustomScripts.tsx`

Tres arreglos:

1. **El delay de 800 ms ahora es condicional.** Existía para que el Meta Event Setup Tool
   alcanzara a instalar sus interceptores de `fbq()`. Se aplicaba a **todos** los
   visitantes, retrasando el PageView del pixel y perdiendo a quien rebota antes de 1 s
   — degradando justo la métrica que buscaba arreglar. Ahora solo corre en iframe
   (`window.top !== window.self`) o con `?fb_setup`.
2. **Bug de StrictMode.** `injectedRef.current = true` se marcaba *antes* del timer, y el
   cleanup lo cancelaba: mount → ref=true + timer, cleanup → clearTimeout, remount → return
   temprano. Con `reactStrictMode` sin definir (default `true` en Next), **los scripts nunca
   se inyectaban en dev** mientras en prod sí. Ahora el ref se marca dentro del callback.
3. **Selector acotado.** `querySelectorAll(':not(script)')` recorre toda la profundidad y
   reinyecta los descendientes por separado, duplicándolos. Ahora `':scope > :not(script)'`.

### Higiene

Borrado un volcado de depuración de 4,8 MB y añadidos `__*.html` y `*.tmp` al `.gitignore`.

---

## 5. Lo que quedó aplicado en `go-admin-erp`

- **`supabase/migrations/20260909210000_unify_customers_branch_default_with_fase9.sql`**
  — escrita y commiteada, **sin aplicar** (ver §6).
- **`supabase/rollbacks/20260909210000_…_rollback.sql`** — restaura la función y el trigger
  originales, con la definición exacta que había en producción.
- **`docs/arquitectura-multisucursal.md`** — actualizado: 13 tablas en la lista de Fase 9,
  más una nota sobre por qué el sitio público siempre cae a `is_main`.
- **`supabase/migrations/00000000000000_baseline_schema.sql`** — pasó de **0 bytes a
  2,65 MB** vía `supabase db dump`. Antes el repo no podía reconstruir el esquema.

---

## 6. ⚠️ PENDIENTE: aplicar la migración

**Verificado el 2026-09-29: sigue sin aplicarse.** En producción todavía está
`trg_auto_assign_customer_branch`, y `trg_branch_default` **no** está en `customers`.

### Qué hace

Unifica `customers` con la Fase 9: elimina `fn_auto_assign_customer_branch()` y pone
`trg_branch_default` con `fn_branch_set_default()`.

### Por qué importa

Hoy un usuario del ERP asignado **solo a la sucursal B** crea un cliente → cae en la
principal; pero su reserva → cae en B. Mismo usuario, misma sesión, dos sucursales
distintas. Con los filtros estrictos de `21449d1d`, el cliente queda invisible.

### Análisis de seguridad (hecho, no asumido)

- **No toca ninguna fila.** Sin `UPDATE`/`DELETE`/`INSERT`. Solo cambia el comportamiento
  en futuros `INSERT`.
- **La función que se borra no la usa nadie más.** Verificado en `pg_trigger`: un único
  dependiente, el trigger de `customers`.
- **`customers.branch_id` es nullable.** Peor caso: valores NULL, nunca inserts rechazados.
- **Sin contención.** `pg_stat_activity` sin transacciones largas ni bloqueos; el
  `ACCESS EXCLUSIVE` se toma al instante y el DDL es solo metadatos.
- **Reversible** con el rollback ya escrito.

### El matiz — es un cambio de comportamiento intencionado

Empezarán a aparecer clientes nuevos en sucursales distintas a la principal. Es la
corrección buscada, pero si alguien asume "todos los clientes viven en la principal", lo va
a notar.

### Borde no verificado

Las consultas agregadas sobre `branches` daban timeout por el pooler, así que **no se
confirmó si alguna organización carece de `is_main`**. Ahí las dos funciones difieren: la
vieja caía a la primera sucursal *activa*, la nueva cae a la primera sin filtrar por
`is_active`. De las 25 orgs que sí se revisaron, todas tenían exactamente una `is_main`.

### Cómo aplicarla

Por MCP de Supabase (`apply_migration`), o pegando el `.sql` en el SQL editor. En la sesión
original el clasificador de permisos bloqueó el DDL desde el agente.

Verificación posterior:

```sql
select t.tgname, p.proname
from pg_trigger t join pg_proc p on p.oid = t.tgfoid
where t.tgrelid = 'public.customers'::regclass and not t.tgisinternal;
```

Debe aparecer `trg_branch_default` / `fn_branch_set_default` y **no**
`trg_auto_assign_customer_branch`.

---

## 7. Pendiente menor: registrar el baseline

El baseline de 2,65 MB **no está en el historial remoto** (verificado: la versión
`00000000000000` no existe en `supabase_migrations.schema_migrations`).

```bash
cd C:/Users/USUARIO/CascadeProjects/go-admin-erp && npx supabase migration repair --status applied 00000000000000
```

No ejecuta nada: solo anota que ya está aplicado. No se corrió porque escribe en el
historial remoto.

---

## 8. Trampas descubiertas — leer antes de tocar migraciones

- **🚫 No usar `supabase db push` en `go-admin-erp`.** Hay **1.585 migraciones remotas** y
  solo un puñado de archivos locales. `db push` intentaría aplicar el baseline completo.

- **🚫 `supabase db pull` falla** con `LegacyDbPullMigrationConflictError` y propone marcar
  las 1.585 migraciones como *reverted*. Eso mutaría el historial de producción. Usar
  `db dump` para el esquema, que solo lee.

- **⚠️ Colisión de timestamps.** Hay varias sesiones creando migraciones en paralelo. Una
  migración escrita como `20260909140000` colisionó con
  `20260909140000_buscador_catalogo_normalizacion.sql` de otra sesión. **Comprobar siempre
  el `max(version)` remoto y el listado local antes de nombrar un archivo.**

- **⚠️ El MCP de Supabase da timeouts intermitentes** en consultas con agregados, mientras
  `select 1` funciona. Es el pooler, no contención. Reintentar con la consulta más simple.

- **El historial de migraciones vive en la BD, no en el repo.** Buscar una función en los
  archivos del repo y no encontrarla **no** significa que no esté versionada: consultar
  `supabase_migrations.schema_migrations`.

---

## 9. Compuertas de este repo

```
npm run typecheck        # tsc --noEmit
npx next build
npm run verify:tracking
```

`npm run lint` **no lintea nada** (`next lint` sin configurar: abre prompt interactivo y
sale con 0). **No hay framework de tests** — ni jest, ni vitest, ni playwright. No reportar
"tests pasan" ni "lint pasa" desde aquí.
