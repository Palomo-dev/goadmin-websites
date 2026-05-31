# GO Admin Websites — Portal Web Multi-Tenant

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://goadmin.io)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-Database-green?style=for-the-badge&logo=supabase)](https://supabase.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)](https://typescriptlang.org)

## ¿Qué es?

**goadmin-websites** es el portal web público del ecosistema **GO Admin** (ERP/SaaS). Genera sitios web dinámicos y personalizables para cada organización cliente, accesibles mediante subdominios (`empresa.goadmin.io`) o dominios personalizados (`www.miempresa.com`).

Funciona como una plataforma white-label donde cada organización obtiene automáticamente un sitio web completo con e-commerce, reservas, membresías y más, sin necesidad de desarrollo adicional.

## Tipos de Negocio Soportados

| # | Tipo | Icono | Acción Principal | Funcionalidades Clave |
|---|------|-------|------------------|----------------------|
| 1 | **Restaurante** | 🍽️ | Reservar Mesa | Menú digital, delivery, takeout, carrito |
| 2 | **Hotel** | 🏨 | Reservar Habitación | Reservas por fechas, tipos de habitación, amenidades |
| 3 | **Retail / Tienda** | 🛍️ | Comprar | Catálogo, carrito, checkout, variantes, categorías |
| 4 | **Servicios / SaaS** | 💻 | Agendar Cita | Cotizaciones, citas, catálogo de servicios |
| 5 | **Gimnasio** | 💪 | Inscribirse | Membresías, clases, check-ins, congelamiento |
| 6 | **Transporte** | 🚌 | Comprar Pasaje | Rutas, tickets, reserva de asientos, tarifas |
| 7 | **Parqueadero** | 🅿️ | Reservar Espacio | Tarifas, pases mensuales, zonas, disponibilidad |

## Arquitectura

```
Cliente accede a: empresa.goadmin.io o www.miempresa.com
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│  Vercel + Next.js 14 (App Router)                        │
│                                                          │
│  Middleware (middleware.ts)                               │
│  ├─ Detecta subdominio o dominio personalizado           │
│  ├─ Refresca cookies de sesión Supabase Auth             │
│  └─ Inyecta headers x-subdomain / x-custom-domain       │
│                                                          │
│  [[...slug]]/page.tsx (Catch-all dinámico)                │
│  ├─ 1. Busca página en Page Builder (website_pages)      │
│  ├─ 2. Fallback a slugs conocidos (menu, productos...)   │
│  └─ 3. 404 personalizado                                │
│                                                          │
│  Supabase (PostgreSQL + Auth + Storage + RLS)            │
└──────────────────────────────────────────────────────────┘
```

## Módulos del Portal

### 🛒 E-commerce
- **Catálogo de productos** con categorías, variantes, modificadores y tags
- **Carrito de compras** (CartDrawer) con persistencia client-side
- **Checkout wizard** multi-paso con cálculo de envío e impuestos
- **Tracking de pedidos** en tiempo real
- **Cupones y promociones** con validación server-side

### 📅 Reservas y Espacios
- **Calendario de disponibilidad** (AvailabilityCalendar)
- **Reservas por rango de fechas** (hoteles: check-in/check-out)
- **Reservas por horario** (restaurantes, gimnasios)
- **Pricing dinámico** por tipo de espacio y temporada

### 👤 Portal del Cliente (`/mi-cuenta`)
Sección protegida con autenticación (login/register con Supabase Auth):

| Sección | Descripción |
|---------|-------------|
| `/perfil` | Datos personales del cliente |
| `/pedidos` | Historial y detalle de órdenes |
| `/reservas` | Reservas activas e historial |
| `/facturas` | Facturas electrónicas |
| `/membresia` | Membresía activa y estado |
| `/pases` | Pases de parking |
| `/tickets` | Tickets de transporte |
| `/citas` | Citas de servicios |
| `/clases` | Clases de gimnasio |
| `/checkins` | Historial de check-ins |
| `/favoritos` | Productos favoritos |
| `/cupones` | Cupones disponibles |
| `/direcciones` | Direcciones de envío |
| `/vehiculos` | Vehículos registrados (parking) |
| `/cotizaciones` | Cotizaciones solicitadas |
| `/historial` | Historial general |

### 🎨 Page Builder
Sistema de páginas dinámicas con secciones arrastrables (gestionado desde el ERP GO Admin):

**23 tipos de sección disponibles:**
`hero` · `products` · `gallery` · `testimonials` · `contact` · `faq` · `stats` · `team` · `cta` · `newsletter` · `partners` · `map` · `amenities` · `text-block` · `image-text` · `restaurant` · `hotel` · `retail` · `gym` · `parking` · `transport` · `saas` · `services`

### 💳 Pasarelas de Pago (Webhooks)
| Pasarela | Región |
|----------|--------|
| Stripe | Global |
| PayPal | Global |
| MercadoPago | LATAM |
| PayU | LATAM |
| Wompi | Colombia |

### 📊 Analytics y Marketing
- **Meta Pixel** — Tracking de eventos (ViewContent, AddToCart, Purchase)
- **Google Ads** — Conversiones y remarketing
- **Google Analytics** — Seguimiento de tráfico
- **Vercel Analytics** — Performance y Web Vitals

## Stack Técnico

