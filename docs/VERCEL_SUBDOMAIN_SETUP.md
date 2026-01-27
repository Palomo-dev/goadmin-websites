# Configuración de Subdominios Dinámicos en Vercel

## Resumen

Para que la plataforma multi-tenant funcione correctamente, necesitas configurar **wildcard domains** en Vercel para que todos los subdominios de `goadmin.io` apunten a este proyecto.

## Dominio Principal: goadmin.io

El dominio ya está registrado en Vercel con Nameservers de Vercel activos.

## Registros DNS a Agregar en Vercel

En la sección **DNS Records** de goadmin.io, agrega:

| Name | Type | Value | TTL |
|------|------|-------|-----|
| `*` | A | `76.76.21.21` | 60 |
| `@` | A | `76.76.21.21` | 60 |

### Cómo agregar el registro wildcard:

1. Ve a: Vercel Dashboard → Domains → goadmin.io → DNS Records
2. En **Name**: escribe `*` (asterisco)
3. En **Type**: selecciona `A`
4. En **Value**: `76.76.21.21`
5. En **TTL**: `60`
6. Click en **Add**

> **Nota**: El registro `@` (raíz) probablemente ya existe. Solo necesitas agregar el `*` (wildcard).

### 4. Verificar Configuración

Una vez configurado, cualquier subdominio funcionará automáticamente:
- `empresa1.goadmin.io` → Sitio de empresa1
- `mitienda.goadmin.io` → Sitio de mitienda
- `hotel-xyz.goadmin.io` → Sitio de hotel-xyz

## Dominios Personalizados (Custom Domains)

Para dominios personalizados de clientes (ej: `www.miempresa.com`):

### Opción A: Desde el Dashboard de Vercel

1. El cliente configura un CNAME en su dominio apuntando a `cname.vercel-dns.com`
2. Agregas el dominio en: Vercel Dashboard → Tu Proyecto → Settings → Domains

### Opción B: Via Vercel API (Automatizado)

Puedes usar la API de Vercel para agregar dominios programáticamente desde GO Admin:

```javascript
// Ejemplo de integración con Vercel API
const response = await fetch(`https://api.vercel.com/v10/projects/${projectId}/domains`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${VERCEL_TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'www.dominiodelcliente.com'
  })
});
```

### Variables de Entorno Necesarias

```env
VERCEL_TOKEN=tu_token_de_vercel
VERCEL_PROJECT_ID=id_del_proyecto
VERCEL_TEAM_ID=id_del_team_si_aplica
```

## Tabla organization_domains

La tabla `organization_domains` almacena la relación entre dominios y organizaciones:

```sql
-- Estructura de organization_domains
- id: uuid
- organization_id: integer (FK a organizations)
- host: text (ej: "miempresa.go-admin.app" o "www.miempresa.com")
- domain_type: enum ("system_subdomain" | "custom_domain")
- status: enum ("pending" | "verified" | "failed")
- is_primary: boolean
- is_active: boolean
- vercel_project_id: text
- vercel_domain_id: text
- vercel_state: jsonb
```

## Flujo de Resolución de Tenant

1. Usuario accede a `miempresa.goadmin.io`
2. Middleware detecta el hostname
3. Busca en `organization_domains` por `host`
4. Obtiene `organization_id`
5. Carga datos de la organización y renderiza su sitio

## Compra de Dominios via Vercel

Vercel permite comprar dominios directamente desde su plataforma:

1. **Desde Dashboard**: Settings → Domains → Buy a Domain
2. **Via API**: Usar la API de Vercel Domains

Para integrar la compra de dominios desde GO Admin (parte administrativa):

```javascript
// Verificar disponibilidad
GET https://api.vercel.com/v4/domains/status?name=dominio.com

// Comprar dominio
POST https://api.vercel.com/v4/domains/buy
{
  "name": "dominio.com",
  "expectedPrice": 1200 // precio en centavos
}
```

> **Importante**: La compra de dominios requiere configuración de facturación en Vercel.

## Pruebas en Local

Para probar subdominios en desarrollo:

```bash
# Opción 1: Query parameter
http://localhost:3000?subdomain=miempresa

# Opción 2: Editar C:\Windows\System32\drivers\etc\hosts
127.0.0.1 miempresa.localhost

# Luego acceder a:
http://miempresa.localhost:3000
```

## Recursos

- [Vercel Wildcard Domains](https://vercel.com/docs/projects/domains/working-with-domains#wildcard-domains)
- [Vercel API - Domains](https://vercel.com/docs/rest-api/endpoints#domains)
- [Multi-tenant Apps en Vercel](https://vercel.com/guides/nextjs-multi-tenant-application)

## Resumen Rápido

**Para habilitar subdominios dinámicos, solo agrega este registro DNS:**

| Name | Type | Value | TTL |
|------|------|-------|-----|
| `*` | A | `76.76.21.21` | 60 |
