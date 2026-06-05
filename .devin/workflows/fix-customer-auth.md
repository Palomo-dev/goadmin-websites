---
description: Corregir y completar el flujo de autenticación de clientes (login, registro, logout, olvidar contraseña)
---

# Plan: Autenticación de Clientes

## Diagnóstico

El sistema de autenticación de clientes (`/auth`) tiene 5 problemas:

1. **Login no persiste sesión** — `api/auth/login/route.ts` usa `createPublicClient()` que tiene cookies vacías. `signInWithPassword` se ejecuta pero nunca guarda cookies → `getAuthCustomer()` siempre retorna `null`.
2. **Register no establece sesión** — Mismo problema, usa `createPublicClient()`.
3. **Olvidar contraseña no existe** — El enlace en `AuthForm.tsx:177` es `href="#"`. No hay API ni UI.
4. **Logout sin funcionalidad** — El botón en `mi-cuenta/layout.tsx:89-92` es un `<button>` sin `onClick`.
5. **Sin protección de rutas** — `/mi-cuenta` no redirige a `/auth` si no hay sesión.

## Archivos involucrados

- `app/api/auth/login/route.ts` — API de login
- `app/api/auth/register/route.ts` — API de registro
- `app/auth/AuthForm.tsx` — Formulario login/registro (client component)
- `app/auth/page.tsx` — Página de auth (server component)
- `app/mi-cuenta/layout.tsx` — Layout del portal de cliente
- `lib/supabase/server.ts` — Clientes de Supabase (server/public/admin)
- `lib/get-auth-customer.ts` — Helper para obtener cliente autenticado

---

## Paso 1 — Fix Login: persistir sesión con cookies

**Archivo:** `app/api/auth/login/route.ts`

**Cambio:** Reemplazar `createPublicClient()` por `createServerSupabaseClient()`.

`createServerSupabaseClient()` lee/escribe cookies reales del request, así que `signInWithPassword` persistirá la sesión automáticamente.

**Detalle:**
- Importar `createServerSupabaseClient` en vez de `createPublicClient`
- Cambiar `const supabase = createPublicClient()` → `const supabase = await createServerSupabaseClient()`
- Verificar que las cookies de sesión se setean en el response
- El redirect tras login en `AuthForm.tsx` (`window.location.href = '/'`) debería funcionar porque la sesión ya estará en cookies

**Verificación:** Tras login, navegar a `/mi-cuenta` y verificar que `getAuthCustomer()` retorna datos del cliente.

---

## Paso 2 — Fix Register: establecer sesión tras registro

**Archivo:** `app/api/auth/register/route.ts`

**Cambio:** Reemplazar `createPublicClient()` por `createServerSupabaseClient()`.

**Detalle:**
- Cambiar a `createServerSupabaseClient()` para que `signUp` persista cookies
- Tras el `signUp`, si Supabase requiere verificación de email, informar al usuario
- Si no requiere verificación, la sesión quedará activa automáticamente
- En `AuthForm.tsx`, tras registro exitoso, hacer redirect a `/mi-cuenta` en vez de solo cambiar tab

**Verificación:** Registrar un cliente nuevo → verificar que se crea en `customers` y queda logueado.

---

## Paso 3 — Implementar Logout

**Archivos nuevos:** `app/api/auth/logout/route.ts`
**Archivos modificados:** `app/mi-cuenta/layout.tsx`

**Detalle API:**
- Crear `POST /api/auth/logout`
- Usar `createServerSupabaseClient()` → `supabase.auth.signOut()`
- Retornar JSON con `{ success: true }`

**Detalle UI:**
- En `mi-cuenta/layout.tsx`, convertir el botón "Cerrar Sesión" en un componente client o usar un form con action
- Al hacer click, llamar a `POST /api/auth/logout` y redirigir a `/`

**Verificación:** Click en "Cerrar Sesión" → redirige a home → `/mi-cuenta` ya no muestra datos del cliente.

---

## Paso 4 — Proteger rutas /mi-cuenta

**Archivo:** `app/mi-cuenta/layout.tsx`

**Cambio:** Verificar autenticación server-side y redirigir si no hay sesión.

**Detalle:**
- Importar `redirect` de `next/navigation`
- Importar `createServerSupabaseClient`
- Al inicio de `MiCuentaLayout`, verificar `supabase.auth.getUser()`
- Si no hay user → `redirect('/auth')`

**Verificación:** Acceder a `/mi-cuenta` sin sesión → redirige a `/auth`. Con sesión → muestra dashboard normalmente.

---

## Paso 5 — Crear flujo "Olvidar contraseña"

### 5a — API para solicitar reset

**Archivo nuevo:** `app/api/auth/forgot-password/route.ts`

**Detalle:**
- `POST` recibe `{ email }`
- Usa `createServerSupabaseClient()` → `supabase.auth.resetPasswordForEmail(email, { redirectTo: origin + '/auth/reset-password' })`
- Retorna `{ success: true }` (siempre, para no revelar si el email existe)

### 5b — UI para solicitar reset

**Archivo:** `app/auth/AuthForm.tsx`

**Detalle:**
- Agregar un tercer estado: `activeTab: 'login' | 'register' | 'forgot'`
- Cuando `activeTab === 'forgot'`: mostrar campo email + botón "Enviar enlace de recuperación"
- El enlace "¿Olvidaste tu contraseña?" cambia tab a `'forgot'`
- Tras envío exitoso, mostrar mensaje de confirmación

### 5c — Página para resetear contraseña

**Archivo nuevo:** `app/auth/reset-password/page.tsx`

**Detalle:**
- Formulario con "Nueva contraseña" + "Confirmar contraseña"
- Al abrir, Supabase ya habrá procesado el token del enlace del email
- Usa `supabase.auth.updateUser({ password })` client-side
- Tras éxito, redirigir a `/auth` con mensaje de confirmación

---

## Paso 6 — Dark mode en AuthForm

**Archivo:** `app/auth/AuthForm.tsx`

**Detalle:**
- Agregar clases `dark:` a: Card, tabs (`bg-gray-100` → `dark:bg-gray-800`), inputs, labels, textos de error/éxito, checkboxes
- Seguir el patrón existente del proyecto: `dark:bg-gray-800`, `dark:text-gray-300`, `dark:border-gray-700`

---

## Orden de ejecución

| # | Paso | Prioridad | Archivos |
|---|------|-----------|----------|
| 1 | Fix Login | 🔴 Alta | `api/auth/login/route.ts` |
| 2 | Fix Register | 🔴 Alta | `api/auth/register/route.ts`, `AuthForm.tsx` |
| 3 | Logout | 🔴 Alta | nuevo `api/auth/logout/route.ts`, `mi-cuenta/layout.tsx` |
| 4 | Proteger rutas | 🟡 Media | `mi-cuenta/layout.tsx` |
| 5 | Forgot password | 🟡 Media | nuevo API + UI + página reset |
| 6 | Dark mode auth | 🟢 Baja | `AuthForm.tsx` |

## Notas

- Todas las APIs de auth deben usar `createServerSupabaseClient()` (con cookies reales), nunca `createPublicClient()`.
- El middleware (`middleware.ts`) no necesita cambios — la protección se hace server-side en el layout.
- La tabla `customers` ya tiene campo `user_id` que vincula al auth user de Supabase.