| Capa | Tecnología |
|------|-----------|
| **Framework** | Next.js 14 (App Router, Server Components) |
| **Lenguaje** | TypeScript 5 |
| **Base de datos** | Supabase (PostgreSQL + RLS) |
| **Autenticación** | Supabase Auth (`@supabase/ssr`) |
| **Storage** | Supabase Storage (logos, imágenes, galería) |
| **Estilos** | Tailwind CSS 3 + Radix UI + shadcn/ui |
| **Hosting** | Vercel (subdominios wildcard `*.goadmin.io`) |
| **Formularios** | React Hook Form + Zod |
| **Charts** | Recharts |
| **Carousel** | Embla Carousel |

## Estructura del Proyecto

```
goadmin-websites/
├── app/
│   ├── [[...slug]]/       # Página catch-all (Page Builder + fallbacks)
│   ├── api/               # 45 endpoints API
│   │   ├── auth/          # Login, register, logout, forgot-password
│   │   ├── checkout/      # Iniciar checkout
│   │   ├── orders/        # Crear/consultar órdenes
│   │   ├── reservations/  # Disponibilidad, pricing, crear reservas
│   │   ├── memberships/   # Comprar/congelar membresías
│   │   ├── transport/     # Tarifas, tickets, asientos
│   │   ├── parking/       # Pases de estacionamiento
│   │   ├── services/      # Citas, cotizaciones
│   │   ├── webhooks/      # Stripe, PayPal, PayU, MercadoPago, Wompi, Meta
│   │   └── ...            # Productos, cupones, favoritos, shipping, etc.
│   ├── auth/              # UI de login/registro
│   ├── carrito/           # Página del carrito
│   ├── checkout/          # Checkout wizard + resultado
│   ├── mi-cuenta/         # Portal del cliente (16 secciones)
│   ├── productos/         # Detalle de producto
│   ├── categorias/        # Productos por categoría
│   ├── espacios/          # Detalle de espacio/habitación
│   ├── reservas/          # Página de reservas
│   ├── membresias/        # Planes de membresía
│   ├── viajes/            # Rutas de transporte
│   ├── pases/             # Pases de parking
│   ├── servicios/         # Detalle de servicio
│   ├── agendar/           # Agendar cita
│   ├── cotizar/           # Solicitar cotización
│   ├── pedido/            # Detalle de pedido
│   ├── tracking/          # Tracking de pedido
│   └── ticket/            # Ticket de transporte
├── components/
│   ├── sections/          # 23 tipos de sección del Page Builder
│   ├── site/              # 27 componentes del sitio
│   │   ├── CheckoutWizard # Checkout multi-paso
│   │   ├── MenuView       # Vista de menú (restaurantes)
│   │   ├── ProductGrid    # Grilla de productos con filtros
│   │   ├── CartDrawer     # Carrito lateral
│   │   ├── SiteHeader     # Header dinámico con navegación
│   │   ├── SiteFooter     # Footer con links y redes sociales
│   │   └── ...            # Calendario, variantes, delivery, etc.
│   └── ui/                # Componentes base (shadcn/ui)
├── lib/
│   ├── supabase/          # Clientes (server, client, admin) y queries
│   │   └── queries.ts     # ~45K líneas — todas las consultas a Supabase
│   ├── templates/         # Presets de templates por tipo de negocio
│   ├── email/             # Templates de email (contacto)
│   ├── services/          # Lógica de servicios
│   ├── reservations/      # Lógica de reservas
│   ├── memberships/       # Lógica de membresías
│   ├── transport/         # Lógica de transporte
│   ├── parking/           # Lógica de parking
│   ├── meta/              # Integración Meta Pixel
│   └── google-ads/        # Integración Google Ads
├── types/
│   ├── database.ts        # Tipos de la base de datos
│   └── organization.ts    # Tipos de negocio y configuración
├── middleware.ts           # Multi-tenancy + auth session refresh
└── docs/                  # Documentación técnica
    ├── PAGE_BUILDER_ARCHITECTURE.md
    ├── INTEGRATION_ANALYSIS.md
    ├── PHASE_D_PLANNING.md
    └── VERCEL_SUBDOMAIN_SETUP.md
```

## Variables de Entorno

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...    # Para webhooks y operaciones admin
```

## Desarrollo Local

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev

# Probar con subdominio simulado
http://localhost:3000?subdomain=empresa

# Probar con subdominio.localhost (alternativa)
http://empresa.localhost:3000
```

## Relación con el Ecosistema GO Admin

```
┌─────────────────────┐     ┌──────────────────────────┐
│   GO Admin (ERP)    │     │  goadmin-websites        │
│   (Panel Admin)     │     │  (Portal Público)        │
│                     │     │                          │
│  • Gestión de       │     │  • Sitio web público     │
│    productos        │────▶│  • E-commerce            │
│  • Órdenes          │     │  • Reservas online       │
│  • Reservas         │     │  • Portal del cliente    │
│  • Clientes         │     │  • Checkout + pagos      │
│  • Page Builder     │     │  • Membresías            │
│  • Configuración    │     │  • Tickets/Transporte    │
│                     │     │                          │
│  Supabase ◀─────────┼─────┼──▶ Supabase (misma BD)  │
└─────────────────────┘     └──────────────────────────┘
```

Ambos proyectos comparten la **misma base de datos Supabase** (Project ID: `jgmgphmzusbluqhuqihj`). El ERP es el panel de administración y `goadmin-websites` es la cara pública para los clientes finales.

## Licencia

Proyecto privado — GO Admin © 2024-2026
