# GO Admin Websites — Arquitectura del Page Builder

> Documento de diseño técnico para el sistema de páginas personalizables por organización.
> Fecha: 2026-02-09

---

## Tabla de Contenidos

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Modelo de Datos](#2-modelo-de-datos)
3. [Catálogo de Secciones](#3-catálogo-de-secciones)
4. [Páginas de Sistema y Detalle (No personalizables en layout)](#4-páginas-de-sistema-y-detalle)
5. [Retail — Tienda / E-commerce](#5-retail--tienda--e-commerce)
6. [Restaurant — Restaurante + Domicilios + Menú Digital](#6-restaurant--restaurante--domicilios--menú-digital)
7. [Hotel — Estilo Booking con Check-in/Check-out](#7-hotel--estilo-booking-con-check-incheck-out)
8. [Gym — Gimnasio / Centro Deportivo](#8-gym--gimnasio--centro-deportivo)
9. [Transport — Transporte de Pasajeros / Logística](#9-transport--transporte-de-pasajeros--logística)
10. [Parking — Parqueadero / Estacionamiento](#10-parking--parqueadero--estacionamiento)
11. [SaaS — Software como Servicio](#11-saas--software-como-servicio)
12. [Flujo Frontend](#12-flujo-frontend)
13. [Resumen de Tablas y Volumen](#13-resumen-de-tablas-y-volumen)
14. [Pagos Online — Integración Wompi Colombia](#14-pagos-online--integración-wompi-colombia)
15. [Pagos Online — Integración MercadoPago](#15-pagos-online--integración-mercadopago)
16. [Pagos Online — Integración PayU Colombia](#16-pagos-online--integración-payu-colombia)
17. [Pagos Online — Integración Stripe](#17-pagos-online--integración-stripe)
18. [Pagos Online — Integración PayPal](#18-pagos-online--integración-paypal)
19. [Marketing — Integración Meta (Facebook / Instagram)](#19-marketing--integración-meta-facebook--instagram)
20. [Flujo E-commerce Retail — Análisis y Arquitectura](#20-flujo-e-commerce-retail--análisis-y-arquitectura)

---

## 1. Resumen Ejecutivo

### Problema

Actualmente los sitios web tienen una estructura fija por tipo de negocio: 1 template → secciones hardcodeadas → sin personalización real.

### Solución

Un **Page Builder basado en 3 capas**:

```
website_settings     →  Tema global (colores, fuentes, estilos header/footer)
    └── website_pages        →  Páginas de la organización (slug, título, orden en nav)
            └── website_page_sections  →  Secciones ordenadas (tipo, variante, contenido, config visual)
```

### Reglas Fundamentales

1. **No duplicar datos.** Las secciones que muestran productos, espacios, servicios, etc. consultan las tablas existentes (`products`, `space_types`, `categories`, `organization_services`). Solo guardan configuración de visualización.
2. **4 templates por tipo de negocio** (1 default + 3 alternativas). Un template es un **preset** que genera páginas y secciones por defecto.
3. **Cada organización personaliza** sus páginas, secciones, orden, contenido, colores, variantes, etc.
4. **Páginas de sistema** (`/checkout`, `/auth`, `/reservas`, `/espacios/[id]`) son rutas fijas con lógica compleja. No entran al page builder. Solo heredan el tema visual.

---

## 2. Modelo de Datos

### 2.1 `website_settings` (EXISTENTE — se modifica)

Responsabilidad: **Tema visual global + configuración del sitio.**

#### Columnas que se MANTIENEN

| Columna | Tipo | Propósito |
|---------|------|-----------|
| `id` | uuid | PK |
| `organization_id` | int | FK → organizations |
| `template_id` | text | Preset de tema visual seleccionado |
| `theme_mode` | text | `'light'` \| `'dark'` |
| `primary_color` | text | Color principal |
| `secondary_color` | text | Color secundario |
| `accent_color` | text | Color de acento |
| `background_color` | text | Color de fondo |
| `text_color` | text | Color de texto |
| `font_heading` | text | Fuente de títulos |
| `font_body` | text | Fuente de cuerpo |
| `social_links` | jsonb | Redes sociales |
| `business_hours` | jsonb | Horario de atención |
| `meta_title` | text | SEO default del sitio |
| `meta_description` | text | SEO default del sitio |
| `meta_keywords` | text[] | SEO |
| `og_image_url` | text | Open Graph default |
| `favicon_url` | text | Favicon |
| `canonical_url` | text | URL canónica |
| `google_site_verification` | text | Verificación Google |
| `bing_site_verification` | text | Verificación Bing |
| `custom_css` | text | CSS personalizado |
| `custom_scripts` | text | Scripts personalizados |
| `analytics_id` | text | Google Analytics ID |
| `footer_text` | text | Texto legal del footer |
| `footer_links` | jsonb | Links externos del footer |
| `is_published` | boolean | ¿Sitio publicado? |
| `published_at` | timestamptz | Fecha de publicación |
| `enable_reservations` | boolean | Feature flag |
| `enable_online_ordering` | boolean | Feature flag |
| `enable_appointments` | boolean | Feature flag |
| `enable_memberships` | boolean | Feature flag |
| `enable_tickets` | boolean | Feature flag |
| `enable_parking_booking` | boolean | Feature flag |

#### Columnas que se AGREGAN

| Columna | Tipo | Default | Propósito |
|---------|------|---------|-----------|
| `header_style` | text | `'default'` | Variante visual del header |
| `footer_style` | text | `'default'` | Variante visual del footer |
| `header_cta_text` | text | null | Botón CTA del header |
| `header_cta_url` | text | null | URL del CTA |
| `show_header_cart` | boolean | false | Mostrar icono carrito |
| `show_header_auth` | boolean | true | Mostrar botón login |
| `show_topbar` | boolean | false | Barra superior con teléfono/email |
| `logo_position` | text | `'left'` | Posición del logo: `'left'` \| `'center'` |

#### Columnas que se DEPRECAN (migran a secciones)

- `hero_title`, `hero_subtitle`, `hero_image_url`, `hero_video_url`, `hero_cta_text`, `hero_cta_url`
- `gallery_images`, `testimonials`, `faq_items`
- `show_products`, `show_services`, `show_gallery`, `show_testimonials`, `show_team`, `show_blog`, `show_faq`, `show_contact`, `show_map`, `show_social_links`

> Estas columnas se mantienen temporalmente para compatibilidad con sitios existentes pero no se usan en el nuevo sistema.

---

### 2.2 `website_pages` (NUEVA)

Responsabilidad: **Definir las páginas de cada organización y su posición en la navegación.**

```sql
CREATE TABLE website_pages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id int NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  slug            text NOT NULL,
  title           text NOT NULL,
  meta_title      text,
  meta_description text,
  og_image_url    text,
  is_published    boolean DEFAULT true,
  show_in_header  boolean DEFAULT true,
  show_in_footer  boolean DEFAULT false,
  header_order    int DEFAULT 0,
  footer_order    int DEFAULT 0,
  page_type       text DEFAULT 'builtin' CHECK (page_type IN ('builtin','custom')),
  icon            text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(organization_id, slug)
);

CREATE INDEX idx_website_pages_org ON website_pages(organization_id);
```

| Valor `page_type` | Significado |
|---|---|
| `builtin` | Viene del template por defecto. Se puede personalizar pero no eliminar. |
| `custom` | Creada por el usuario. Se puede personalizar y eliminar libremente. |

> Las páginas de sistema (`/checkout`, `/auth`, `/reservas`) **no van aquí**.

---

### 2.3 `website_page_sections` (NUEVA)

Responsabilidad: **Definir las secciones de cada página, su orden, variante visual y contenido.**

```sql
CREATE TABLE website_page_sections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id         uuid NOT NULL REFERENCES website_pages(id) ON DELETE CASCADE,
  organization_id int NOT NULL REFERENCES organizations(id),
  section_type    text NOT NULL,
  section_variant text NOT NULL DEFAULT 'default',
  content         jsonb DEFAULT '{}',
  settings        jsonb DEFAULT '{}',
  sort_order      int DEFAULT 0,
  is_visible      boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_wps_page ON website_page_sections(page_id, sort_order);
CREATE INDEX idx_wps_org ON website_page_sections(organization_id);
```

#### Estructura de `content` (jsonb)

Depende del `section_type`. Cada tipo de sección tiene su propio schema de contenido documentado en la sección 3.

#### Estructura de `settings` (jsonb) — Compartida por todas las secciones

```jsonc
{
  "bg_color": null,           // null = hereda del tema global
  "text_color": null,         // null = hereda del tema global
  "padding_y": "lg",          // "none" | "sm" | "md" | "lg" | "xl"
  "full_width": false,        // true = sin container, borde a borde
  "bg_image_url": null,       // imagen de fondo opcional
  "bg_overlay_opacity": 0,    // 0 a 1
  "border_top": false,
  "border_bottom": false,
  "custom_class": ""          // clase CSS adicional
}
```

---

## 3. Catálogo de Secciones

### 3.1 Secciones Universales (disponibles para TODOS los tipos de negocio)

#### `hero` — Sección principal / banner

| Variante | Descripción |
|----------|-------------|
| `fullscreen` | Imagen de fondo completa con overlay, título centrado |
| `split` | Mitad texto + mitad imagen |
| `minimal` | Solo texto grande sobre fondo de color sólido |
| `video` | Video de fondo con overlay y texto |
| `slider` | Carrusel de slides, cada uno con imagen + texto |

```jsonc
// content
{
  "title": "Texto principal",
  "subtitle": "Texto secundario",
  "cta_text": "Botón principal",
  "cta_url": "/ruta",
  "cta_secondary_text": null,    // segundo botón opcional
  "cta_secondary_url": null,
  "image_url": "https://...",
  "video_url": null,
  "slides": [],                  // solo para variante slider
  "overlay_opacity": 0.4,
  "text_alignment": "center"     // "left" | "center" | "right"
}
```

#### `products_grid` — Grid de productos

> **DATA-DRIVEN**: Consulta tabla `products` + `product_prices` + `product_images`. No duplica datos.

| Variante | Descripción |
|----------|-------------|
| `grid` | Grid responsive 2-4 columnas |
| `carousel` | Carrusel horizontal |
| `list` | Lista vertical con imagen a la izquierda |
| `featured` | 1 producto grande + grid de secundarios |

```jsonc
// content
{
  "title": "Nuestros Productos",
  "subtitle": "Descripción opcional",
  "max_items": 8,                  // cuántos mostrar (0 = todos)
  "show_category_filter": true,
  "filter_category_ids": [],       // vacío = todas las categorías
  "show_price": true,
  "show_add_to_cart": true,
  "show_description": true,
  "columns": 4                     // 2 | 3 | 4
}
```

#### `categories_grid` — Grid de categorías

> **DATA-DRIVEN**: Consulta tabla `categories`.

| Variante | Descripción |
|----------|-------------|
| `grid` | Cards con imagen y nombre |
| `horizontal` | Scroll horizontal |
| `icons` | Solo icono + nombre en círculos |

```jsonc
// content
{
  "title": "Categorías",
  "subtitle": null,
  "max_items": 0,
  "show_product_count": true
}
```

#### `services_list` — Lista de servicios

> **DATA-DRIVEN**: Consulta tabla `organization_services` + `services`.

| Variante | Descripción |
|----------|-------------|
| `grid` | Cards en grid |
| `cards` | Cards con icono prominente |
| `list` | Lista con descripción |
| `icons_row` | Fila de iconos compacta |

```jsonc
// content
{
  "title": "Nuestros Servicios",
  "subtitle": null,
  "max_items": 0,
  "show_icon": true,
  "show_description": true
}
```

#### `testimonials` — Testimonios de clientes

| Variante | Descripción |
|----------|-------------|
| `carousel` | Carrusel uno a uno |
| `grid` | Grid de tarjetas |
| `quotes` | Citas grandes con comillas |
| `minimal` | Texto simple con nombre |

```jsonc
// content
{
  "title": "Lo que dicen nuestros clientes",
  "items": [
    {
      "name": "Nombre del cliente",
      "role": "Cargo / Ciudad",
      "text": "Texto del testimonio",
      "rating": 5,
      "avatar_url": null
    }
  ]
}
```

#### `faq` — Preguntas frecuentes

| Variante | Descripción |
|----------|-------------|
| `accordion` | Acordeón expandible |
| `two_columns` | Preguntas en 2 columnas |
| `simple` | Lista plana sin acordeón |

```jsonc
// content
{
  "title": "Preguntas Frecuentes",
  "items": [
    { "question": "¿Pregunta?", "answer": "Respuesta" }
  ]
}
```

#### `gallery` — Galería de imágenes

| Variante | Descripción |
|----------|-------------|
| `grid` | Grid uniforme |
| `masonry` | Grid estilo Pinterest |
| `carousel` | Carrusel con lightbox |
| `fullscreen` | Una imagen grande + thumbnails |

```jsonc
// content
{
  "title": "Galería",
  "images": [
    { "url": "https://...", "alt": "Descripción", "caption": null }
  ]
}
```

#### `contact_form` — Formulario de contacto

| Variante | Descripción |
|----------|-------------|
| `simple` | Formulario centrado |
| `with_map` | Formulario + mapa al lado |
| `split` | Info de contacto izquierda + formulario derecha |

```jsonc
// content
{
  "title": "Contáctanos",
  "subtitle": "Estamos para ayudarte",
  "show_phone": true,
  "show_email": true,
  "show_address": true,
  "show_map": true,
  "form_fields": ["name", "email", "phone", "message"]
}
```

#### `cta` — Call to Action

| Variante | Descripción |
|----------|-------------|
| `banner` | Banner horizontal con fondo de color |
| `centered` | Texto centrado con botón grande |
| `split` | Texto a un lado + botón al otro |
| `with_image` | CTA con imagen de fondo |

```jsonc
// content
{
  "title": "¿Listo para empezar?",
  "subtitle": "Texto complementario",
  "cta_text": "Texto del botón",
  "cta_url": "/ruta",
  "image_url": null
}
```

#### `text_block` — Bloque de texto libre

| Variante | Descripción |
|----------|-------------|
| `centered` | Texto centrado con ancho máximo |
| `left` | Texto alineado a la izquierda |
| `two_columns` | Texto dividido en 2 columnas |

```jsonc
// content
{
  "title": "Título opcional",
  "body": "Texto en HTML o markdown",
  "show_divider": false
}
```

#### `image_text` — Imagen + Texto

| Variante | Descripción |
|----------|-------------|
| `image_left` | Imagen izquierda, texto derecha |
| `image_right` | Texto izquierda, imagen derecha |
| `image_top` | Imagen arriba, texto abajo |

```jsonc
// content
{
  "title": "Título",
  "body": "Texto descriptivo",
  "image_url": "https://...",
  "cta_text": null,
  "cta_url": null
}
```

#### `stats` — Estadísticas / Contadores

| Variante | Descripción |
|----------|-------------|
| `counters` | Números grandes animados |
| `cards` | Cards con icono + número |
| `inline` | Fila horizontal simple |

```jsonc
// content
{
  "title": null,
  "items": [
    { "value": "500+", "label": "Clientes felices", "icon": "users" },
    { "value": "10", "label": "Años de experiencia", "icon": "calendar" }
  ]
}
```

#### `team` — Equipo

| Variante | Descripción |
|----------|-------------|
| `grid` | Cards con foto + nombre + cargo |
| `carousel` | Carrusel de miembros |
| `simple` | Lista sin fotos |

```jsonc
// content
{
  "title": "Nuestro Equipo",
  "members": [
    { "name": "Nombre", "role": "Cargo", "photo_url": null, "bio": null }
  ]
}
```

#### `partners` — Aliados / Proveedores / Marcas

| Variante | Descripción |
|----------|-------------|
| `logos` | Fila de logos en gris |
| `cards` | Cards con logo + descripción |
| `carousel` | Carrusel de logos |

```jsonc
// content
{
  "title": "Nuestros Aliados",
  "items": [
    { "name": "Empresa", "logo_url": "https://...", "url": null }
  ]
}
```

#### `newsletter` — Suscripción a newsletter

| Variante | Descripción |
|----------|-------------|
| `simple` | Input + botón centrado |
| `with_image` | Input a un lado + imagen al otro |
| `banner` | Banner de color con input |

```jsonc
// content
{
  "title": "Suscríbete a nuestro boletín",
  "subtitle": "Recibe ofertas y novedades",
  "button_text": "Suscribirme",
  "disclaimer": "No enviamos spam"
}
```

#### `map` — Mapa de ubicación

| Variante | Descripción |
|----------|-------------|
| `full_width` | Mapa borde a borde |
| `embedded` | Mapa dentro de container con info |
| `with_directions` | Mapa + indicaciones |

```jsonc
// content
{
  "title": "Encuéntranos",
  "show_address": true,
  "show_hours": true,
  "map_zoom": 15
}
```

---

### 3.2 Secciones Específicas por Tipo de Negocio

#### Para `restaurant`

| Tipo | Variantes | Descripción | Data-driven |
|------|-----------|-------------|-------------|
| `menu_preview` | `tabs`, `accordion`, `grid`, `cards` | Vista previa del menú por categorías | ✅ products + categories |
| `specialties` | `featured`, `carousel`, `grid` | Platos destacados | ✅ products (featured) |
| `reservation_cta` | `simple`, `with_form`, `whatsapp`, `banner` | CTA para reservar mesa | ❌ estático |
| `delivery_cta` | `banner`, `split`, `floating` | CTA para pedir domicilio | ❌ estático |
| `chef_section` | `profile`, `story` | Sección del chef | ❌ estático |

#### Para `hotel`

| Tipo | Variantes | Descripción | Data-driven |
|------|-----------|-------------|-------------|
| `room_types` | `cards`, `detailed`, `minimal`, `comparison` | Tipos de habitación | ✅ space_types |
| `amenities` | `grid`, `icons`, `list`, `grouped` | Amenidades del hotel | ✅ organization_services |
| `booking_cta` | `inline_form`, `banner`, `floating`, `calendar` | CTA de reserva | ❌ estático |
| `why_choose_us` | `icons`, `cards`, `counters` | Razones para elegir | ❌ estático |

#### Para `retail`

| Tipo | Variantes | Descripción | Data-driven |
|------|-----------|-------------|-------------|
| `promo_banners` | `carousel`, `grid`, `single`, `countdown` | Banners promocionales | ❌ estático |
| `featured_products` | `grid`, `carousel`, `hero_product` | Productos destacados | ✅ products |
| `brands` | `logos`, `carousel` | Marcas que vende | ❌ estático |
| `offers` | `grid`, `banner`, `countdown` | Ofertas especiales | ❌ estático |

#### Para `gym`

| Tipo | Variantes | Descripción | Data-driven |
|------|-----------|-------------|-------------|
| `membership_plans` | `pricing_table`, `cards`, `comparison` | Planes de membresía | ✅ `membership_plans` (name, duration_days, price, frequency, access_rules) |
| `class_schedule` | `calendar`, `list`, `grid`, `weekly` | Horario de clases | ✅ `gym_classes` (title, instructor_id, capacity, start_at, end_at, class_type, difficulty_level, room) |
| `trainers` | `grid`, `carousel`, `profiles` | Entrenadores | ❌ estático |
| `gym_features` | `icons`, `cards`, `split` | Características del gym | ❌ estático |
| `transformation` | `before_after`, `carousel` | Transformaciones | ❌ estático |

#### Para `transport`

| Tipo | Variantes | Descripción | Data-driven |
|------|-----------|-------------|-------------|
| `routes` | `list`, `map`, `cards`, `search` | Rutas disponibles | ✅ `transport_routes` (name, code, route_type, base_fare) + `transport_stops` (name, city, latitude, longitude) |
| `fleet_showcase` | `grid`, `carousel`, `specs` | Flota de vehículos | ✅ `vehicles` (plate, vehicle_type, passenger_capacity, brand, model, year) |
| `transport_services` | `cards`, `icons`, `tabs` | Tipos de servicio | ✅ `organization_services` + `services` |
| `trip_search` | `form`, `results`, `calendar` | Buscador de viajes | ✅ `trips` (trip_date, scheduled_departure, available_seats, base_fare) + `transport_fares` |
| `booking_transport` | `form`, `whatsapp`, `banner` | CTA de reserva | ❌ estático |
| `coverage_map` | `interactive`, `static`, `zones` | Mapa de cobertura | ✅ `transport_stops` (latitude, longitude, city) |

#### Para `parking`

| Tipo | Variantes | Descripción | Data-driven |
|------|-----------|-------------|-------------|
| `parking_zones` | `grid`, `map`, `list` | Zonas de estacionamiento | ✅ `parking_zones` (name, description, capacity, is_covered, is_vip, rate_multiplier) |
| `parking_pricing` | `table`, `cards`, `comparison` | Tarifas por tipo de vehículo | ✅ `parking_rates` (vehicle_type, rate_name, unit, price, grace_period_min) |
| `parking_pass_plans` | `cards`, `comparison`, `table` | Planes/abonos de parqueo | ✅ `parking_pass_types` (name, duration_days, price, includes_car_wash, includes_valet) |
| `parking_features` | `icons`, `cards`, `grid` | Características (seguridad, lavado) | ❌ estático |
| `parking_availability` | `realtime`, `summary` | Disponibilidad en tiempo real | ✅ `parking_spaces` (label, zone, type, state) + `parking_sessions` (status) |

#### Para `saas`

| Tipo | Variantes | Descripción | Data-driven |
|------|-----------|-------------|-------------|
| `pricing_table` | `three_columns`, `comparison`, `toggle` | Tabla de precios | ❌ estático |
| `features_grid` | `grid`, `alternating`, `icons`, `tabs` | Features del producto | ❌ estático |
| `integrations` | `logos`, `cards`, `categories` | Integraciones | ❌ estático |
| `how_it_works` | `steps`, `timeline`, `video` | Cómo funciona | ❌ estático |
| `demo_cta` | `form`, `calendar`, `video` | CTA para demo | ❌ estático |

---

## 4. Páginas de Sistema y Detalle (No personalizables en layout)

Estas rutas **NO entran al Page Builder**. Son páginas con lógica de cliente compleja, flujos multi-step o que renderizan datos dinámicos por ID. **Sí heredan el tema visual** (colores, fuentes, header/footer dinámico).

### 4.1 Páginas Compartidas (todos los tipos de negocio)

| Ruta | Propósito | Tabla(s) principal(es) | Notas |
|------|-----------|----------------------|-------|
| `/auth` | Login / Registro con tabs | `customers` (is_registered, user_id), `profiles` | Post-registro crea/actualiza `customers` con `user_id`. Redirige a `/mi-cuenta` o página anterior. |
| `/mi-cuenta` | Dashboard del cliente autenticado | `customers`, `profiles` | Muestra resumen: datos personales, pedidos recientes, reservas activas, etc. según tipo de negocio. |
| `/mi-cuenta/perfil` | Editar perfil y datos personales | `customers` (first_name, last_name, email, phone, doc_type, doc_number) | Permite editar nombre, teléfono, documento, avatar. |
| `/mi-cuenta/pedidos` | Historial de pedidos/compras | `web_orders` (order_number, status, total, delivery_type) + `web_order_items` | Lista de pedidos con estado, total, fecha. Detalle expandible por pedido. |
| `/mi-cuenta/pedidos/[id]` | Detalle de un pedido | `web_orders` + `web_order_items` (product_name, quantity, unit_price, total) | Muestra items, dirección de entrega, estado de pago, tracking. |
| `/mi-cuenta/direcciones` | Gestión de direcciones | `customer_addresses` (label, address_line1, city, latitude, longitude, is_default) | CRUD de direcciones de entrega. Solo para retail/restaurant con delivery. |
| `/mi-cuenta/cupones` | Cupones disponibles | `coupons` (code, discount_type, discount_value, end_date) + `coupon_redemptions` | Lista de cupones activos y usados del cliente. |

### 4.2 Páginas de Detalle (rutas dinámicas con [id])

| Ruta | Propósito | Tabla(s) principal(es) | Aplica a |
|------|-----------|----------------------|----------|
| `/productos/[id]` | Detalle de producto | `products` + `product_prices` + `product_images` + `categories` | retail, restaurant (domicilios) |
| `/categorias/[id]` | Productos filtrados por categoría | `categories` + `products` (filtrado por category_id) | retail, restaurant |
| `/espacios/[id]` | Detalle de espacio + reserva | `space_types` + `spaces` + `space_images` + `space_services` → `organization_services` | hotel |

### 4.3 Páginas de Flujo Transaccional

| Ruta | Propósito | Tabla(s) principal(es) | Aplica a |
|------|-----------|----------------------|----------|
| `/carrito` | Vista completa del carrito | `carts` (cart_data jsonb, expires_at) | retail, restaurant (domicilios) |
| `/checkout` | Flujo: Datos → Dirección → Pago → Confirmación | `web_orders` + `web_order_items` + `customer_addresses` + `coupons` | retail, restaurant |
| `/checkout/confirmacion/[id]` | Confirmación post-compra | `web_orders` (order_number, status, total, estimated_delivery_at) | retail, restaurant |

### 4.4 Páginas Específicas por Tipo de Negocio

#### Restaurant

| Ruta | Propósito | Tabla(s) principal(es) |
|------|-----------|----------------------|
| `/reservas` | Flujo de reserva de mesa | `reservations` (resource_type='table', start_date, occupant_count, status) + `restaurant_tables` (name, zone, capacity, state) |
| `/mi-cuenta/reservas` | Historial de reservas de mesa | `reservations` (filtrado por customer_id) |

#### Hotel

| Ruta | Propósito | Tabla(s) principal(es) |
|------|-----------|----------------------|
| `/reservas` | Flujo completo de reserva de habitación (4 pasos) | `reservations` (checkin, checkout, total_estimated, occupant_count, status) + `reservation_spaces` (space_id, checkin, checkout) |
| `/espacios/[id]` | Detalle de tipo de habitación + formulario reserva | `space_types` (name, base_rate, capacity, amenities) + `space_images` + `space_services` |
| `/mi-cuenta/reservas` | Historial de reservas | `reservations` (filtrado por customer_id, con actual_checkin_at, actual_checkout_at) |

#### Gym

| Ruta | Propósito | Tabla(s) principal(es) |
|------|-----------|----------------------|
| `/checkout` | Compra de membresía | `membership_plans` (name, price, duration_days) → crea `memberships` (customer_id, membership_plan_id, start_date, end_date, status, access_code) |
| `/clases/[id]` | Detalle de clase + reservar cupo | `gym_classes` (title, instructor_id, capacity, start_at, class_type, difficulty_level, room) + `class_reservations` (status, membership_id) |
| `/mi-cuenta/membresia` | Estado de membresía activa | `memberships` (status, start_date, end_date, access_code) + `membership_plans` |
| `/mi-cuenta/clases` | Historial de clases reservadas | `class_reservations` (gym_class_id, status, checkin_time) |
| `/mi-cuenta/checkins` | Historial de accesos al gym | `member_checkins` (checkin_at, method, branch_id) |

#### Transport

| Ruta | Propósito | Tabla(s) principal(es) |
|------|-----------|----------------------|
| `/viajes` | Buscador de viajes (origen, destino, fecha) | `trips` (trip_date, scheduled_departure, available_seats, base_fare, status) + `transport_routes` + `transport_stops` |
| `/viajes/[id]` | Detalle de viaje + selección de asiento | `trips` + `trip_seats` (seat_label, status, reserved_until) + `vehicle_seats` (seat_row, seat_column, seat_type, price_modifier) + `vehicles` (brand, model) |
| `/checkout` | Compra de pasaje | `trip_tickets` (ticket_number, passenger_name, passenger_doc_type, passenger_doc_number, seat_number, fare, total, qr_code, checkin_code, payment_status) |
| `/mi-cuenta/tickets` | Mis pasajes/tickets | `trip_tickets` (filtrado por customer_id, con boarding_stop_id, alighting_stop_id, status, qr_code) |
| `/mi-cuenta/tickets/[id]` | Detalle de ticket + QR | `trip_tickets` + `trips` + `transport_routes` + `transport_stops` |

#### Parking

| Ruta | Propósito | Tabla(s) principal(es) |
|------|-----------|----------------------|
| `/reservas` | Reservar espacio de parqueo | `parking_spaces` (label, zone, type, state, zone_id) + `parking_zones` + `parking_rates` (vehicle_type, unit, price) |
| `/checkout` | Compra de pase/abono | `parking_pass_types` (name, duration_days, price, includes_car_wash, includes_valet) → crea `parking_passes` (customer_id, start_date, end_date, status) |
| `/mi-cuenta/pases` | Mis pases/abonos activos | `parking_passes` (plan_name, start_date, end_date, status, price) + `parking_pass_types` |
| `/mi-cuenta/vehiculos` | Gestión de mis vehículos | `parking_pass_vehicles` + `parking_vehicles` |
| `/mi-cuenta/historial` | Historial de sesiones de parqueo | `parking_sessions` (vehicle_plate, entry_at, exit_at, duration_min, amount, status) |

#### SaaS

| Ruta | Propósito | Tabla(s) principal(es) |
|------|-----------|----------------------|
| `/auth` | Registro / Login + Solicitar demo | `customers` + `leads` (source='website') |
| `/checkout` | Suscripción a plan | Flujo de pago externo (Stripe/pasarela) |
| `/mi-cuenta` | Dashboard del suscriptor | `customers` + datos de suscripción |

### 4.5 Flujo Post-Autenticación

```
Cliente hace clic en "Iniciar Sesión" o "Registrarse"
    │
    ▼
/auth (Login tab / Register tab)
    │
    ├── Login: Supabase Auth → verifica customer en customers (user_id) → sesión
    │
    └── Registro: Supabase Auth signup → crea/actualiza customers (user_id, is_registered=true) → sesión
         │
         ▼
    Redirige a /mi-cuenta (o página anterior si venía de checkout/reserva)
         │
         ▼
    /mi-cuenta muestra dashboard según tipo de negocio:
    ├── Retail:      pedidos, direcciones, cupones, perfil
    ├── Restaurant:  pedidos (domicilios), reservas de mesa, cupones, perfil
    ├── Hotel:       reservas (con check-in/out), perfil
    ├── Gym:         membresía activa, clases, check-ins, perfil
    ├── Transport:   tickets/pasajes, perfil
    ├── Parking:     pases, vehículos, historial sesiones, perfil
    └── SaaS:        suscripción, perfil
```

Todas estas páginas **sí muestran** `SiteHeader` y `SiteFooter` con la navegación dinámica que viene de `website_pages`.

---

## 5. Retail — Tienda / E-commerce

### 5.1 Páginas del Builder (personalizables por secciones)

| # | Slug | Título Default | En Header | En Footer | Tipo |
|---|------|---------------|-----------|-----------|------|
| 1 | `home` | Inicio | ✅ | ❌ | builtin |
| 2 | `productos` | Productos | ✅ | ✅ | builtin |
| 3 | `categorias` | Categorías | ✅ | ✅ | builtin |
| 4 | `ofertas` | Ofertas | ✅ | ❌ | builtin |
| 5 | `nosotros` | Nosotros | ✅ | ✅ | builtin |
| 6 | `contacto` | Contacto | ✅ | ✅ | builtin |

### Páginas de Sistema (lógica fija, no personalizables en layout)

| Ruta | Descripción | Tablas |
|------|-------------|--------|
| `/productos/[id]` | Ficha de producto: imágenes, precio, descripción, variantes, botón agregar al carrito | `products` + `product_prices` + `product_images` |
| `/categorias/[id]` | Listado de productos filtrado por categoría | `categories` + `products` |
| `/carrito` | Vista del carrito con items, cantidades, subtotal, cupón | `carts` (cart_data jsonb) + `coupons` |
| `/checkout` | Flujo: Datos cliente → Dirección entrega → Pago → Confirmación | `web_orders` + `web_order_items` + `customer_addresses` + `coupons` |
| `/checkout/confirmacion/[id]` | Resumen post-compra con número de orden | `web_orders` |
| `/auth` | Login / Registro | `customers` + `profiles` |
| `/mi-cuenta` | Dashboard: pedidos recientes, direcciones guardadas, cupones | `customers` |
| `/mi-cuenta/perfil` | Editar datos personales | `customers` |
| `/mi-cuenta/pedidos` | Historial de pedidos | `web_orders` + `web_order_items` |
| `/mi-cuenta/pedidos/[id]` | Detalle de pedido: items, estado, tracking | `web_orders` + `web_order_items` |
| `/mi-cuenta/direcciones` | CRUD de direcciones de entrega | `customer_addresses` |
| `/mi-cuenta/cupones` | Cupones disponibles y usados | `coupons` + `coupon_redemptions` |

### 5.2 Templates

#### `retail_modern` ⭐ (Default)

| Propiedad | Valor |
|-----------|-------|
| **Estilo** | Limpio, minimalista, bordes redondeados |
| **Colores** | `#3B82F6` (azul), `#1E293B` (gris oscuro) |
| **Fuentes** | Inter / Inter |
| **Header** | `default` — Logo izquierda, nav centro, carrito + auth derecha |
| **Footer** | `three_columns` — 3 columnas (info, links, contacto) |

**Página Home — Secciones por defecto:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `hero` | `slider` |
| 2 | `categories_grid` | `horizontal` |
| 3 | `featured_products` | `grid` |
| 4 | `promo_banners` | `grid` |
| 5 | `products_grid` | `grid` |
| 6 | `testimonials` | `carousel` |
| 7 | `newsletter` | `simple` |
| 8 | `brands` | `logos` |

**Página Productos:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `hero` | `minimal` |
| 2 | `products_grid` | `grid` |

**Página Categorías:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `hero` | `minimal` |
| 2 | `categories_grid` | `grid` |

**Página Ofertas:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `hero` | `minimal` |
| 2 | `promo_banners` | `carousel` |
| 3 | `featured_products` | `carousel` |
| 4 | `cta` | `banner` |

**Página Nosotros:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `hero` | `split` |
| 2 | `text_block` | `two_columns` |
| 3 | `stats` | `counters` |
| 4 | `team` | `grid` |
| 5 | `partners` | `logos` |

**Página Contacto:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `hero` | `minimal` |
| 2 | `contact_form` | `split` |
| 3 | `map` | `full_width` |

---

#### `retail_classic`

| Propiedad | Valor |
|-----------|-------|
| **Estilo** | Tradicional, elegante, serif headings |
| **Colores** | `#8B4513` (marrón), `#2C1810` (oscuro) |
| **Fuentes** | Playfair Display / Lora |
| **Header** | `centered` — Logo centrado arriba, nav abajo |
| **Footer** | `default` — 4 columnas clásicas |

**Diferencias clave en Home:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `hero` | `fullscreen` |
| 2 | `categories_grid` | `grid` |
| 3 | `featured_products` | `featured` |
| 4 | `image_text` | `image_right` |
| 5 | `products_grid` | `list` |
| 6 | `testimonials` | `quotes` |
| 7 | `newsletter` | `with_image` |

---

#### `retail_bold`

| Propiedad | Valor |
|-----------|-------|
| **Estilo** | Vibrante, colorido, bordes duros, sombras marcadas |
| **Colores** | `#FF6B35` (naranja), `#1A1A2E` (azul oscuro) |
| **Fuentes** | Poppins / Nunito |
| **Header** | `default` con topbar de promo |
| **Footer** | `minimal` — 2 filas simples |

**Diferencias clave en Home:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `hero` | `slider` |
| 2 | `promo_banners` | `countdown` |
| 3 | `categories_grid` | `icons` |
| 4 | `featured_products` | `hero_product` |
| 5 | `products_grid` | `carousel` |
| 6 | `cta` | `with_image` |
| 7 | `testimonials` | `grid` |
| 8 | `brands` | `carousel` |
| 9 | `newsletter` | `banner` |

---

#### `retail_elegant`

| Propiedad | Valor |
|-----------|-------|
| **Estilo** | Lujo, premium, blanco y negro con gold |
| **Colores** | `#C9A96E` (gold), `#1A1A1A` (negro) |
| **Fuentes** | Cormorant Garamond / Montserrat |
| **Header** | `transparent` — Sobre el hero, se vuelve sólido al scroll |
| **Footer** | `centered` — Minimalista centrado |

**Diferencias clave en Home:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `hero` | `video` |
| 2 | `text_block` | `centered` |
| 3 | `featured_products` | `featured` |
| 4 | `image_text` | `image_left` |
| 5 | `products_grid` | `grid` |
| 6 | `testimonials` | `minimal` |
| 7 | `newsletter` | `simple` |

---

## 6. Restaurant — Restaurante + Domicilios + Menú Digital

### 6.1 Páginas del Builder (personalizables por secciones)

| # | Slug | Título Default | En Header | En Footer | Tipo |
|---|------|---------------|-----------|-----------|------|
| 1 | `home` | Inicio | ✅ | ❌ | builtin |
| 2 | `menu` | Menú | ✅ | ✅ | builtin |
| 3 | `domicilios` | Pedir Online | ✅ | ✅ | builtin |
| 4 | `reservas-mesa` | Reservar Mesa | ✅ | ✅ | builtin |
| 5 | `nosotros` | Nosotros | ✅ | ✅ | builtin |
| 6 | `contacto` | Contacto | ✅ | ✅ | builtin |
| 7 | `galeria` | Galería | ❌ | ✅ | builtin |

### Páginas de Sistema (lógica fija)

| Ruta | Descripción | Tablas |
|------|-------------|--------|
| `/productos/[id]` | Ficha de plato: imagen, descripción, precio, agregar al carrito (domicilios) | `products` + `product_prices` + `product_images` |
| `/categorias/[id]` | Platos filtrados por categoría (Entradas, Fuertes, Postres, etc.) | `categories` + `products` |
| `/carrito` | Carrito de domicilios: items, cantidades, notas especiales, subtotal | `carts` (cart_data jsonb) |
| `/checkout` | Flujo domicilio: Datos → Dirección → Método pago → Confirmación | `web_orders` (delivery_type, delivery_address, delivery_fee, scheduled_at) + `web_order_items` + `customer_addresses` |
| `/checkout/confirmacion/[id]` | Confirmación: número de orden, tiempo estimado | `web_orders` (estimated_ready_at, estimated_delivery_at) |
| `/reservas` | Flujo reserva mesa: fecha, hora, personas, mesa preferida | `reservations` (resource_type='table', occupant_count) + `restaurant_tables` (name, zone, capacity, state) |
| `/auth` | Login / Registro | `customers` + `profiles` |
| `/mi-cuenta` | Dashboard: pedidos domicilio recientes, reservas próximas | `customers` |
| `/mi-cuenta/pedidos` | Historial de pedidos de domicilio | `web_orders` + `web_order_items` |
| `/mi-cuenta/pedidos/[id]` | Detalle de pedido | `web_orders` + `web_order_items` |
| `/mi-cuenta/reservas` | Historial de reservas de mesa | `reservations` (filtrado por customer_id) |
| `/mi-cuenta/direcciones` | Direcciones de entrega guardadas | `customer_addresses` |

### 6.2 Templates

#### `restaurant_modern` ⭐ (Default)

| Propiedad | Valor |
|-----------|-------|
| **Estilo** | Limpio, fotografía prominente, bistró moderno |
| **Colores** | `#E63946` (rojo), `#1D3557` (azul oscuro) |
| **Fuentes** | DM Sans / DM Sans |
| **Header** | `default` — Logo + nav + botón "Reservar Mesa" |
| **Footer** | `three_columns` |

**Página Home:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `hero` | `fullscreen` |
| 2 | `specialties` | `featured` |
| 3 | `menu_preview` | `tabs` |
| 4 | `delivery_cta` | `banner` |
| 5 | `gallery` | `grid` |
| 6 | `testimonials` | `carousel` |
| 7 | `reservation_cta` | `with_form` |
| 8 | `map` | `embedded` |

**Página Menú:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `hero` | `minimal` |
| 2 | `menu_preview` | `tabs` |
| 3 | `cta` | `centered` |

**Página Domicilios (Pedir Online):**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `hero` | `minimal` |
| 2 | `products_grid` | `grid` |

> Esta página usa el sistema de carrito. `show_add_to_cart: true` + `show_header_cart: true`.

**Página Reservar Mesa:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `hero` | `minimal` |
| 2 | `reservation_cta` | `with_form` |
| 3 | `faq` | `accordion` |

**Página Galería:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `gallery` | `masonry` |

---

#### `restaurant_elegant`

| Propiedad | Valor |
|-----------|-------|
| **Estilo** | Fine dining, oscuro, dorado, fotografía artística |
| **Colores** | `#D4AF37` (dorado), `#0D0D0D` (negro) |
| **Fuentes** | Playfair Display / Lato |
| **Header** | `transparent` |
| **Footer** | `centered` |

**Home diferencias:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `hero` | `video` |
| 2 | `chef_section` | `story` |
| 3 | `specialties` | `carousel` |
| 4 | `menu_preview` | `cards` |
| 5 | `gallery` | `fullscreen` |
| 6 | `testimonials` | `quotes` |
| 7 | `reservation_cta` | `simple` |

---

#### `restaurant_casual`

| Propiedad | Valor |
|-----------|-------|
| **Estilo** | Divertido, colorido, comida callejera / fast casual |
| **Colores** | `#FF6B35` (naranja), `#004E64` (azul petrol) |
| **Fuentes** | Fredoka / Nunito |
| **Header** | `default` con topbar de delivery |
| **Footer** | `minimal` |

**Home diferencias:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `hero` | `split` |
| 2 | `delivery_cta` | `split` |
| 3 | `menu_preview` | `grid` |
| 4 | `promo_banners` | `single` |
| 5 | `testimonials` | `grid` |
| 6 | `faq` | `simple` |
| 7 | `newsletter` | `banner` |

---

#### `restaurant_rustic`

| Propiedad | Valor |
|-----------|-------|
| **Estilo** | Orgánico, rústico, texturas naturales, farm-to-table |
| **Colores** | `#5C4033` (café), `#2D5016` (verde bosque) |
| **Fuentes** | Merriweather / Source Sans Pro |
| **Header** | `centered` |
| **Footer** | `three_columns` |

**Home diferencias:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `hero` | `fullscreen` |
| 2 | `image_text` | `image_right` |
| 3 | `specialties` | `grid` |
| 4 | `menu_preview` | `accordion` |
| 5 | `gallery` | `masonry` |
| 6 | `stats` | `counters` |
| 7 | `testimonials` | `minimal` |
| 8 | `reservation_cta` | `whatsapp` |

---

## 7. Hotel — Estilo Booking con Check-in/Check-out

### 7.1 Páginas del Builder (personalizables por secciones)

| # | Slug | Título Default | En Header | En Footer | Tipo |
|---|------|---------------|-----------|-----------|------|
| 1 | `home` | Inicio | ✅ | ❌ | builtin |
| 2 | `habitaciones` | Habitaciones | ✅ | ✅ | builtin |
| 3 | `servicios` | Servicios | ✅ | ✅ | builtin |
| 4 | `galeria` | Galería | ✅ | ✅ | builtin |
| 5 | `nosotros` | Nosotros | ✅ | ✅ | builtin |
| 6 | `contacto` | Contacto | ✅ | ✅ | builtin |

### Páginas de Sistema (lógica fija)

| Ruta | Descripción | Tablas |
|------|-------------|--------|
| `/espacios/[id]` | Detalle de habitación: fotos, amenidades, precio/noche, capacidad, botón reservar | `space_types` (name, base_rate, capacity, amenities) + `space_images` + `space_services` → `organization_services` |
| `/reservas` | Flujo completo: Tipo habitación → Fechas (check-in/out) → Huéspedes → Datos → Pago | `reservations` (checkin, checkout, total_estimated, occupant_count, status) + `reservation_spaces` (space_id) |
| `/auth` | Login / Registro | `customers` + `profiles` |
| `/mi-cuenta` | Dashboard: reservas activas, próximas, historial | `customers` |
| `/mi-cuenta/perfil` | Editar datos personales | `customers` |
| `/mi-cuenta/reservas` | Historial de reservas con estado (confirmada, check-in, check-out, cancelada) | `reservations` (actual_checkin_at, actual_checkout_at, checkin_notes, checkout_notes) |

### 7.2 Templates

#### `hotel_luxury` ⭐ (Default)

| Propiedad | Valor |
|-----------|-------|
| **Estilo** | Premium, elegante, dorado, fotografía de alta calidad |
| **Colores** | `#8B6914` (dorado), `#1A1A2E` (azul noche) |
| **Fuentes** | Playfair Display / Lato |
| **Header** | `transparent` — Se funde con el hero |
| **Footer** | `three_columns` |

**Página Home:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `hero` | `fullscreen` |
| 2 | `booking_cta` | `inline_form` |
| 3 | `room_types` | `cards` |
| 4 | `why_choose_us` | `icons` |
| 5 | `amenities` | `icons` |
| 6 | `gallery` | `masonry` |
| 7 | `testimonials` | `carousel` |
| 8 | `stats` | `counters` |
| 9 | `map` | `embedded` |

**Página Habitaciones:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `hero` | `minimal` |
| 2 | `room_types` | `detailed` |
| 3 | `booking_cta` | `banner` |

**Página Servicios:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `hero` | `minimal` |
| 2 | `amenities` | `grouped` |
| 3 | `services_list` | `cards` |

**Página Galería:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `gallery` | `masonry` |

---

#### `hotel_boutique`

| Propiedad | Valor |
|-----------|-------|
| **Estilo** | Artístico, personalidad única, colores tierra |
| **Colores** | `#A0522D` (sienna), `#2F4F4F` (slate) |
| **Fuentes** | Cormorant / Karla |
| **Header** | `centered` |
| **Footer** | `centered` |

**Home diferencias:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `hero` | `slider` |
| 2 | `text_block` | `centered` |
| 3 | `room_types` | `minimal` |
| 4 | `image_text` | `image_right` |
| 5 | `gallery` | `fullscreen` |
| 6 | `testimonials` | `quotes` |
| 7 | `booking_cta` | `banner` |

---

#### `hotel_minimal`

| Propiedad | Valor |
|-----------|-------|
| **Estilo** | Escandinavo, limpio, mucho blanco, tipografía delgada |
| **Colores** | `#4A5568` (gris), `#F7FAFC` (blanco gris) |
| **Fuentes** | Outfit / Inter |
| **Header** | `minimal` — Solo logo + hamburger menu |
| **Footer** | `minimal` |

**Home diferencias:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `hero` | `split` |
| 2 | `room_types` | `minimal` |
| 3 | `amenities` | `list` |
| 4 | `gallery` | `grid` |
| 5 | `booking_cta` | `floating` |

---

#### `hotel_resort`

| Propiedad | Valor |
|-----------|-------|
| **Estilo** | Tropical, vibrante, vacacional, fotos grandes |
| **Colores** | `#00897B` (teal), `#FF7043` (coral) |
| **Fuentes** | Montserrat / Open Sans |
| **Header** | `transparent` |
| **Footer** | `three_columns` |

**Home diferencias:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `hero` | `video` |
| 2 | `booking_cta` | `calendar` |
| 3 | `room_types` | `cards` |
| 4 | `amenities` | `grid` |
| 5 | `gallery` | `carousel` |
| 6 | `testimonials` | `grid` |
| 7 | `stats` | `cards` |
| 8 | `newsletter` | `with_image` |

### 7.3 Módulo PMS — Análisis de Base de Datos

#### Tablas Core de Espacios

| Tabla | Columnas clave | Descripción |
|-------|---------------|-------------|
| `space_categories` | `code`, `display_name`, `icon`, `settings` (jsonb), `is_bookable`, `requires_checkin`, `sort_order` | Catálogo global de tipos de categoría (room, table, parking, etc.) |
| `space_types` | `organization_id`, `category_code`, `name`, `short_name`, `base_rate`, `capacity`, `area_sqm`, `amenities` (jsonb), `booking_rules` (jsonb), `is_active` | Tipos de habitación/espacio configurados por la organización |
| `spaces` | `branch_id`, `space_type_id`, `label`, `floor_zone`, `location_details` (jsonb), `status` (enum), `maintenance_notes`, `description` | Instancias individuales de espacios por sucursal (Habitación 101, Suite 202, etc.) |
| `space_images` | `space_id`, `organization_id`, `image_url`, `storage_path`, `is_primary`, `display_order`, `alt_text` | Galería de imágenes por espacio individual |
| `space_services` | `space_id`, `organization_service_id`, `notes` | Servicios asignados a un espacio específico |
| `organization_services` | `organization_id`, `service_id`, `custom_name`, `custom_icon`, `custom_category`, `is_active` | Catálogo de servicios/amenidades de la organización |

**Enums de `space_status`:** `available`, `occupied`, `reserved`, `maintenance`, `cleaning`, `out_of_order`

#### Tablas de Reservaciones

| Tabla | Columnas clave | Descripción |
|-------|---------------|-------------|
| `reservations` | `organization_id`, `branch_id`, `customer_id`, `space_type_id`, `space_id`, `channel`, `checkin` (date), `checkout` (date), `start_date` (timestamptz), `end_date` (timestamptz), `total_estimated`, `occupant_count`, `status` (enum), `actual_checkin_at`, `actual_checkout_at`, `checkin_by`, `checkout_by`, `checkin_notes`, `checkout_notes`, `notes`, `metadata` (jsonb) | Tabla principal de reservaciones |
| `reservation_spaces` | `reservation_id`, `space_id`, `checkin` (date), `checkout` (date) | Relación N:N reservación → espacio (reservas multi-habitación) |
| `reservation_customers` | `reservation_id`, `customer_id`, `is_primary` | Relación N:N reservación → huésped (reservas grupales) |
| `reservation_groups` | `reservation_id`, `group_id` | Agrupación de reservaciones |
| `reservation_blocks` | `organization_id`, `branch_id`, `space_id`, `space_type_id`, `date_from`, `date_to`, `block_type`, `reason`, `created_by` | Bloqueos de disponibilidad (mantenimiento, eventos privados, etc.) |

**Enums de `reservation_status`:** `tentative`, `confirmed`, `checked_in`, `checked_out`, `no_show`, `cancelled`

#### Tablas Financieras

| Tabla | Columnas clave | Descripción |
|-------|---------------|-------------|
| `rates` | `organization_id`, `space_type_id`, `date_from`, `date_to`, `price`, `restrictions` (jsonb: `{min_stay, max_stay}`), `is_active`, `priority` | Tarifas dinámicas por tipo de espacio y rango de fechas (temporadas alta/baja) |
| `folios` | `reservation_id`, `balance`, `status` (enum: `open`, `closed`) | Cuenta financiera de la reservación (acumula cargos) |
| `folio_items` | `folio_id`, `source` (default: `manual`), `description`, `amount`, `tax_code`, `created_by` | Líneas de cargo en el folio (noche, minibar, servicio extra, etc.) |
| `service_charges` | `organization_id`, `branch_id`, `name`, `charge_type`, `charge_value`, `min_amount`, `min_guests`, `applies_to`, `is_taxable`, `is_optional`, `is_active` | Cargos adicionales configurables (servicio de limpieza extra, desayuno, etc.) |
| `payments` | `organization_id`, `branch_id`, `source`, `source_id`, `method`, `amount`, `currency`, `reference`, `processor_response` (jsonb), `status` | Pagos universales (sirve para web_orders Y reservaciones) |
| `sales` | `organization_id`, `branch_id`, `customer_id`, `total`, `balance`, `status`, `payment_status`, `tax_total`, `subtotal`, `discount_total`, `reservation_id` | Venta formal enlazada a reservación (para facturación) |

**Enums de `folio_status`:** `open`, `closed`

#### Tablas Operativas

| Tabla | Columnas clave | Descripción |
|-------|---------------|-------------|
| `housekeeping_tasks` | `space_id`, `task_date`, `status` (enum), `notes`, `assigned_to` | Tareas de limpieza/mantenimiento por habitación |
| `customers` | `organization_id`, `email`, `phone`, `first_name`, `last_name`, `full_name`, `doc_type`, `doc_number`, `roles` (array, default: `{cliente,huesped}`), `preferences` (jsonb), `is_registered`, `user_id` | Perfil completo del cliente/huésped |
| `customer_addresses` | `customer_id`, `organization_id`, `address_line1`, `city`, `department`, `country_code`, `postal_code`, `latitude`, `longitude` | Direcciones del cliente |

**Enums de `housekeeping_status`:** `pending`, `in_progress`, `done`, `cancelled`

### 7.4 Análisis Crítico — Estado Actual del Código

#### 🔴 Problemas Críticos

| # | Problema | Archivo | Detalle |
|---|---------|---------|---------|
| 1 | **Sin validación de disponibilidad** | `app/api/reservations/route.ts` | No verifica si ya existe una reservación activa para las mismas fechas/espacio. Cualquiera puede reservar cualquier fecha sin restricción. |
| 2 | **Sin precios dinámicos** | `SpaceBookingForm.tsx`, `ReservationWizard.tsx` | Solo usa `space_types.base_rate` fijo. La tabla `rates` (tarifas por temporada/fecha) existe pero es completamente ignorada. |
| 3 | **Sin flujo de pago online** | `SpaceBookingForm.tsx` | La reservación queda en `tentative` sin ningún camino hacia la pasarela de pago. Los webhooks (Wompi, Stripe, PayPal, MercadoPago, PayU) solo procesan `web_orders`, no `reservations`. |
| 4 | **Éxito falso en error de BD** | `app/api/reservations/route.ts:113-127` | Si el INSERT falla, retorna `{ success: true }` con un UUID random. Mala práctica — oculta errores. |
| 5 | **GET endpoint roto** | `app/api/reservations/route.ts:163` | Ordena por `reservation_time` que NO existe en la tabla `reservations`. |
| 6 | **Impuesto hardcodeado** | `ReservationWizard.tsx:65` | `subtotal * 0.19` fijo. Debería usar `organization_taxes` (is_default) como ya hace el flujo retail. |

#### 🟡 Gaps Importantes

| # | Gap | Detalle |
|---|-----|---------|
| 1 | **Sin folio** | La tabla `folios` existe pero nunca se crea desde el website. Cada reservación debería generar un folio automáticamente. |
| 2 | **Sin asignación de habitación** | `reservation_spaces` nunca se usa. La reserva solo guarda `space_type_id` pero no asigna un `space` concreto. |
| 3 | **Sin verificación de bloqueos** | `reservation_blocks` existe pero nunca se consulta. Fechas bloqueadas por mantenimiento o eventos no se respetan. |
| 4 | **Sin imágenes en detalle** | `/espacios/[id]` solo muestra un ícono. No consulta `space_images` a pesar de que la tabla existe con `storage_path`, `is_primary`, `display_order`. |
| 5 | **Sin cargos de servicio** | `service_charges` no se aplica. Cargos como desayuno incluido, late check-out, etc. no se suman al total. |
| 6 | **Sin email de confirmación** | A diferencia del flujo retail que ya tiene `send-order-confirmation.ts`, no hay email para reservaciones. |
| 7 | **Sin página de tracking** | Retail tiene `/pedido/[orderNumber]`. Reservaciones no tienen equivalente público. |
| 8 | **Sin service_charges** | La tabla `service_charges` con campos como `charge_type`, `charge_value`, `min_guests` nunca se aplica. |

#### 🟢 Lo que sí funciona

| Componente | Estado |
|-----------|--------|
| `space_types` query básica | ✅ Funciona en `getOrganizationSpaceTypes` |
| `SpaceBookingForm` UI | ✅ Formulario funcional (2 pasos, fechas + datos) |
| `ReservationWizard` UI | ✅ Wizard 4 pasos (espacio, fechas, datos, confirmar) |
| Sub-componentes (`SpaceSelector`, `DateSelector`, `GuestInfo`, `ReservationSummary`, `ReservationConfirmation`) | ✅ Existen en `components/site/reservations/` |
| Crear customer + reservación | ✅ Parcialmente (inserta pero sin validaciones) |
| 6 webhooks de pago | ✅ Completos pero solo para `web_orders` |
| `checkout/init` (5 pasarelas) | ✅ Funciona para generar URLs de pago |

### 7.5 Flujo Recomendado — Reservación Hotel/Hospedaje

#### Journey del Huésped

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. DESCUBRIR                                                     │
│    Home / Página "Habitaciones" → Grid de space_types            │
│    (imágenes, precio desde, capacidad, amenidades)               │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. DETALLE  →  /espacios/[spaceId]                               │
│    Galería de imágenes (space_images)                            │
│    Amenidades y servicios (space_services → organization_services)│
│    Precio dinámico según fechas (rates → base_rate fallback)     │
│    Capacidad, área, booking_rules (heredados de space_type)      │
│    Calendario disponibilidad + formulario reserva por ESTE space │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. DISPONIBILIDAD  →  POST /api/reservations/availability       │
│    Dos modos:                                                    │
│    A) Por spaceId (detalle): verifica si ESE espacio está libre  │
│       - Reservaciones con space_id = spaceId que solapan         │
│       - Bloqueos por space_id O space_type_id que solapan        │
│       - Cumple booking_rules del space_type (min/max stay)       │
│    B) Por spaceTypeId (multi-room/legacy): cuenta disponibles    │
│       - totalSpaces - reservedCount - blockedCount               │
│    Output: { available, spacesAvailable, nights, errors[] }      │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. PRICING  →  POST /api/reservations/pricing                   │
│    Input: spaceId (o spaceTypeId), checkin, checkout             │
│    Si viene spaceId → resuelve spaceTypeId via spaces.space_type │
│    Lógica:                                                       │
│      Para cada noche del rango:                                  │
│        1. Buscar en `rates` (is_active, fecha entre date_from y  │
│           date_to, ordenado por priority DESC)                   │
│        2. Si existe rate → usar rate.price                       │
│        3. Si no → usar space_types.base_rate                    │
│      Sumar noches → subtotal                                     │
│      Aplicar service_charges obligatorios (is_optional=false)    │
│      Aplicar impuesto desde organization_taxes (is_default)      │
│    Output: { nights, priceBreakdown[], subtotal, taxes,          │
│              serviceCharges[], total }                            │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. DATOS DEL HUÉSPED                                            │
│    Formulario: nombre, email, teléfono, doc_type, doc_number,   │
│    notas especiales, número de huéspedes                         │
│    (Buscar/crear customer con roles=['huesped'])                 │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. CREAR RESERVACIÓN  →  POST /api/reservations                 │
│    Validar disponibilidad una vez más (evitar race conditions)   │
│    INSERT reservations:                                          │
│      status: 'tentative', channel: 'website',                   │
│      total_estimated: calculado con rates + taxes + charges      │
│    INSERT folio (status: 'open', balance: total)                 │
│    INSERT folio_items (una por noche + service_charges)          │
│    INSERT reservation_customers (is_primary: true)               │
│    Output: { reservationId, reservationNumber }                  │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. PAGO  →  POST /api/checkout/init (REUTILIZADO)               │
│    Reutilizar el mismo endpoint que retail, pero:                │
│      source: 'reservation' (en vez de 'web_order')              │
│      sourceId: reservationId                                     │
│    La pasarela redirecciona al returnUrl con referencia          │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. WEBHOOK CONFIRMA PAGO                                        │
│    Webhook (Wompi/Stripe/PayPal/etc.) recibe callback:          │
│      1. Buscar reservación por referencia                        │
│      2. Actualizar reservation.status → 'confirmed'              │
│      3. Insertar payment (source: 'reservation')                 │
│      4. Actualizar folio.balance -= amount                       │
│      5. Registrar integration_event                              │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ 9. CONFIRMACIÓN                                                  │
│    Redirect a /reserva/[reservationId]                           │
│    Muestra: datos huésped, fechas, desglose precios,             │
│    estado del pago, QR o código de reserva                       │
│    Enviar email de confirmación con los mismos datos             │
└─────────────────────────────────────────────────────────────────┘
```

#### Diagrama de Estados de la Reservación

```
              Website crea
                  │
                  ▼
            ┌──────────┐    pago falla     ┌───────────┐
            │ tentative │ ───────────────→  │ cancelled │
            └─────┬─────┘                   └───────────┘
                  │ pago exitoso                    ▲
                  ▼                                 │
            ┌───────────┐    no se presenta   ┌──────────┐
            │ confirmed │ ──────────────────→ │ no_show  │
            └─────┬─────┘    (automático)     └──────────┘
                  │ recepción hace check-in
                  ▼
            ┌────────────┐
            │ checked_in │
            └─────┬──────┘
                  │ recepción hace check-out
                  ▼
            ┌─────────────┐
            │ checked_out │  →  folio.status = 'closed'
            └─────────────┘     housekeeping_task = 'pending'
```

### 7.6 Plan de Implementación por Fases

#### Fase A — Backend: Disponibilidad + Pricing + Fix API ✅ COMPLETADA

| # | Tarea | Estado | Archivo(s) |
|---|-------|--------|------------|
| A1 | **Fix `/api/reservations`**: Eliminado fake success, validación de disponibilidad inline, creación automática de folio + folio_items + reservation_customers | ✅ | `app/api/reservations/route.ts` |
| A2 | **Nuevo `/api/reservations/availability`**: Verifica reservaciones solapadas + reservation_blocks + spaces disponibles + booking_rules (min/max stay) | ✅ | `app/api/reservations/availability/route.ts` |
| A3 | **Nuevo `/api/reservations/pricing`**: Precio por noche con `rates` (priority DESC) → fallback `base_rate`. Service_charges obligatorios + organization_taxes default | ✅ | `app/api/reservations/pricing/route.ts` |
| A4 | **Webhooks adaptados**: Handler compartido `isReservationReference()` + `handleReservationPayment()`. Integrado en Wompi, Stripe, PayPal, MercadoPago, PayU. Referencia con prefijo `RES-` para distinguir de web_orders | ✅ | `lib/reservations/payment-handler.ts`, 5 webhooks |
| A5 | **`/api/checkout/init` adaptado**: Acepta `source:'reservation'` + `sourceId`. Función `getReservation()` genera objeto compatible. Guarda payment_gateway en metadata | ✅ | `app/api/checkout/init/route.ts` |

**Archivos nuevos creados:**
- `app/api/reservations/availability/route.ts` — Endpoint de disponibilidad
- `app/api/reservations/pricing/route.ts` — Endpoint de pricing dinámico
- `lib/reservations/payment-handler.ts` — Handler compartido de pagos para reservaciones

**Archivos modificados:**
- `app/api/reservations/route.ts` — POST reescrito completo, GET corregido
- `app/api/checkout/init/route.ts` — Soporte dual web_order/reservation
- `app/api/webhooks/wompi_co/route.ts` — Integración reservaciones
- `app/api/webhooks/stripe/route.ts` — Integración reservaciones
- `app/api/webhooks/paypal/route.ts` — Integración reservaciones
- `app/api/webhooks/mercadopago/route.ts` — Integración reservaciones
- `app/api/webhooks/payu/route.ts` — Integración reservaciones

#### Fase B — Frontend: Imágenes + Disponibilidad + Pago ✅ COMPLETADA

| # | Tarea | Estado | Archivo(s) |
|---|-------|--------|------------|
| B1 | **Galería de imágenes**: Reutiliza `ProductImageGallery` con imágenes de `space_images` via join spaces→space_images. Fallback a icono Bed. Bucket: `space-images` | ✅ | `app/espacios/[id]/page.tsx` |
| B2 | **Servicios reales**: Query `space_services` → `organization_services` (name, icon, category). Fallback a JSONB `amenities` si no hay services | ✅ | `app/espacios/[id]/page.tsx` |
| B3 | **Pricing dinámico**: Llama `/api/reservations/pricing` al cambiar fechas (debounce 300ms). Muestra desglose: por noche (si hay rates), subtotal, service_charges, impuesto, total | ✅ | `app/espacios/[id]/SpaceBookingForm.tsx` |
| B4 | **Disponibilidad**: Llama `/api/reservations/availability` en paralelo con pricing. Bloquea avance si no hay disponibilidad. Muestra espacios disponibles y errores de booking_rules | ✅ | `app/espacios/[id]/SpaceBookingForm.tsx` |
| B5 | **Paso de pago**: 3 pasos (Fechas→Datos→Pago). Crea reservación vía POST `/api/reservations`, luego llama `/api/checkout/init` con `source:'reservation'`, redirect a pasarela. Si no hay gateways → confirmación directa | ✅ | `app/espacios/[id]/SpaceBookingForm.tsx` |
| B6 | **Tracking `/reserva/[id]`**: Página SSR con estado, detalle estancia, desglose folio/folio_items, pagos, datos del huésped | ✅ | `app/reserva/[id]/page.tsx` (nuevo) |
| B7 | **Email confirmación**: Template HTML con datos de estancia + desglose. Integrado en `payment-handler.ts` al recibir pago exitoso | ✅ | `lib/email/send-reservation-confirmation.ts` (nuevo) |

**Archivos nuevos creados:**
- `app/reserva/[id]/page.tsx` — Página de tracking de reservación
- `lib/email/send-reservation-confirmation.ts` — Email de confirmación vía Resend

**Archivos modificados:**
- `app/espacios/[id]/page.tsx` — Queries para space_images, space_services, gateways
- `app/espacios/[id]/SpaceBookingForm.tsx` — Reescrito: 3 pasos con availability+pricing+pago
- `lib/reservations/payment-handler.ts` — Integrado envío de email al confirmar pago

#### Fase C — Mejoras Avanzadas ✅ (6/6 completadas)

| # | Tarea | Estado |
|---|-------|--------|
| C1 | **Calendario de disponibilidad visual** — Widget con precios y disponibilidad por día | ✅ |
| C2 | **Multi-room booking** — Selección de cantidad por tipo, pricing multi, asignación N spaces vía `reservation_spaces` | ✅ |
| C3 | **Service charges opcionales** — Extras seleccionables (desayuno, transfer, etc.) con recálculo dinámico | ✅ |
| C4 | **Portal `/mi-cuenta/reservas`** — Historial de reservas con link a tracking, nombre de espacio, noches | ✅ |
| C5 | **Cancelación online** — API con verificación de email + política `cancel_before_hours` + botón en tracking | ✅ |
| C6 | **Asignación automática de habitación** — Al confirmar pago, asigna space disponible → status `reserved` | ✅ |

**Archivos nuevos Fase C:**
- `app/api/reservations/calendar/route.ts` — API datos de calendario (precios + disponibilidad por día, 2 meses)
- `components/site/AvailabilityCalendar.tsx` — Widget calendario visual con selección de fechas, precios y leyenda
- `app/api/reservations/cancel/route.ts` — API cancelación con verificación email + booking_rules.cancel_before_hours
- `app/reserva/[id]/CancelReservationButton.tsx` — Componente client botón cancelación con confirmación
- `app/api/reservations/pricing/multi/route.ts` — API pricing multi-room: acepta `rooms[{spaceTypeId, quantity}]`, devuelve desglose por tipo + totales

**Archivos modificados Fase C:**
- `app/api/reservations/pricing/route.ts` — Devuelve `optionalExtras[]` + acepta `selectedExtras[]` para recalcular total
- `app/api/reservations/route.ts` — Acepta `rooms[]` para multi-room, valida disponibilidad por tipo, guarda `is_multi_room` en metadata
- `app/espacios/[id]/SpaceBookingForm.tsx` — Checkboxes de extras opcionales con recálculo automático de pricing
- `app/espacios/[id]/page.tsx` — Integrado AvailabilityCalendar debajo de amenidades
- `lib/reservations/payment-handler.ts` — Asignación automática: single-room (1 space) + multi-room (N spaces vía `reservation_spaces`)
- `app/reserva/[id]/page.tsx` — Botón CancelReservationButton si estado es cancelable
- `app/mi-cuenta/reservas/page.tsx` — Mejorada: link a tracking, nombre space_type, noches, botón nueva reserva
- `lib/queries/customer-portal.ts` — getCustomerReservations incluye join a space_types(name)
- `app/reservas/ReservationWizard.tsx` — Multi-room: selectores de cantidad por tipo (+/-), pricing multi, resumen multi-habitación en pasos 2-4
- `app/reservas/page.tsx` — Pasa gateways SSR al ReservationWizard

#### Fase D — Refactor: Reservas por Espacio (spaceId) ✅

El flujo original centraba toda la lógica de reserva en `spaceTypeId` (tipo de espacio).
Cuando el usuario veía "Habitación 301" y reservaba, la API buscaba el tipo pero no verificaba ESE espacio específico.
Ahora las 4 APIs y los componentes frontend soportan `spaceId` como parámetro principal.

| # | Cambio | Archivo(s) |
|---|--------|------------|
| D1 | **Availability API**: Modo A (spaceId) verifica reservaciones y bloqueos para ESE espacio. Modo B (spaceTypeId) cuenta por tipo (legacy/multi-room) | `app/api/reservations/availability/route.ts` |
| D2 | **Pricing API**: Si viene `spaceId`, resuelve `spaceTypeId` via `spaces.space_type_id`. Pricing sigue usando `rates` + `base_rate` del tipo | `app/api/reservations/pricing/route.ts` |
| D3 | **Calendar API**: Modo A muestra disponibilidad día a día para ESE espacio. Modo B agrega por tipo | `app/api/reservations/calendar/route.ts` |
| D4 | **Reservations POST**: Valida disponibilidad por `spaceId` directo. Crea reservación con `space_id` ya seteado (sin necesidad de auto-asignación posterior) | `app/api/reservations/route.ts` |
| D5 | **SpaceBookingForm**: Prop `spaceId` reemplaza `spaceTypeId`. Envía `spaceId` a availability, pricing y reservations | `app/espacios/[id]/SpaceBookingForm.tsx` |
| D6 | **AvailabilityCalendar**: Prop opcional `spaceId`. Si existe, envía a calendar API en modo espacio | `components/site/AvailabilityCalendar.tsx` |
| D7 | **Payment handler**: Si `space_id` ya está asignado, solo marca como `reserved` (skip auto-assignment) | `lib/reservations/payment-handler.ts` |
| D8 | **Page /espacios/[id]**: Pasa `space.id` a Calendar y BookingForm | `app/espacios/[id]/page.tsx` |

**Compatibilidad**: El flujo multi-room (`/reservas` con `ReservationWizard`) sigue usando `spaceTypeId` (Modo B) sin cambios.

### 7.7 Relación entre Tablas (ER Simplificado)

```
space_categories (code)
    │
    ▼ category_code
space_types (org) ──────── rates (por fecha)
    │                         │
    ▼ space_type_id           │ (pricing)
spaces (branch) ◄────────────┘
    │
    ├── space_images
    ├── space_services → organization_services
    └── housekeeping_tasks
    
reservations (org, branch, customer_id, space_type_id, space_id)
    │
    ├── reservation_spaces (N:N → spaces)
    ├── reservation_customers (N:N → customers)
    ├── reservation_groups
    └── folios
         └── folio_items
         
reservation_blocks (org, branch, space_id/space_type_id, date_from, date_to)

customers
    └── customer_addresses

payments (source='reservation', source_id=reservation.id)
sales (reservation_id → reservations.id)
```

### 7.8 Diferencias clave vs Flujo Retail

| Aspecto | Retail | Hotel/Hospedaje |
|---------|--------|-----------------|
| **Producto** | `products` + `product_prices` | `space_types` + `rates` (dinámico por fecha) |
| **Imágenes** | `product_images` | `space_images` |
| **Inventario** | `stock_levels` (qty) | `spaces` (instancias) + `reservation_blocks` |
| **Orden** | `web_orders` + `web_order_items` | `reservations` + `folios` + `folio_items` |
| **Pago** | `payments` (source: web_order) | `payments` (source: reservation) |
| **Estado** | order.status (pending→confirmed→shipped→delivered) | reservation.status (tentative→confirmed→checked_in→checked_out) |
| **Impuesto** | `organization_taxes` | `organization_taxes` (mismo mecanismo) |
| **Extras** | Shipping (delivery_fee) | `service_charges` (desayuno, transfer, etc.) |
| **Tracking** | `/pedido/[orderNumber]` | `/reserva/[id]` (por crear) |
| **Email** | `send-order-confirmation.ts` | `send-reservation-confirmation.ts` (por crear) |

---

## 9. Restaurante — Módulo POS + Pedidos Online

### 9.1 Análisis de Tablas del Módulo

#### Tablas Core POS (operación en restaurante — gestionadas desde ERP admin)

| Tabla | Columnas Clave | Propósito |
|-------|---------------|-----------|
| `restaurant_tables` | id, organization_id, branch_id, name, zone, capacity, state (`free`/`occupied`), position_x/y | Mesas físicas del restaurante con posición para mapa de piso |
| `table_sessions` | id, organization_id, restaurant_table_id, sale_id, server_id, customers, status (`active`/`completed`), opened_at, closed_at | Sesión de una mesa: asocia mesa → venta → mesero |
| `sales` | id, organization_id, branch_id, customer_id, user_id, total, balance, status (`pending`/`paid`/`void`), payment_status, tax_total, subtotal, discount_total, reservation_id | Venta POS: la cuenta del cliente |
| `sale_items` | id, sale_id, product_id, quantity, unit_price, total, notes (jsonb), tax_amount, tax_rate, discount_amount, paid_at, paid_by_split_id | Ítems de la cuenta con soporte para split de pagos |
| `kitchen_tickets` | id, organization_id, branch_id, sale_id, table_session_id, status, priority, estimated_time, printed_at | Comanda enviada a cocina |
| `kitchen_ticket_items` | id, kitchen_ticket_id, sale_item_id, station, notes, status, preparation_time | Ítems individuales de la comanda con estación (parrilla, bar, etc.) |
| `tips` | id, organization_id, sale_id, payment_id, server_id, amount, tip_type, is_distributed, distribution_batch_id | Propinas por venta/mesero |

#### Tablas Caja y Pagos (ERP admin)

| Tabla | Columnas Clave | Propósito |
|-------|---------------|-----------|
| `cash_sessions` | id, organization_id, branch_id, opened_by, initial_amount, closed_by, final_amount, difference, status | Turno de caja (apertura → cierre con arqueo) |
| `cash_movements` | id, cash_session_id, type, concept, amount, user_id, notes | Movimientos de caja: ingresos/egresos manuales |
| `cash_counts` | id, cash_session_id, count_type, counted_amount, expected_amount, difference, denominations (jsonb) | Arqueo de caja: conteo de billetes/monedas |
| `payments` | id, source, source_id, method, amount, currency, reference, processor_response (jsonb), status | **Universal**: soporta source=`sale`, `web_order`, `reservation` |
| `organization_payment_methods` | id, payment_method_code, is_active, show_on_website, website_display_order, website_display_name, integration_connection_id | Métodos de pago configurables con visibilidad en website |

#### Tablas Pedidos Online (Website → ERP)

| Tabla | Columnas Clave | Propósito |
|-------|---------------|-----------|
| `web_orders` | id, organization_id, branch_id, customer_id, order_number, status, source, subtotal, tax_total, delivery_fee, **tip_amount**, total, **delivery_type**, delivery_address (jsonb), **is_scheduled**, **scheduled_at**, **estimated_ready_at**, **estimated_delivery_at**, payment_status, payment_method, **sale_id**, confirmed_at, ready_at, delivered_at, cancelled_at, cancellation_reason | Pedido online completo con soporte delivery/pickup/dine-in, scheduling, y link a sale POS |
| `web_order_items` | id, web_order_id, product_id, product_name, quantity, unit_price, tax_amount, discount_amount, total, **modifiers** (jsonb), **notes**, status | Ítems con **modificadores** (extras, sin cebolla, etc.) y notas |

#### Tablas Facturación (ERP admin)

| Tabla | Columnas Clave | Propósito |
|-------|---------------|-----------|
| `invoice_sales` | id, organization_id, customer_id, sale_id, number, subtotal, tax_total, total, balance, status, document_type, payment_method_code, payment_form, validated_at, qr_image | Factura electrónica de venta vinculada a sale |
| `invoice_items` | id, invoice_id, invoice_type, product_id, description, qty, unit_price, tax_code, tax_rate, total_line, withholding_taxes (jsonb) | Ítems de factura con soporte tributario completo (DIAN) |
| `invoice_sequences` | id, organization_id, sequence_type, prefix, current_number, padding, reset_period | Secuencias de numeración de facturas |
| `sale_sequences` | id, organization_id, branch_id, sequence_type, prefix, current_number, padding | Secuencias de numeración de ventas |

#### Tablas Finanzas (ERP admin)

| Tabla | Columnas Clave | Propósito |
|-------|---------------|-----------|
| `chart_of_accounts` | account_code, organization_id, name, type, parent_code | Plan de cuentas contables |
| `accounting_rules` | — | Reglas de contabilización automática |
| `accounts_receivable` | id, customer_id, invoice_id, sale_id, amount, balance, due_date, status, days_overdue | Cuentas por cobrar |
| `accounts_payable` | — | Cuentas por pagar a proveedores |
| `bank_accounts` | — | Cuentas bancarias de la organización |
| `finance_audit_log` | entity, entity_id, action, user_id, diff (jsonb), correlation_id | Auditoría de cambios financieros |

#### Tablas Inventario (compartidas con Retail)

| Tabla | Columnas Clave | Propósito |
|-------|---------------|-----------|
| `products` | id, organization_id, sku, name, category_id, is_parent, parent_product_id, variant_data, uuid | Productos/platos del menú |
| `product_prices` | price, effective_from, effective_to | Precios con vigencia temporal |
| `product_images` | storage_path, is_primary, display_order | Fotos de platos |
| `product_tags` / `product_tag_relations` | — | Etiquetas (vegetariano, picante, etc.) |
| `product_variant_relations` | product_id, variant_type_id, variant_value_id | Variantes (tamaño: personal/familiar) |
| `stock_levels` | qty_on_hand, qty_reserved | Inventario de ingredientes |
| `stock_movements` | direction, qty, source | Movimientos de stock |

### 9.2 Flujos del ERP Admin (ya implementados en go-admin-erp)

El ERP admin ya tiene módulos completos bajo `/app/pos/`:

```
pos/
├── page.tsx              ← POS principal: búsqueda productos, carritos, checkout
├── mesas/                ← Mapa de mesas: zonas, estados, combinar/mover, floor map
├── comandas/             ← Kitchen Display: tickets por estación, filtros zona/estado
├── ventas/               ← Historial ventas, detalle, nueva venta
├── pedidos-online/       ← Gestión web_orders: confirmar, preparar, entregar, cancelar
│   └── [id]/components/  ← OrderHeader, OrderProducts, OrderTimeline, CancelOrder, etc.
├── cajas/                ← Cash sessions: abrir/cerrar turno, arqueo
├── cargos-servicio/      ← Service charges
├── propinas/             ← Tips management
├── reportes/             ← Reportes de ventas
├── devoluciones/         ← Refunds
├── pagos-pendientes/     ← Pending payments
├── cupones/              ← Discount coupons
├── promociones/          ← Promotions
└── configuracion/        ← POS settings
```

### 9.3 Estado Actual en Website (goadmin-websites)

#### Lo que YA existe para restaurante:

| Componente | Estado | Nota |
|-----------|--------|------|
| **Productos/Menú** (`/productos`) | ✅ Funcional | Listado con ProductGrid, categorías vía `product_tags`, imágenes, stock badge |
| **Detalle producto** (`/productos/[id]`) | ✅ Funcional | Galería, AddToCartButton, "Comprar ahora" |
| **Carrito** (CartDrawer) | ✅ Funcional | Drawer lateral con imágenes, cantidades, localStorage |
| **Checkout** (`/checkout`) | ✅ Funcional | 3 pasos: carrito → datos → pago. 5 pasarelas. Tax + shipping |
| **API orders** (`/api/orders`) | ✅ Funcional | Crea `web_orders` + `web_order_items`, valida stock, email confirmación |
| **Tracking** (`/pedido/[orderNumber]`) | ✅ Funcional | Tracking público con timeline, productos, totales |
| **Pasarelas de pago** | ✅ 5 gateways | Wompi, MercadoPago, PayU, Stripe, PayPal + webhooks |
| **Reservas mesa** (`/reservas`) | ⚠️ Parcial | ReservationWizard diseñado para hotel, NO para mesas de restaurante |

### 9.4 Análisis Crítico — Problemas y Gaps

#### 🔴 Problemas Graves

1. **El flujo de pedidos NO distingue Delivery vs Pickup vs Dine-in**
   - `web_orders` tiene `delivery_type` pero el CheckoutWizard NO lo usa
   - No hay opción para que el cliente elija: "Recoger en local" / "Domicilio" / "Comer aquí"
   - `delivery_address` se envía siempre aunque sea pickup

2. **No hay menú digital estilo restaurante**
   - La página `/productos` funciona como catálogo retail (grilla de productos)
   - NO hay vista de menú con categorías laterales tipo iFood/Rappi
   - NO hay modificadores/extras (sin cebolla, doble queso) — la tabla `web_order_items.modifiers` (jsonb) existe pero no se usa

3. **No hay sistema de reserva de mesas para restaurante**
   - `restaurant_tables` existe con zonas, capacidad y posiciones
   - El ReservationWizard está diseñado para hotel (space_types), NO para mesas
   - No hay disponibilidad de mesas por horario

4. **No hay propinas online**
   - `web_orders.tip_amount` existe en la tabla pero el checkout NO lo captura
   - `tips` table existe pero solo se usa desde el ERP

5. **No hay pedidos programados**
   - `web_orders.is_scheduled` + `scheduled_at` existen pero no se usan
   - El checkout no permite elegir "Para ahora" vs "Programar para las 7pm"

6. **web_orders NO se vincula con sale POS**
   - `web_orders.sale_id` existe para vincular con `sales` del POS pero nunca se escribe
   - El ERP admin tiene la UI para confirmar y vincular pero necesita que el pedido llegue correctamente

#### 🟡 Gaps Medios

7. **Sin tracking en tiempo real** — El tracking `/pedido/[orderNumber]` es estático, no muestra progreso live
8. **Sin estimación de tiempo** — `estimated_ready_at` / `estimated_delivery_at` no se calculan
9. **Sin notificaciones** — No hay push/email cuando el pedido cambia de estado
10. **Sin portal de cliente** — `/mi-cuenta/pedidos` existe para retail pero no está optimizado para restaurante

#### 🟢 Nice-to-have

11. **Sin menú digital con QR** — Para comer en el restaurante (dine-in), escanear QR y pedir desde la mesa
12. **Sin split de cuenta online** — `sale_items.paid_by_split_id` existe pero solo funciona en POS
13. **Sin cupones/promociones online** — Las tablas existen en ERP pero no en website

### 9.5 Flujo Recomendado — Website para Restaurante

```
┌─────────────────────────────────────────────────────────┐
│                    FLUJO DEL CLIENTE                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. MENÚ DIGITAL (/menu)                                │
│     ├── Categorías laterales (Entradas, Platos, Bebidas)│
│     ├── Búsqueda de platos                              │
│     ├── Filtros (vegetariano, sin gluten, etc.)          │
│     ├── Detalle plato con modificadores (+queso, -sal)  │
│     └── Agregar al carrito con notas                    │
│                                                         │
│  2. TIPO DE PEDIDO (selección obligatoria)              │
│     ├── 🛵 Domicilio (delivery) → pide dirección        │
│     ├── 🏪 Recoger (pickup) → selecciona hora           │
│     └── 🍽️ Comer aquí (dine-in) → mesa/QR opcional      │
│                                                         │
│  3. CHECKOUT (/checkout)                                │
│     ├── Resumen del pedido + modificadores              │
│     ├── Datos del cliente                               │
│     ├── Programar pedido (opcional)                     │
│     ├── Propina (0%, 5%, 10%, 15%, custom)              │
│     ├── Método de pago (5 pasarelas + efectivo)          │
│     └── Confirmar pedido                                │
│                                                         │
│  4. TRACKING (/pedido/[orderNumber])                    │
│     ├── Estado en tiempo real (polling/websocket)       │
│     ├── Timeline: Recibido → Confirmado → Preparando    │
│     │   → Listo → En camino → Entregado                │
│     ├── Tiempo estimado                                 │
│     └── Contactar restaurante                           │
│                                                         │
│  5. RESERVA DE MESA (/reservas)                         │
│     ├── Seleccionar fecha y hora                        │
│     ├── Cantidad de personas                            │
│     ├── Zona preferida (terraza, interior, bar)          │
│     ├── Datos del cliente                               │
│     └── Confirmación por email                          │
│                                                         │
│  6. PORTAL CLIENTE (/mi-cuenta)                         │
│     ├── Historial de pedidos                            │
│     ├── Re-pedir (repetir pedido anterior)              │
│     ├── Mis reservas                                    │
│     └── Favoritos                                       │
│                                                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                FLUJO BACKEND / ERP                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Website POST /api/orders                               │
│      │                                                  │
│      ▼                                                  │
│  web_orders (status: pending, delivery_type, tip_amount) │
│      │                                                  │
│      ▼ (webhook pago exitoso)                           │
│  web_orders.payment_status = 'paid'                     │
│      │                                                  │
│      ▼ (ERP admin confirma)                             │
│  web_orders.status = 'confirmed'                        │
│  → Crear sale + sale_items en POS                       │
│  → Generar kitchen_ticket + kitchen_ticket_items         │
│  → web_orders.sale_id = sale.id                         │
│      │                                                  │
│      ▼ (cocina prepara)                                 │
│  kitchen_tickets.status = 'in_progress' → 'ready'       │
│      │                                                  │
│      ▼ (pedido listo)                                   │
│  web_orders.status = 'ready', ready_at = now()          │
│      │                                                  │
│      ▼ (entregado)                                      │
│  web_orders.status = 'delivered', delivered_at = now()   │
│  sale.status = 'paid'                                   │
│  → Registrar payment                                    │
│  → Generar invoice_sales (opcional, factura electrónica) │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 9.6 Plan de Implementación — 3 Fases

#### Fase A — Menú Digital + Checkout Restaurante (CORE) ✅ COMPLETADA

| # | Tarea | Estado | Archivos |
|---|-------|--------|----------|
| A1 | **Menú digital** (`/menu`) — Categorías, búsqueda, filtros tags, vista agrupada | ✅ | `components/site/MenuView.tsx`, `lib/supabase/queries.ts` (getMenuProducts, getOrganizationTags), `app/[[...slug]]/page.tsx` (case 'menu') |
| A2 | **Modificadores de plato** — variant_types/values como opciones en modal de producto | ✅ | `components/site/MenuView.tsx` (modal detalle con toggleModifier), `lib/supabase/queries.ts` (getProductModifiers, getProductVariantRelations) |
| A3 | **Tipo de pedido** — Selector delivery/pickup/dine-in, condiciona dirección en checkout | ✅ | `components/site/OrderTypeSelector.tsx`, `components/site/CheckoutWizard.tsx` (Step 1 + Step 2 conditional) |
| A4 | **Propinas online** — Selector 0%/5%/10%/15%/custom, se suma al total | ✅ | `components/site/TipSelector.tsx`, `components/site/CheckoutWizard.tsx` (Step 2 + sidebar) |
| A5 | **Programar pedido** — Toggle "Lo antes posible" / "Programar" con slots cada 30min | ✅ | `components/site/ScheduleSelector.tsx`, `components/site/CheckoutWizard.tsx` (Step 1) |
| A6 | **Actualizar /api/orders** — Envía deliveryType, tipAmount, isScheduled, scheduledAt, modifiers, notes | ✅ | `app/api/orders/route.ts` (tip_amount, is_scheduled, scheduled_at en web_orders; modifiers+notes en web_order_items), `app/checkout/page.tsx` (isRestaurant prop) |

#### Fase B — Tracking + Propinas + QR Dine-in ✅ COMPLETADA

| # | Tarea | Estado | Archivos |
|---|-------|--------|----------|
| B1 | **API tracking pedido** — `/api/orders/[id]/tracking` con web_orders + shipments + delivery_attempts + timeline builder | ✅ | `app/api/orders/[id]/tracking/route.ts` |
| B2 | **Página tracking público** — `/pedido/[orderNumber]` con timeline visual, polling 15s, shipment info, delivery attempts | ✅ | `app/pedido/[id]/page.tsx`, `app/pedido/[id]/OrderTracker.tsx` (client) |
| B3 | **Portal pedidos mejorado** — `/mi-cuenta/pedidos/[id]` con timeline horizontal, shipment+carrier, delivery attempts, tip, modifiers, link tracking en vivo | ✅ | `app/mi-cuenta/pedidos/[id]/page.tsx`, `lib/queries/customer-portal.ts` (getCustomerOrderDetail con shipments+delivery_attempts) |
| B4 | **Propina → tabla tips** — Al crear pedido con tip_amount>0, inserta registro en `tips` (tip_type='online', is_distributed=false) para distribución en ERP | ✅ | `app/api/orders/route.ts` |
| B5 | **Email cambio estado** — Template por status (confirmed/preparing/ready/shipped/delivered/cancelled) con Resend | ✅ | `lib/email/send-order-status-email.ts` |
| B6 | **QR dine-in** — `/menu?table=MESA-5` detecta mesa, banner en menú+checkout, auto-selecciona dine_in, envía tableName al API, guarda en internal_notes | ✅ | `components/site/MenuView.tsx`, `components/site/CheckoutWizard.tsx`, `app/api/orders/route.ts` |

**Tablas usadas (sin crear nuevas):** `shipments` (source_type='web_order'), `transport_carriers`, `delivery_attempts`, `tips`

#### Fase C — Cupones, Promociones, Re-pedir, Shipping Dinámico ✅ COMPLETADA

| # | Tarea | Estado | Archivos |
|---|-------|--------|----------|
| C1 | **Cupones en checkout** — Input código cupón, API `/api/coupons/validate` con 8 validaciones (activo, fechas, límite uso, cliente, primera compra, monto mín), aplicar descuento, registrar `coupon_redemptions`, incrementar `usage_count`, guardar `coupon_code` + `discount_total` en `web_orders` | ✅ | `app/api/coupons/validate/route.ts`, `components/site/CheckoutWizard.tsx`, `app/api/orders/route.ts` |
| C2 | **Promociones automáticas** — API `/api/promotions/check` detecta promos activas por reglas (producto/categoría/monto mín), soporta tipos percentage/fixed/buy_x_get_y/bundle, combinabilidad y prioridad; auto-check en checkout via useEffect; muestra promos aplicadas en sidebar | ✅ | `app/api/promotions/check/route.ts`, `components/site/CheckoutWizard.tsx` |
| C3 | **Re-pedir** — Componente `ReorderButton` (client) que lee items del pedido anterior, los agrega al carrito localStorage y redirige a /checkout; integrado en `/mi-cuenta/pedidos/[id]` para pedidos finalizados | ✅ | `components/site/ReorderButton.tsx`, `app/mi-cuenta/pedidos/[id]/page.tsx` |
| C4 | **Shipping dinámico** — API `/api/shipping/calculate` consulta `shipping_rates` por ciudad/zona/peso, calcula costos con base_rate+rate_per_kg+fuel_surcharge, devuelve cheapest/fastest; selector radio buttons en checkout con debounce 500ms; fallback a flat rate si no hay tarifas | ✅ | `app/api/shipping/calculate/route.ts`, `components/site/CheckoutWizard.tsx` |

| C5 | **Variantes padre/hijo (retail)** — Queries filtran `parent_product_id IS NULL` (solo padres+simples), cuentan hijos activos. ProductGrid muestra badge "X variantes" y botón "Elegir" que abre VariantSelector dialog. Detalle producto muestra selector inline si `is_parent=true`. API `/api/products/[id]/variants` devuelve hijos. Al elegir variante, se agrega el producto hijo (con su propio id/price/sku) al carrito | ✅ | `lib/supabase/queries.ts` (getOrganizationProducts filtro + getProductVariants), `components/site/VariantSelector.tsx`, `components/site/ProductGrid.tsx` (badge + dialog), `app/productos/[id]/ProductDetailActions.tsx`, `app/api/products/[id]/variants/route.ts` |
| C6 | **Fix propina duplicada (Opción C)** — Website crea tip inmediatamente (`sale_id=null`, `tip_type='online'`). ERP `webOrderConfirmationService.createTip()` busca tip existente por order_number y lo actualiza con `sale_id` + `server_id` correcto en vez de crear duplicado | ✅ | `app/api/orders/route.ts` (mantiene insert tip), ERP: `webOrderConfirmationService.ts` (busca+actualiza) |
| C7 | **Fix reserva de stock** — Al crear web_order, incrementa `qty_reserved` en `stock_levels` por cada item para evitar sobreventa. La validación ya existente usa `qty_on_hand - qty_reserved` | ✅ | `app/api/orders/route.ts` (bloque stock reservation post-insert) |

**Migración aplicada:** `ALTER TABLE web_orders ADD COLUMN coupon_code text`
**Tablas usadas (sin crear nuevas):** `coupons`, `coupon_redemptions`, `promotions`, `promotion_rules`, `shipping_rates`, `transport_carriers`
**Patrón variantes:** Productos padre (`is_parent=true`, `parent_product_id=null`) → hijos (`parent_product_id=<padre_id>`, `variant_data` jsonb con atributos como Color, Talla)

### 9.7 Relación entre Tablas (ER Simplificado — Restaurante)

```
products (org) ──────── product_prices (vigencia)
    │                        │
    ├── product_images       │
    ├── product_tags         │
    ├── stock_levels (qty_on_hand, qty_reserved)
    └── parent_product_id ──► products (padre/hijo: variantes retail)
         └── variant_data (jsonb: {"Color":"Rojo","Talla":"M"})
                             │
web_orders (org, branch) ◄──┘ (pedido online)
    │
    ├── web_order_items (product_id, modifiers jsonb, notes)
    ├── customer_id → customers
    └── sale_id → sales (POS, vinculado al confirmar)
                    │
                    ├── sale_items (product_id, quantity, split_id)
                    ├── kitchen_tickets
                    │       └── kitchen_ticket_items (station, status)
                    └── tips (server_id, amount)

restaurant_tables (org, branch, zone, capacity, state)
    └── table_sessions (server_id, status)
            └── sale_id → sales

cash_sessions (org, branch, opened_by)
    ├── cash_movements (type, concept, amount)
    └── cash_counts (denominations, difference)

payments (source='web_order' | 'sale' | 'reservation')
    └── processor_response (jsonb)

invoice_sales (org, sale_id, customer_id, document_type)
    └── invoice_items (product_id, tax_code, withholding_taxes)

accounts_receivable (customer_id, invoice_id, sale_id, balance)

organization_payment_methods (show_on_website, integration_connection_id)
```

### 9.8 Diferencias clave: Retail vs Hotel vs Restaurante

| Aspecto | Retail | Hotel | Restaurante |
|---------|--------|-------|-------------|
| **Producto** | `products` físicos | `space_types` + `rates` | `products` como platos del menú |
| **Orden** | `web_orders` (envío) | `reservations` + `folios` | `web_orders` (delivery/pickup/dine-in) → `sales` POS |
| **Extras** | Shipping | `service_charges` | `modifiers` (jsonb en web_order_items) |
| **Inventario** | `stock_levels` | `spaces` (instancias) | `stock_levels` (ingredientes) |
| **Pago** | Online 100% | Online 100% | Online + efectivo al recibir |
| **Tracking** | Envío postal | Reservación | Preparación cocina en tiempo real |
| **Propina** | ❌ No aplica | ❌ No aplica | ✅ `tips` + `web_orders.tip_amount` |
| **Facturación** | Básica | `folios`/`folio_items` | `invoice_sales` (electrónica DIAN) |
| **Programar** | ❌ No aplica | check-in futuro | ✅ `is_scheduled` + `scheduled_at` |
| **Mesa/Ubicación** | ❌ No aplica | `spaces` (habitación) | `restaurant_tables` (mesa + zona) |

### 9.9 Archivos a Crear/Modificar (Estimación)

**Fase A (nuevos):**
- `app/menu/page.tsx` — Página SSR menú digital con categorías
- `components/site/MenuView.tsx` — Componente client vista menú restaurante
- `components/site/MenuItemCard.tsx` — Card de plato con modificadores
- `components/site/ModifiersSelector.tsx` — Selector de extras/quitar ingredientes
- `components/site/OrderTypeSelector.tsx` — Componente delivery/pickup/dine-in
- `components/site/TipSelector.tsx` — Selector de propina en checkout
- `components/site/ScheduleSelector.tsx` — Selector hora programada

**Fase A (modificar):**
- `components/site/CheckoutWizard.tsx` — Agregar: tipo pedido, propina, programar, modifiers display
- `app/api/orders/route.ts` — Enviar delivery_type, tip_amount, is_scheduled, scheduled_at, modifiers
- `app/[[...slug]]/page.tsx` — Fallback para slug `menu`

**Fase B (nuevos):**
- `app/api/restaurant/availability/route.ts` — API disponibilidad de mesas
- `app/reservas/RestaurantReservationWizard.tsx` — Wizard específico para mesa de restaurante

**Fase B (modificar):**
- `app/reservas/page.tsx` — Detectar tipo org y renderizar wizard correcto (hotel vs restaurante)
- `app/pedido/[orderNumber]/page.tsx` — Agregar polling + timeline mejorado

---

## 8. Gym — Gimnasio / Centro Deportivo

### 8.0 Análisis Crítico del Estado Actual

#### 8.0.1 Módulo Gym en ERP (Admin) — Ya implementado ✅

El ERP (`go-admin-erp/src/app/app/gym/`) tiene **12 páginas** completas:

| Página ERP | Funcionalidad | Tablas principales |
|-----------|---------------|-------------------|
| `/gym` | Dashboard: stats activos, vencimientos, check-ins hoy, ingresos | `memberships`, `member_checkins` |
| `/gym/planes` | CRUD planes de membresía (nombre, precio, duración, frecuencia, reglas acceso) | `membership_plans` |
| `/gym/membresias` | CRUD membresías, congelar/descongelar, renovar, generar QR, filtros | `memberships`, `membership_freezes` |
| `/gym/clases` | CRUD clases: título, instructor, capacidad, recurrencia, dificultad | `gym_classes` |
| `/gym/checkin` | Buscar miembro, validar membresía vigente, registrar check-in | `member_checkins` |
| `/gym/horarios` | Calendario semanal visual de clases por branch | `gym_classes` |
| `/gym/reservaciones` | Reservas de clases, check-in de asistencia, filtros | `class_reservations` |
| `/gym/instructores` | Gestión de instructores (empleados con rol instructor) | `employments` / `users` |
| `/gym/dispositivos` | Torniquetes, lectores QR, configuración de acceso | `gym_access_devices` |
| `/gym/reportes` | Reportes del gimnasio | Varias |
| `/gym/ajustes` | Configuración general del módulo | `organization_settings` |

**Servicio:** `go-admin-erp/src/lib/services/gymService.ts` — getPlans, getMemberships, getClasses, getReservations, getTodayCheckins, createClass, freezeMembership, renewMembership, etc.

#### 8.0.2 Tablas de BD del Módulo Gym (10 tablas)

```
membership_plans (org_id, name, description, price, duration_days, frequency, access_rules jsonb, is_active)
    │
    └── memberships (customer_id, membership_plan_id, start_date, end_date, status, access_code, sale_id, notes, freeze_history jsonb)
         │
         ├── membership_payments (membership_id → payment_id uuid)
         ├── membership_freezes (start_date, end_date, days_frozen, reason, status, approved_by)
         ├── membership_events (event_type, old_value jsonb, new_value jsonb, metadata jsonb — audit trail)
         └── member_checkins (branch_id, checkin_at, method, class_reservation_id, staff_id, denied_reason)

gym_classes (org_id, branch_id, title, description, instructor_id, start_at, end_at, capacity,
             class_type, difficulty_level, duration_minutes, room, location, recurrence jsonb,
             status, equipment_needed, notify_on_cancel)
    │
    └── class_reservations (gym_class_id, customer_id, membership_id, status, reservation_source,
                            booked_at, checkin_time, cancelled_at, cancellation_reason, notes)

gym_access_devices (branch_id, device_name, device_type, serial_number, ip_address, is_active,
                    current_qr_token, qr_token_expires_at, configuration jsonb, last_sync_at)
```

**Detalle de columnas clave:**

| Tabla | Columna | Tipo | Descripción |
|-------|---------|------|-------------|
| `membership_plans` | `access_rules` | jsonb | Reglas: horarios permitidos, branches, clases incluidas |
| `membership_plans` | `frequency` | text | monthly, quarterly, annual, etc. |
| `membership_plans` | `duration_days` | int | Duración en días del plan |
| `memberships` | `status` | text | active, expired, frozen, cancelled, pending_payment |
| `memberships` | `access_code` | text | Código único para check-in (QR/manual) |
| `memberships` | `sale_id` | uuid | Vínculo a `sales` cuando se vende en POS |
| `class_reservations` | `reservation_source` | text | 'pos', 'admin', **'website'** ← preparado para website |
| `member_checkins` | `method` | text | 'qr', 'code', 'manual', 'device' |

#### 8.0.3 Tablas de soporte (cross-module)

| Tabla | Uso en Gym |
|-------|-----------|
| `payments` | `source='membership'`, `source_id=membership.id` — Pago de membresía online |
| `sales` | Venta presencial en POS. `memberships.sale_id` → `sales.id` |
| `customers` | `customer_id` (uuid) + `user_id` (auth). Mismo cliente para gym y otros módulos |
| `invoice_sales` | Facturación electrónica. `sale_id` vincula a la venta de membresía |
| `accounts_receivable` | Cartera. Si membresía queda con balance pendiente |
| `organization_taxes` | Impuestos aplicables al precio del plan |

#### 8.0.4 Problemas Críticos del Website Actual

**❌ Problema 1: `MembershipPlans.tsx` usa `products`, NO `membership_plans`**

La sección del template actual (`components/site/sections/gym/MembershipPlans.tsx`) muestra planes desde la tabla `products` (genérica retail), pero el ERP usa `membership_plans` como tabla dedicada con campos específicos (`duration_days`, `frequency`, `access_rules`).

`memberships.membership_plan_id` → apunta a `membership_plans.id`, **NO** a `products.id`. Son dos mundos completamente desconectados.

**❌ Problema 2: `ClassesSchedule.tsx` es 100% datos hardcodeados**

El componente `components/site/sections/gym/ClassesSchedule.tsx` tiene clases fake ("Spinning", "Yoga", etc.) sin ninguna conexión a `gym_classes`. La tabla tiene estructura completa: instructor real, capacidad, recurrencia jsonb, nivel de dificultad.

**❌ Problema 3: No existe flujo de compra de membresía online**

A pesar de tener **5 pasarelas de pago** funcionando (Wompi, MercadoPago, PayU, Stripe, PayPal), no hay forma de que un cliente compre una membresía desde el website.

```
RETAIL:      products → checkout → /api/orders → web_orders → webhook → payment → ✅
HOTEL:       space_types → /api/reservations → reservations → /api/checkout/init → webhook → ✅
RESTAURANTE: products(menú) → checkout → /api/orders → web_orders → webhook → ✅
GYM:         membership_plans → ??? → ??? → ??? ← NO EXISTE
```

**❌ Problema 4: No existe reserva de clases desde website**

`class_reservations.reservation_source` ya contempla el valor `'website'`, pero no hay API ni UI para que el cliente reserve cupos.

#### 8.0.5 Separación de Responsabilidades: ERP vs Website

| Responsabilidad | ERP (Admin) ✅ | Website (Cliente) |
|----------------|---------------|-------------------|
| CRUD planes de membresía | ✅ `/gym/planes` | ❌ Solo lectura |
| Vender membresía presencial | ✅ POS → `sales` → `memberships` | — |
| **Vender membresía online** | — | 🔨 **Fase A** |
| CRUD clases y horarios | ✅ `/gym/clases`, `/gym/horarios` | ❌ Solo lectura |
| Reservar clase (admin) | ✅ `/gym/reservaciones` | — |
| **Reservar clase (cliente)** | — | 🔨 **Fase B** |
| Check-in presencial | ✅ `/gym/checkin` (QR, código, manual) | — |
| **QR digital del miembro** | — | 🔨 **Fase C** portal |
| Congelar membresía | ✅ `/gym/membresias` (aprueba) | 🔨 **Fase C** (solicita) |
| Renovar membresía | ✅ Manual en ERP | 🔨 **Fase A** online |
| Ver mi membresía | — | ✅ `/mi-cuenta/membresia` (básico, mejorar) |
| Ver mis check-ins | — | ✅ `/mi-cuenta/checkins` (básico, mejorar) |
| Reportes, dispositivos, config | ✅ Solo ERP | — |

**Principio clave:** El website es el canal de **autoservicio del cliente**. El ERP es el canal de **gestión operativa del staff**. No se duplica funcionalidad — se complementan sobre las mismas tablas.

### 8.1 Páginas del Builder (personalizables por secciones)

| # | Slug | Título Default | En Header | En Footer | Tipo |
|---|------|---------------|-----------|-----------|------|
| 1 | `home` | Inicio | ✅ | ❌ | builtin |
| 2 | `membresias` | Membresías | ✅ | ✅ | builtin |
| 3 | `clases` | Clases | ✅ | ✅ | builtin |
| 4 | `entrenadores` | Entrenadores | ✅ | ✅ | builtin |
| 5 | `nosotros` | Nosotros | ✅ | ✅ | builtin |
| 6 | `contacto` | Contacto | ✅ | ✅ | builtin |

### 8.1.1 Páginas de Sistema (lógica fija)

| Ruta | Descripción | Tablas |
|------|-------------|--------|
| `/membresias` | Comparación de planes con datos reales desde `membership_plans`, CTA de compra | `membership_plans` (name, price, duration_days, frequency, access_rules, is_active) |
| `/clases` | Horario semanal real con datos desde `gym_classes`, cupos disponibles, botón reservar | `gym_classes` + `class_reservations` (count para cupos) |
| `/clases/[id]` | Detalle de clase: instructor, dificultad, cupos, horario, equipamiento, botón reservar | `gym_classes`, `class_reservations` |
| `/checkout` | Checkout de membresía: resumen plan → datos personales → selección pasarela → pago | `membership_plans` → crea `memberships` (status='pending_payment') + `payments` |
| `/auth` | Login / Registro | `customers` + Supabase Auth |
| `/mi-cuenta` | Dashboard: membresía activa, próximas clases reservadas, check-ins recientes | `memberships` + `class_reservations` + `member_checkins` |
| `/mi-cuenta/perfil` | Editar datos personales | `customers` |
| `/mi-cuenta/membresia` | Mi membresía: vigencia, plan, código acceso/QR, congelamientos, historial pagos, renovar | `memberships` + `membership_plans` + `membership_payments` + `membership_freezes` |
| `/mi-cuenta/clases` | Mis reservaciones: próximas y pasadas, cancelar reserva | `class_reservations` + `gym_classes` |
| `/mi-cuenta/checkins` | Historial de accesos al gimnasio con fecha, hora, método | `member_checkins` |

### 8.2 Templates

#### `gym_power` ⭐ (Default)

| Propiedad | Valor |
|-----------|-------|
| **Estilo** | Oscuro, energético, bold, motivacional |
| **Colores** | `#FF4444` (rojo), `#1A1A1A` (negro) |
| **Fuentes** | Oswald / Roboto |
| **Header** | `default` — Bold con CTA "Únete Ahora" |
| **Footer** | `default` |

**Página Home:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `hero` | `video` |
| 2 | `membership_plans` | `pricing_table` |
| 3 | `gym_features` | `icons` |
| 4 | `class_schedule` | `grid` |
| 5 | `trainers` | `grid` |
| 6 | `transformation` | `before_after` |
| 7 | `testimonials` | `carousel` |
| 8 | `cta` | `with_image` |
| 9 | `gallery` | `grid` |

**Página Membresías:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `hero` | `minimal` |
| 2 | `membership_plans` | `comparison` |
| 3 | `faq` | `accordion` |
| 4 | `cta` | `centered` |

**Página Clases:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `hero` | `minimal` |
| 2 | `class_schedule` | `weekly` |
| 3 | `trainers` | `carousel` |

**Página Entrenadores:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `hero` | `minimal` |
| 2 | `trainers` | `profiles` |

---

#### `gym_wellness`

| Propiedad | Valor |
|-----------|-------|
| **Estilo** | Claro, zen, yoga/pilates, tonos suaves |
| **Colores** | `#7C9A92` (sage), `#F5F0EB` (crema) |
| **Fuentes** | Quicksand / Nunito |
| **Header** | `minimal` |
| **Footer** | `centered` |

#### `gym_urban`

| Propiedad | Valor |
|-----------|-------|
| **Estilo** | Callejero, grafiti, crossfit, raw |
| **Colores** | `#FFD600` (amarillo), `#212121` (casi negro) |
| **Fuentes** | Bebas Neue / Barlow |
| **Header** | `default` |
| **Footer** | `minimal` |

#### `gym_premium`

| Propiedad | Valor |
|-----------|-------|
| **Estilo** | Boutique fitness, premium, elegante |
| **Colores** | `#B8860B` (gold dark), `#1C1C1C` (charcoal) |
| **Fuentes** | Cormorant Garamond / Montserrat |
| **Header** | `transparent` |
| **Footer** | `three_columns` |

### 8.3 Flujo de Pago: Compra de Membresía Online

```
Cliente en /membresias
    │
    ├── Ve planes reales desde membership_plans (is_active=true)
    ├── Selecciona plan → Redirige a /checkout?plan={plan_id}
    │
    ▼
/checkout (Gym Membership)
    │
    ├── Step 1: Resumen del plan (nombre, precio, duración, qué incluye)
    ├── Step 2: Datos del cliente (login o registro + datos)
    ├── Step 3: Seleccionar pasarela de pago (5 gateways disponibles)
    │
    ├── API POST /api/memberships/purchase
    │   ├── Valida: plan existe, is_active, cliente autenticado
    │   ├── Calcula: precio + impuestos (organization_taxes)
    │   ├── Crea: membership (status='pending_payment', customer_id, plan_id, start/end_date)
    │   ├── Crea: payment (source='membership', source_id=membership.id, status='pending')
    │   └── Redirige: a URL de pasarela seleccionada
    │
    ▼
Webhook de pasarela (payment confirmed)
    │
    ├── Actualiza: payment.status = 'approved'
    ├── Actualiza: membership.status = 'active'
    ├── Crea: membership_payments (membership_id, payment_id)
    ├── Genera: access_code único para check-in
    ├── Registra: membership_events (event_type='activated', metadata={source:'website'})
    └── Envía: email confirmación con datos del plan + código de acceso
    │
    ▼
ERP ve nueva membresía activa en /gym/membresias
(No necesita intervención — todo automático)
```

### 8.4 Flujo: Reserva de Clase Online

```
Cliente en /clases
    │
    ├── Ve horario semanal real desde gym_classes (status='scheduled')
    ├── Ve cupos disponibles: capacity - COUNT(class_reservations WHERE status='confirmed')
    ├── Click "Reservar" → requiere login
    │
    ▼
API POST /api/classes/{id}/reserve
    │
    ├── Valida: clase existe, status='scheduled', fecha futura
    ├── Valida: membresía activa del customer (memberships.status='active', end_date > now)
    ├── Valida: cupos disponibles (capacity > confirmed reservations count)
    ├── Valida: no duplicar (customer no tiene reserva activa para esta clase)
    ├── Valida: access_rules del plan permiten esta clase/tipo/horario
    │
    ├── Crea: class_reservation (status='confirmed', reservation_source='website', booked_at=now)
    └── Envía: email confirmación con fecha, hora, instructor, ubicación
    │
    ▼
ERP ve reservación en /gym/reservaciones (reservation_source='website')
Staff puede hacer check-in de asistencia desde el ERP
```

### 8.5 Relación entre Tablas (ER Simplificado — Gym)

```
membership_plans (org) ───────────── price, duration_days, frequency, access_rules
    │
    └── memberships (customer_id, plan_id, status, access_code, sale_id)
         │
         ├── membership_payments ──► payments (source='membership', amount, status, processor_response)
         │                                │
         │                                └── Webhook confirma → activa membership
         │
         ├── membership_freezes (start_date, end_date, reason, status, approved_by)
         ├── membership_events (event_type, old_value, new_value — audit trail)
         │
         └── member_checkins (checkin_at, method, branch_id)
              │
              └── class_reservation_id ──► class_reservations (status, reservation_source)
                                               │
                                               └── gym_class_id ──► gym_classes (title, instructor_id,
                                                                      capacity, start_at, end_at,
                                                                      class_type, difficulty_level,
                                                                      recurrence jsonb)

customers (id uuid, user_id, org_id, first_name, last_name, email, phone)
    └── Es el mismo customer para todos los módulos (retail, hotel, restaurant, gym)

organization_payment_methods (show_on_website, integration_connection_id)
    └── 5 pasarelas: Wompi, MercadoPago, PayU, Stripe, PayPal

organization_taxes (name, rate, is_default, is_active)
    └── Impuestos aplicables al precio del plan
```

### 8.6 Implementación por Fases

#### Fase A — Membresías Online ✅ COMPLETADA

| # | Tarea | Estado | Archivos |
|---|-------|--------|----------|
| A1 | **Query `getMembershipPlans`** — Lectura de planes activos desde `membership_plans` | ✅ | `lib/supabase/queries.ts` (+getMembershipPlans, +getMembershipPlanById) |
| A2 | **Refactor `MembershipPlans.tsx`** — Usa `membership_plans` reales en vez de `products`, muestra duración, frecuencia, features desde `access_rules` | ✅ | `components/site/sections/gym/MembershipPlans.tsx` (refactorizado) |
| A3 | **Página `/membresias`** — SSR con planes reales, hero, FAQ, CTA contacto | ✅ | `app/membresias/page.tsx` (nuevo) |
| A4 | **API `/api/memberships/purchase`** — Valida plan, calcula impuestos, crea `membership` (status='pending_payment'), genera access_code, registra `membership_events` | ✅ | `app/api/memberships/purchase/route.ts` (nuevo) |
| A5 | **Extender `checkout/init`** — Soporte `source:'membership'` con referencia `MEM-{id}`, busca membership + customer email | ✅ | `app/api/checkout/init/route.ts` (+getMembership, +isMembership branch) |
| A6 | **Membership payment handler** — Activa membership, crea `payments` (source='membership'), `membership_payments`, `membership_events`, envía email | ✅ | `lib/memberships/payment-handler.ts` (nuevo) |
| A7 | **5 Webhooks extendidos** — Detección `MEM-` prefix + `handleMembershipPayment` en Stripe, Wompi, MercadoPago, PayU, PayPal | ✅ | `app/api/webhooks/{stripe,wompi_co,mercadopago,payu,paypal}/route.ts` |
| A8 | **Email confirmación** — Template HTML con plan, vigencia, código acceso, botón portal | ✅ | `lib/email/send-membership-confirmation.ts` (nuevo) |
| A9 | **Template + Site integration** — `GymTemplate` acepta `membershipPlans`, `OrganizationSite` pasa datos, `page.tsx` fetch condicional | ✅ | `components/site/templates/GymTemplate.tsx`, `components/site/OrganizationSite.tsx`, `app/[[...slug]]/page.tsx` |

**Flujo completo implementado:**
```
/membresias → selecciona plan → /checkout?plan={id}
    → POST /api/memberships/purchase (crea membership pending_payment + access_code)
    → POST /api/checkout/init (source:'membership', sourceId:{id}) → URL pasarela
    → Webhook detecta MEM-{id} → handleMembershipPayment
        → activa membership, crea payments + membership_payments + membership_events
        → envía email confirmación con código de acceso
    → ERP ve membresía activa automáticamente en /gym/membresias
```

**Tablas que se escriben:** `memberships`, `membership_payments`, `membership_events`, `payments`
**Tablas que se leen:** `membership_plans`, `organization_taxes`, `customers`

**Pendiente (A8 portal mejorado):** `/mi-cuenta/membresia` — Renovar online, historial pagos, QR digital (se implementará en Fase C)

#### Fase B — Clases y Reservaciones Online ✅ COMPLETADA

| # | Tarea | Estado | Archivos |
|---|-------|--------|----------|
| B1 | **Queries `getGymClasses` + `getClassReservationCounts` + `getGymClassById`** — Clases activas con instructor (profiles join), conteo de reservas por clase | ✅ | `lib/supabase/queries.ts` |
| B2 | **Refactor `ClassesSchedule.tsx`** — Datos reales de `gym_classes`, filtro por día, cupos disponibles (capacity - reservas), emoji por class_type, dificultad, instructor, room | ✅ | `components/site/sections/gym/ClassesSchedule.tsx` |
| B3 | **Integración template + page** — `GymTemplate` acepta gymClasses + reservationCounts, `OrganizationSite` pasa props, `page.tsx` fetch condicional | ✅ | `GymTemplate.tsx`, `OrganizationSite.tsx`, `app/[[...slug]]/page.tsx` |
| B4 | **API `/api/classes/[id]/reserve`** — Valida clase activa, no pasada, cupos, membresía activa, no duplicar; crea `class_reservations` (reservation_source='website') | ✅ | `app/api/classes/[id]/reserve/route.ts` (nuevo) |
| B5 | **API `/api/classes/[id]/cancel`** — Valida reserva propia, status 'booked', policy 2h antes; cancela con razón | ✅ | `app/api/classes/[id]/cancel/route.ts` (nuevo) |
| B6 | **Query `getCustomerClassReservations`** — Reservas del cliente con gym_classes join (título, horario, instructor) | ✅ | `lib/queries/customer-portal.ts` |
| B7 | **`/mi-cuenta/clases` mejorado** — Próximas (con fecha, hora, instructor, room) y historial (con status badge), link a horario | ✅ | `app/mi-cuenta/clases/page.tsx` (refactorizado) |

**Flujo completo implementado:**
```
/home (GymTemplate) → ClassesSchedule con datos reales (gym_classes + cupos)
    → Click "Reservar Cupo" → POST /api/classes/{id}/reserve
        → Valida: clase activa + cupos + membresía activa + no duplicada
        → Crea class_reservations (reservation_source='website', membership_id)
    → /mi-cuenta/clases → ve próximas y historial
    → POST /api/classes/{id}/cancel → cancela (policy: 2h antes)
    → ERP ve reservación automáticamente en /gym/reservaciones
```

**Tablas que se escriben:** `class_reservations`
**Tablas que se leen:** `gym_classes`, `profiles` (instructor), `class_reservations`, `memberships`

#### Fase C — Self-Service Avanzado ✅ COMPLETADA

| # | Tarea | Estado | Archivos |
|---|-------|--------|----------|
| C1 | **QR digital** — Componente `MembershipQR` muestra access_code como QR SVG expandible en `/mi-cuenta/membresia` | ✅ | `components/site/sections/gym/MembershipQR.tsx` (nuevo), `app/mi-cuenta/membresia/page.tsx` |
| C2 | **Solicitud de congelamiento** — API crea `membership_freezes` (status='pending'), formulario con días + motivo, validación sin duplicados | ✅ | `app/api/memberships/freeze/route.ts` (nuevo), `components/site/sections/gym/FreezeRequestForm.tsx` (nuevo), `app/mi-cuenta/membresia/page.tsx` |
| C3 | **Renovación pre-vencimiento** — Alerta amarilla (≤7 días), alerta roja (expirada), botón "Renovar" → `/membresias?renew={planId}` | ✅ | `app/mi-cuenta/membresia/page.tsx` |
| C4 | **Emails automáticos** — Confirmación clase (con instructor, sala, horario), cancelación clase, recordatorio vencimiento (urgencia por color: 7d/3d/1d/0d) | ✅ | `lib/email/send-class-reservation-email.ts` (nuevo), `lib/email/send-membership-reminder.ts` (nuevo) |
| C5 | **`/mi-cuenta/checkins` mejorado** — Resumen (este mes + total), gráfica de barras 6 meses, listado agrupado por mes | ✅ | `app/mi-cuenta/checkins/page.tsx` |

**Archivos nuevos creados:**
- `components/site/sections/gym/MembershipQR.tsx` — QR SVG con qrcode.react, expandible
- `components/site/sections/gym/FreezeRequestForm.tsx` — Formulario client con días (1-90) + motivo
- `app/api/memberships/freeze/route.ts` — API POST: valida membresía activa, sin freeze duplicado, crea pending
- `lib/email/send-class-reservation-email.ts` — Email confirmación + cancelación de clase vía Resend
- `lib/email/send-membership-reminder.ts` — Email recordatorio vencimiento (urgencia por días restantes)

**Archivos modificados:**
- `app/mi-cuenta/membresia/page.tsx` — QR, freeze form, alertas vencimiento/expirada, días restantes, acciones rápidas
- `app/mi-cuenta/checkins/page.tsx` — Estadísticas, gráfica barras 6 meses, agrupado por mes
- `app/api/classes/[id]/reserve/route.ts` — +envío email confirmación clase
- `app/api/classes/[id]/cancel/route.ts` — +envío email cancelación clase

**Dependencia agregada:** `qrcode.react` (QR SVG generation)

### 8.7 Diferencias clave: Gym vs otros módulos

| Aspecto | Retail | Hotel | Restaurante | **Gym** |
|---------|--------|-------|-------------|---------|
| **Producto** | `products` físicos | `space_types` + `rates` | `products` platos | **`membership_plans`** planes |
| **Orden** | `web_orders` (envío) | `reservations` + `folios` | `web_orders` (delivery) | **`memberships`** (vigencia) |
| **Checkout** | Carrito → pago único | Fechas → pago único | Carrito → pago único | **Plan → pago único/recurrente** |
| **Ciclo de vida** | order created → paid → shipped → delivered | reservation → confirmed → checked_in → checked_out | order → preparing → ready → delivered | **pending → active → frozen? → expired → renewed** |
| **Inventario** | `stock_levels` | `spaces` (habitaciones) | `stock_levels` (ingredientes) | **`capacity`** (cupos de clase) |
| **Acceso** | N/A | Check-in presencial | N/A | **`member_checkins`** + QR/código |
| **Recurrencia** | ❌ | ❌ | ❌ | **✅ Renovación** mensual/trimestral/anual |
| **Propina** | ❌ | ❌ | ✅ `tips` | ❌ |
| **Reserva extra** | ❌ | ❌ | ❌ (mesa futura) | **✅ `class_reservations`** |

---

## 9. Transport — Transporte de Pasajeros / Logística

### 9.1 Páginas del Builder (personalizables por secciones)

| # | Slug | Título Default | En Header | En Footer | Tipo |
|---|------|---------------|-----------|-----------|------|
| 1 | `home` | Inicio | ✅ | ❌ | builtin |
| 2 | `servicios` | Servicios | ✅ | ✅ | builtin |
| 3 | `rutas` | Rutas | ✅ | ✅ | builtin |
| 4 | `flota` | Nuestra Flota | ✅ | ✅ | builtin |
| 5 | `nosotros` | Nosotros | ✅ | ✅ | builtin |
| 6 | `contacto` | Contacto | ✅ | ✅ | builtin |

### Páginas de Sistema (lógica fija)

| Ruta | Descripción | Tablas |
|------|-------------|--------|
| `/viajes` | Buscador de viajes: origen, destino, fecha, pasajeros → resultados | `trips` (trip_date, scheduled_departure, available_seats, base_fare, status) + `transport_routes` (name, code, origin_stop_id, destination_stop_id) + `transport_stops` (name, city) + `transport_fares` (fare_name, fare_type, amount) |
| `/viajes/[id]` | Detalle de viaje: horario, ruta, paradas, mapa + selección de asiento interactiva | `trips` + `trip_seats` (seat_label, status, reserved_until) + `vehicle_seats` (seat_row, seat_column, seat_type, price_modifier) + `vehicles` (brand, model, passenger_capacity) |
| `/checkout` | Compra de pasaje: datos pasajero (nombre, documento) → asiento → pago | `trip_tickets` (passenger_name, passenger_doc_type, passenger_doc_number, seat_number, fare, total, payment_status) |
| `/auth` | Login / Registro | `customers` + `profiles` |
| `/mi-cuenta` | Dashboard: próximos viajes, tickets recientes | `customers` + `trip_tickets` |
| `/mi-cuenta/perfil` | Editar datos personales | `customers` |
| `/mi-cuenta/tickets` | Mis pasajes: lista con QR, estado, ruta | `trip_tickets` (ticket_number, status, qr_code, checkin_code, boarding_stop_id, alighting_stop_id) |
| `/mi-cuenta/tickets/[id]` | Detalle de ticket: QR code, datos del viaje, paradas, asiento | `trip_tickets` + `trips` + `transport_routes` + `transport_stops` |

### 9.2 Templates

#### `transport_corporate` ⭐ (Default)

| Propiedad | Valor |
|-----------|-------|
| **Estilo** | Profesional, confiable, corporativo |
| **Colores** | `#1565C0` (azul), `#263238` (gris oscuro) |
| **Fuentes** | Roboto / Roboto |
| **Header** | `default` con topbar (teléfono + email) |
| **Footer** | `three_columns` |

**Página Home:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `hero` | `split` |
| 2 | `transport_services` | `cards` |
| 3 | `routes` | `cards` |
| 4 | `stats` | `counters` |
| 5 | `fleet_showcase` | `grid` |
| 6 | `why_choose_us` | `icons` |
| 7 | `testimonials` | `carousel` |
| 8 | `partners` | `logos` |
| 9 | `cta` | `banner` |
| 10 | `contact_form` | `split` |

**Página Servicios:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `hero` | `minimal` |
| 2 | `transport_services` | `tabs` |
| 3 | `cta` | `centered` |

**Página Rutas:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `hero` | `minimal` |
| 2 | `routes` | `search` |
| 3 | `coverage_map` | `interactive` |

**Página Flota:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `hero` | `minimal` |
| 2 | `fleet_showcase` | `specs` |

---

#### `transport_dynamic`

| Propiedad | Valor |
|-----------|-------|
| **Estilo** | Moderno, tech-forward, animaciones |
| **Colores** | `#00BCD4` (cyan), `#1A237E` (azul profundo) |
| **Fuentes** | Poppins / Inter |
| **Header** | `default` |
| **Footer** | `minimal` |

#### `transport_classic`

| Propiedad | Valor |
|-----------|-------|
| **Estilo** | Tradicional, establecido, confiable |
| **Colores** | `#D32F2F` (rojo), `#1B5E20` (verde oscuro) |
| **Fuentes** | Merriweather / Open Sans |
| **Header** | `centered` |
| **Footer** | `default` |

#### `transport_eco`

| Propiedad | Valor |
|-----------|-------|
| **Estilo** | Ecológico, verde, sostenible |
| **Colores** | `#43A047` (verde), `#1B5E20` (verde oscuro) |
| **Fuentes** | Nunito / Nunito |
| **Header** | `default` |
| **Footer** | `three_columns` |

### 9.3 Análisis de Tablas del Módulo

#### Tablas Core — Infraestructura de Transporte (gestionadas desde ERP admin)

| Tabla | Columnas Clave | Propósito |
|-------|---------------|-----------|
| `transport_carriers` | id, organization_id, name, code, carrier_type (`own_fleet`/`third_party`), service_type (`cargo`/`passenger`/`both`), api_provider (coordinadora/envia/servientrega/tcc/interrapidisimo/deprisa/shippo), tracking_url_template, contact_* | Transportadoras propias o tercerizadas con integración de APIs de envío |
| `transport_routes` | id, organization_id, carrier_id, name, code, route_type (`passenger`/`cargo`/`mixed`), origin_stop_id, destination_stop_id, estimated_distance_km, estimated_duration_minutes, polyline_encoded, waypoints_json, base_fare, base_shipping_fee | Rutas con geometría para mapas y tarifas base |
| `transport_stops` | id, organization_id, name, code, stop_type, address, city, department, country_code, latitude, longitude, google_place_id, contact_*, operating_hours (jsonb), branch_id | Terminales/paradas con geolocalización |
| `route_stops` | id, route_id, stop_id, stop_order, estimated_arrival_minutes, estimated_departure_minutes, dwell_time_minutes, fare_from_origin, is_boarding_allowed, is_alighting_allowed | N:N ruta↔parada con orden, tiempos estimados y tarifa incremental |
| `route_schedules` | id, organization_id, route_id, schedule_name, recurrence_type, days_of_week[], specific_dates[], departure_time, arrival_time, default_vehicle_id, default_driver_id, available_seats, fare_override, valid_from, valid_until | Horarios recurrentes con asignación de vehículo/conductor por defecto |
| `vehicles` | id, organization_id, carrier_id, branch_id, plate, vehicle_type (`motorcycle`/`car`/`van`/`truck`/`bus`/`minibus`/`trailer`), capacity_kg, capacity_m3, passenger_capacity, brand, model, year, color, vin, soat_expiry, techno_expiry, insurance_expiry, operating_card_expiry, current_driver_id, status (`available`/`in_use`/`maintenance`/`inactive`) | Flota con documentos legales (SOAT, tecno, seguro, tarjeta de operación) |
| `vehicle_seats` | id, organization_id, vehicle_id, seat_label, seat_row, seat_column, seat_type (`passenger`/...), is_available, position_x, position_y, price_modifier | Mapa de asientos del vehículo con coordenadas para render visual |
| `driver_credentials` | id, employment_id, license_number, license_category, license_expiry, medical_certificate_expiry, hazmat_certified, passenger_certified, emergency_contact_*, blood_type | Credenciales del conductor vinculadas a HRM (employment_id) |
| `transport_fares` | id, organization_id, route_id, fare_name, fare_code, fare_type (`standard`/`student`/`senior`/`child`/`infant`/`military`/`disabled`/`promotional`/`corporate`/`round_trip`), from_stop_id, to_stop_id, amount, discount_percent, discount_amount, min_age, max_age, requires_id, requires_approval, valid_from, valid_until, applicable_days[], applicable_from_time, applicable_to_time | Tarifas dinámicas por ruta, tipo pasajero, tramo y horario |

#### Tablas de Operación — Viajes y Boletos

| Tabla | Columnas Clave | Propósito |
|-------|---------------|-----------|
| `trips` | id, organization_id, branch_id, schedule_id, route_id, trip_code, trip_date, scheduled_departure, scheduled_arrival, actual_departure, actual_arrival, vehicle_id, driver_id, co_driver_id, total_seats, available_seats, base_fare, status (`scheduled`→`boarding`→`in_transit`→`arrived`→`completed`/`cancelled`/`delayed`), delay_reason, delay_minutes | Instancia de viaje: un bus específico en una fecha/hora con ruta asignada |
| `trip_seats` | id, organization_id, trip_id, vehicle_seat_id, ticket_id, seat_label, status (`available`/...), reserved_until, reserved_by | Estado de cada asiento para un viaje: disponible, reservado temporalmente, vendido |
| `trip_tickets` | id, organization_id, trip_id, ticket_number, customer_id, passenger_name, passenger_doc_type, passenger_doc_number, passenger_phone, passenger_email, boarding_stop_id, alighting_stop_id, seat_number, fare, discount, total, currency, status (`reserved`→`confirmed`→`paid`→`boarded`→`completed`/`no_show`/`cancelled`/`refunded`), payment_status (`pending`/`paid`/`partial`/`refunded`/`cancelled`), boarded_at, alighted_at, sale_id, qr_code, checkin_code, cancelled_at, cancellation_reason, refund_amount | Pasaje/boleto: el "producto" que compra el pasajero online |

#### Tablas de Logística — Envíos y Entregas

| Tabla | Columnas Clave | Propósito |
|-------|---------------|-----------|
| `shipments` | id, organization_id, branch_id, source_type (`sale`/`invoice_sale`/`manual`/`return`/`transfer`), source_id, carrier_id, shipment_number, tracking_number, service_level (`economy`/`standard`/`express`/`same_day`/`next_day`), sender_* (name, phone, address, city, lat/lng), receiver_* (idem), total_weight_kg, total_volume_m3, total_packages, declared_value, shipping_fee, insurance_fee, cod_amount, total_cost, expected_pickup/delivery_date, picked_at, dispatched_at, delivered_at, status (`draft`→`ready`→`picked`→`dispatched`→`in_transit`→`out_for_delivery`→`delivered`/`failed`/`returned`/`cancelled`) | Envío/encomienda con datos de remitente, destinatario y tracking completo |
| `shipment_items` | id, shipment_id, description, quantity, weight_kg, length/width/height_cm, declared_value | Ítems individuales del envío con dimensiones |
| `dispatch_manifests` | id, organization_id, branch_id, manifest_number, manifest_date, manifest_type (`delivery`/`pickup`/`transfer`/`return`), carrier_id, vehicle_id, driver_id, route_id, planned_start/end, started_at, completed_at, total_shipments, total_weight_kg, total_packages, total_cod_amount, delivered/failed/pending_count, status (`draft`→`confirmed`→`in_progress`→`completed`/`cancelled`) | Manifiesto de despacho: agrupa envíos por vehículo/conductor/ruta |
| `manifest_shipments` | id, manifest_id, shipment_id, stop_sequence, eta, status, arrived_at, completed_at, failure_reason, distance_from_prev_km, duration_from_prev_minutes | Orden de entrega dentro del manifiesto |
| `delivery_attempts` | id, shipment_id, attempt_number, attempted_at, status, failure_reason_code/text, lat/lng, driver_id, driver_notes, reschedule_date, photo_urls[] | Intentos de entrega con geolocalización y evidencia |
| `proof_of_delivery` | id, shipment_id, delivery_attempt_id, receiver_name, receiver_doc, relationship, signature_url, photo_urls[], lat/lng, notes, confirmed_at | Prueba de entrega con firma digital y fotos |

#### Tablas Operativas — Eventos e Incidentes

| Tabla | Columnas Clave | Propósito |
|-------|---------------|-----------|
| `transport_events` | id, organization_id, reference_type, reference_id, event_type, event_time, stop_id, lat/lng, location_text, actor_type, actor_id, description, payload (jsonb), sequence, source (`internal`/...), correlation_id | Timeline de eventos polimórfica: aplica a trips, shipments, tickets |
| `transport_incidents` | id, organization_id, reference_type, reference_id, incident_type, severity (`low`/`medium`/`high`/`critical`), title, description, status (`open`→`acknowledged`→`resolved`→`closed`), assigned_to, reported_by, occurred_at, sla_hours, sla_breached, lat/lng, estimated/actual_cost, resolution_summary, root_cause, corrective_actions | Incidentes operativos con SLA y análisis de causa raíz |

### 9.4 ERP Admin — Módulos ya implementados (go-admin-erp)

El ERP admin ya tiene módulos completos bajo `/app/transporte/`:

```
transporte/
├── page.tsx              ← Dashboard: KPIs (viajes, envíos, boletos, incidentes) + filtros + eventos recientes
├── boletos/              ← CRUD trip_tickets: listado, detalle, estado
├── conductores/          ← Credenciales de conductores vinculados a HRM
├── direcciones-clientes/ ← Gestión de direcciones para envíos
├── envios/               ← CRUD shipments: lifecycle completo, tracking interno
│   └── [id]/             ← Detalle envío con timeline de eventos
├── etiquetas/            ← Generación de etiquetas de envío
├── horarios/             ← CRUD route_schedules: horarios recurrentes
├── incidentes/           ← CRUD transport_incidents: reporte, asignación, resolución
│   └── [id]/             ← Detalle incidente con SLA
├── manifiestos/          ← CRUD dispatch_manifests: agrupar envíos por ruta
│   └── [id]/             ← Detalle manifiesto con envíos asignados
├── paradas/              ← CRUD transport_stops: terminales y paradas
├── rutas/                ← CRUD transport_routes: rutas con paradas y geometría
│   └── [id]/             ← Detalle ruta con mapa y paradas
├── tarifas-envio/        ← Configuración de tarifas de envío
├── tarifas-pasajeros/    ← CRUD transport_fares: tarifas por tipo pasajero
├── tracking/             ← Panel de tracking en tiempo real
├── transportadoras/      ← CRUD transport_carriers: propias y tercerizadas
├── vehiculos/            ← CRUD vehicles: flota con documentos legales
└── viajes/               ← CRUD trips: programación y operación de viajes
    └── [id]/             ← Detalle viaje con asientos y boletos
```

**Módulos relacionados en ERP:**

```
hrm/
├── empleados/    ← Empleados (conductores son empleados con driver_credentials)
├── turnos/       ← Turnos de trabajo
├── asistencia/   ← Control de asistencia
└── nomina/       ← Nómina

crm/
├── clientes/     ← Base de clientes (compartida con transporte)
├── conversaciones/  ← Comunicación con clientes
└── campanas/     ← Marketing y notificaciones
```

### 9.5 Separación de Responsabilidades

| Responsabilidad | ERP Admin (go-admin-erp) | Website (goadmin-websites) |
|----------------|--------------------------|---------------------------|
| **Crear rutas, paradas, horarios** | ✅ CRUD completo | ❌ Solo lectura |
| **Gestionar vehículos y flota** | ✅ CRUD + documentos | ❌ Solo lectura (mostrar flota) |
| **Programar viajes (trips)** | ✅ Crear desde schedule o manual | ❌ Solo lectura + comprar asientos |
| **Configurar tarifas** | ✅ CRUD transport_fares | ❌ Solo lectura (calcular precio) |
| **Vender boletos (ventanilla)** | ✅ POS → sale_id en trip_tickets | ❌ |
| **Comprar boletos online** | ❌ | ✅ Flujo completo: buscar → seleccionar → pagar |
| **Check-in / boarding** | ✅ Escanear QR en terminal | ❌ (el pasajero muestra QR) |
| **Crear envíos** | ✅ CRUD + manifiestos | ⚠️ Cotización + crear envío online (futuro) |
| **Tracking envíos** | ✅ Panel interno completo | ✅ Tracking público por guía |
| **Gestionar incidentes** | ✅ CRUD + SLA | ❌ |
| **Reportes operativos** | ✅ Dashboard + exportación | ❌ |
| **Mi cuenta (pasajero)** | ❌ | ✅ Mis tickets, historial, perfil |

### 9.6 Flujos del Website

#### Flujo A — Compra de Pasajes Online (Prioridad Alta)

Modelo similar a **RedBus / BusBud / Pinbus**. Este es el flujo principal que genera ingresos desde el website.

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. BUSCAR VIAJE  →  /viajes                                     │
│    Widget de búsqueda:                                           │
│      - Origen (autocomplete desde transport_stops.city)          │
│      - Destino (autocomplete desde transport_stops.city)         │
│      - Fecha de viaje                                            │
│      - Cantidad de pasajeros                                     │
│    POST /api/transport/search                                    │
│    → Busca en trips: trip_date + ruta que conecte origen→destino │
│    → Filtra: status='scheduled', available_seats >= pasajeros    │
│    → Devuelve: viajes con horarios, precios, asientos libres     │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. RESULTADOS  →  /viajes?origen=X&destino=Y&fecha=Z            │
│    Lista de viajes disponibles:                                  │
│      - Hora salida → Hora llegada (duración)                     │
│      - Ruta: origen → paradas intermedias → destino              │
│      - Tipo de vehículo (bus, minibus, van)                      │
│      - Asientos disponibles / total                              │
│      - Precio desde $X (tarifa estándar)                         │
│      - Botón "Seleccionar"                                       │
│    Filtros: horario, precio, tipo vehículo, transportadora       │
│    Ordenar: precio, hora salida, duración                        │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. DETALLE + ASIENTOS  →  /viajes/[tripId]                      │
│    Info del viaje: ruta, horarios, paradas, vehículo             │
│    Mapa de ruta (polyline_encoded → Google Maps / Leaflet)       │
│    Selector de asientos interactivo:                             │
│      - Render visual del bus (vehicle_seats: position_x/y)       │
│      - Colores: verde=libre, rojo=vendido, amarillo=reservado    │
│      - Click para seleccionar (1 asiento por pasajero)           │
│      - Precio base + price_modifier del asiento                  │
│    Selector de tarifa: estándar, estudiante, adulto mayor, etc.  │
│    POST /api/transport/reserve-seat (reserva temporal 10 min)    │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. CHECKOUT  →  /viajes/checkout                                 │
│    Para cada pasajero:                                           │
│      - Nombre completo                                           │
│      - Tipo documento (CC, TI, CE, pasaporte)                    │
│      - Número documento                                          │
│      - Email, teléfono                                           │
│      - Parada de abordaje (boarding_stop_id)                     │
│      - Parada de descenso (alighting_stop_id)                    │
│    Resumen: asiento + tarifa + descuento + total                 │
│    POST /api/transport/tickets → crea trip_tickets               │
│    POST /api/checkout/init (source:'trip_ticket')                │
│    → Pasarela de pago (Wompi/Stripe/PayPal/MercadoPago/PayU)    │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. CONFIRMACIÓN  →  /ticket/[ticketNumber]                       │
│    Ticket digital con QR code                                    │
│    Datos: pasajero, ruta, fecha, hora, asiento, paradas          │
│    Email de confirmación con QR adjunto                          │
│    Opción: descargar PDF, agregar a calendario                   │
└─────────────────────────────────────────────────────────────────┘
```

**Ciclo de vida del ticket:**
```
reserved → confirmed → paid → boarded → completed
                                    ↓
              cancelled ← ← ← ← ← ┤ → no_show
                    ↓               
                 refunded           
```

#### Flujo B — Tracking de Envíos (Prioridad Media)

Permite a clientes rastrear sus envíos sin autenticarse.

```
┌─────────────────────────────────────────────────────────────────┐
│ TRACKING PÚBLICO  →  /tracking                                   │
│    Input: número de guía (shipment.tracking_number)              │
│    GET /api/transport/tracking?number=XXX                        │
│    Output:                                                       │
│      - Estado actual del envío                                   │
│      - Timeline de eventos (transport_events)                    │
│      - Fecha estimada de entrega                                 │
│      - Último punto conocido (lat/lng)                           │
│      - Datos del remitente/destinatario (parciales)              │
│      - Proof of delivery si entregado (firma + fotos)            │
└─────────────────────────────────────────────────────────────────┘
```

**Ciclo de vida del envío:**
```
draft → ready → picked → dispatched → in_transit → out_for_delivery → delivered
                                                          ↓
                                              failed → returned
                                                ↓
                                             cancelled
```

#### Flujo C — Cotización de Envíos (Prioridad Baja / Futuro)

```
┌─────────────────────────────────────────────────────────────────┐
│ COTIZAR ENVÍO  →  /envios/cotizar                                │
│    Input: origen, destino, peso, dimensiones, servicio           │
│    GET /api/transport/shipping-quote                              │
│    Output: precio por servicio (economy, standard, express)      │
│    → Si acepta: crear shipment + pago online                     │
└─────────────────────────────────────────────────────────────────┘
```

### 9.7 Arquitectura Backend — Queries directas vs API Routes

> **Principio**: Ambos proyectos (ERP admin y website) comparten la misma BD Supabase.
> No se necesitan APIs separadas para lecturas que se hacen desde Server Components (SSR).
> Solo se necesitan API routes para operaciones llamadas desde client components interactivos o transacciones.

#### Lecturas directas (funciones en `lib/supabase/queries.ts` → Server Components)

| Función | Uso en SSR | Tablas |
|---------|-----------|--------|
| `getTransportStops(orgId)` | `/viajes` page (autocomplete ciudades) | `transport_stops` |
| `searchTrips(orgId, origin, dest, date, passengers)` | `/viajes` page (resultados) | `transport_stops` → `route_stops` → `trips` + `transport_routes` + `vehicles` |
| `getTripById(tripId, orgId)` | `/viajes/[id]` page (detalle) | `trips` + `transport_routes` + `vehicles` + `trip_seats` + `vehicle_seats` + `route_stops` + `transport_stops` + `transport_fares` |
| `getShipmentByTracking(number)` | `/tracking` page | `shipments` + `transport_events` + `proof_of_delivery` |
| `getTransportRoutes(orgId)` | `/rutas` page (listado) | `transport_routes` + `transport_stops` (origin/destination) |

#### API Routes (llamadas desde client components interactivos)

| API Route | Archivo | Propósito |
|-----------|---------|-----------|
| `POST /api/transport/fares` | `app/api/transport/fares/route.ts` | Cálculo de tarifa dinámica: base_fare + price_modifier del asiento + descuento por tipo (student/senior/etc) + impuestos org. Llamado desde SeatMap al cambiar selección |
| `POST /api/transport/reserve-seat` | `app/api/transport/reserve-seat/route.ts` | Reserva temporal 10 min: verifica disponibilidad → actualiza trip_seats.status='reserved' + reserved_until → decrementa trips.available_seats. Con rollback si falla |
| `POST /api/transport/tickets` | `app/api/transport/tickets/route.ts` | Crear boletos: valida asientos → genera ticket_number (TKT-{tripCode}-{hex}) + QR code + checkin_code → inserta trip_tickets → marca trip_seats como 'sold' |

#### Adaptaciones pendientes (reutilizar infraestructura existente)

| Componente | Cambio necesario |
|-----------|-----------------|
| `POST /api/checkout/init` | Agregar `source: 'trip_ticket'` + `sourceId` (misma lógica que reservation/web_order) |
| Webhooks (5 existentes) | Detectar referencia `TKT-*` → confirmar ticket (status→confirmed, payment_status→paid) |
| `lib/transport/payment-handler.ts` | Nuevo handler: confirmar ticket + enviar email con QR + liberar asientos si falla pago |

#### RLS aplicado (migración `add_public_read_policies_transport_tables`)

Tablas con SELECT público: `trips`, `trip_seats`, `trip_tickets`, `transport_routes`, `transport_stops`, `route_stops`, `route_schedules`, `vehicles`, `vehicle_seats`, `transport_fares`, `transport_carriers`, `shipments`, `delivery_attempts`, `proof_of_delivery`.
Además: `trip_tickets` INSERT público, `trip_seats` UPDATE público.

### 9.8 Análisis Crítico — Problemas y Gaps

#### 🔴 Problemas Graves

1. ~~**No existe NINGÚN endpoint API** para el website de transporte~~ → ✅ Resuelto: 3 API routes + 5 funciones en queries.ts
2. ~~**No hay flujo de pago online** para boletos~~ → ✅ Resuelto: checkout/init soporta source:'trip_ticket', 5 webhooks detectan TKT-*, payment-handler confirma/libera + email
3. **No hay componentes frontend** para transporte en goadmin-websites (0 implementado)
4. **trip_tickets no tiene campo `web_order_id`** ni referencia directa a `payments` — el pago se vincula via `sale_id` que es del POS

#### 🟡 Gaps Importantes

5. ~~**Reserva temporal de asientos**~~ → ✅ API `/api/transport/reserve-seat` implementada (10 min timeout + rollback). Falta: cron/función para expirar reservas abandonadas
6. ~~**QR code**~~ → ✅ API `/api/transport/tickets` genera `qr_code` y `checkin_code` automáticamente con crypto.randomBytes
7. **Búsqueda por ciudad** — transport_stops tiene `city` pero no hay índice de texto para autocomplete
8. ~~**Notificaciones**~~ → ✅ Parcial: `send-ticket-confirmation.ts` envía email con datos viaje + check-in code al confirmar pago. Pendiente: email cambio estado envío
9. ~~**Integración con pasarelas**~~ → ✅ Resuelto: payment-handler inserta en `payments` con source='trip_ticket', source_id=ticket.id

#### 🟢 Oportunidades

10. **Mapa de asientos** — vehicle_seats tiene position_x/y perfecto para render SVG/Canvas interactivo
11. **Tarifas muy flexibles** — transport_fares soporta por horario, día, tramo, tipo pasajero
12. **Polyline en rutas** — Permite render de ruta en Google Maps/Leaflet directamente
13. **COD (contra-entrega)** — shipments soporta cod_amount para pagos en destino

### 9.9 Plan de Implementación

#### Fase A — Backend: APIs de búsqueda + disponibilidad ✅ COMPLETADA

| # | Tarea | Estado | Archivo(s) |
|---|-------|--------|------------|
| A1 | **Paradas** (query SSR) | ✅ | `getTransportStops()` en `lib/supabase/queries.ts` |
| A2 | **Buscar viajes** (query SSR) | ✅ | `searchTrips()` en `lib/supabase/queries.ts` |
| A3 | **Detalle viaje + asientos** (query SSR) | ✅ | `getTripById()` en `lib/supabase/queries.ts` |
| A4 | **Calcular tarifa** (API route) | ✅ | `app/api/transport/fares/route.ts` |
| A5 | **Reserva temporal asiento** (API route) | ✅ | `app/api/transport/reserve-seat/route.ts` |

#### Fase B — Backend: Compra + Pago + Tracking ✅ COMPLETADA

| # | Tarea | Estado | Archivo(s) |
|---|-------|--------|------------|
| B1 | **API `/api/transport/tickets`** | ✅ | `app/api/transport/tickets/route.ts` |
| B2 | **Adaptar `/api/checkout/init`** — source:'trip_ticket' | ✅ | `app/api/checkout/init/route.ts` (función `getTripTicket`) |
| B3 | **`lib/transport/payment-handler.ts`** — confirmar, liberar, email | ✅ | `lib/transport/payment-handler.ts` |
| B4 | **Adaptar 5 webhooks** — detectar TKT-* | ✅ | wompi_co, stripe, mercadopago, payu, paypal |
| B5 | **Tracking envíos** (query SSR) | ✅ | `getShipmentByTracking()` en `lib/supabase/queries.ts` |
| B6 | **Email confirmación** con datos viaje + check-in | ✅ | `lib/email/send-ticket-confirmation.ts` |

#### Fase C — Frontend: Búsqueda + Selección + Checkout

| # | Tarea | Prioridad |
|---|-------|-----------|
| C1 | **`/viajes` page**: SSR con widget de búsqueda (origen/destino autocomplete, fecha, pasajeros) + resultados |
| C2 | **`/viajes/[id]` page**: Detalle viaje + mapa de ruta + selector de asientos interactivo (SVG) |
| C3 | **`SeatMap` componente**: Render visual del bus desde vehicle_seats (position_x/y), estados por colores, click para seleccionar |
| C4 | **`TripSearchWidget` componente**: Buscador reutilizable para home y /viajes |
| C5 | **Checkout de tickets**: Formulario datos pasajero + resumen + pago (reutilizar pasarelas existentes) |
| C6 | **`/ticket/[number]` page**: Ticket digital con QR, datos del viaje, opción descargar PDF |
| C7 | **`/tracking` page**: Input guía + timeline visual del envío |
| C8 | **`/mi-cuenta/tickets`**: Lista de tickets del usuario con estado, QR, link a detalle |

### 9.10 Relación entre Tablas (ER Simplificado)

```
transport_carriers (org)
    │
    ├── vehicles (plate, type, capacity, docs legales)
    │       │
    │       └── vehicle_seats (mapa de asientos: row, col, position_x/y)
    │
    └── transport_routes (origin→destination, polyline, base_fare)
            │
            ├── route_stops (N:N → transport_stops, stop_order, fare)
            │       │
            │       └── transport_stops (city, lat/lng, google_place_id)
            │
            ├── route_schedules (horarios recurrentes, default vehicle/driver)
            │
            └── transport_fares (por tipo pasajero, tramo, horario)

trips (route + fecha + vehicle + driver → instancia de viaje)
    │
    ├── trip_seats (vehicle_seat + status: available/reserved/sold)
    │
    └── trip_tickets (pasajero + asiento + boarding/alighting stops + fare + QR)
            │
            └── payments (source='trip_ticket', source_id=ticket.id)

shipments (envío: sender→receiver, weight, tracking, status lifecycle)
    │
    ├── shipment_items (descripción, peso, dimensiones)
    ├── delivery_attempts (intentos con geolocalización)
    ├── proof_of_delivery (firma + fotos)
    └── manifest_shipments → dispatch_manifests (agrupación por ruta/vehículo)

transport_events (timeline polimórfica: trips, shipments, tickets)
transport_incidents (incidentes con SLA y resolución)
```

### 9.11 Diferencias clave vs otros módulos

| Aspecto | Retail | Hotel | Transport (Pasajeros) | Transport (Logística) |
|---------|--------|-------|----------------------|----------------------|
| **Producto** | `products` | `space_types` + `rates` | `trips` + `transport_fares` | `shipments` |
| **Inventario** | `stock_levels` (qty) | `spaces` (instancias) | `trip_seats` (asientos) | N/A |
| **Orden** | `web_orders` | `reservations` + `folios` | `trip_tickets` | `shipments` |
| **Pago** | `payments` (source: web_order) | `payments` (source: reservation) | `payments` (source: trip_ticket) | `payments` (source: shipment) |
| **Estado** | pending→confirmed→shipped→delivered | tentative→confirmed→checked_in→checked_out | reserved→confirmed→paid→boarded→completed | draft→dispatched→in_transit→delivered |
| **Selección** | Agregar al carrito | Elegir fechas + espacio | Elegir viaje + asiento | Elegir origen/destino + servicio |
| **Tracking** | `/pedido/[orderNumber]` | `/reserva/[id]` | `/ticket/[number]` (QR) | `/tracking?number=XXX` |
| **Email** | `send-order-confirmation` | `send-reservation-confirmation` | `send-ticket-confirmation` (por crear) | `send-shipment-notification` (por crear) |
| **Impuesto** | `organization_taxes` | `organization_taxes` | `organization_taxes` | Incluido en shipping_fee |
| **Temporal** | No | Reserva temporal (folio) | Asiento reservado 10 min | N/A |
| **Mapa/Visual** | ProductImageGallery | AvailabilityCalendar | SeatMap (bus) + RouteMap | TrackingTimeline |

---

## 10. Parking — Parqueadero / Estacionamiento

### 10.1 Páginas del Builder (personalizables por secciones)

| # | Slug | Título Default | En Header | En Footer | Tipo |
|---|------|---------------|-----------|-----------|------|
| 1 | `home` | Inicio | ✅ | ❌ | builtin |
| 2 | `zonas` | Zonas | ✅ | ✅ | builtin |
| 3 | `tarifas` | Tarifas | ✅ | ✅ | builtin |
| 4 | `servicios` | Servicios | ✅ | ✅ | builtin |
| 5 | `nosotros` | Nosotros | ❌ | ✅ | builtin |
| 6 | `contacto` | Contacto | ✅ | ✅ | builtin |

### Páginas de Sistema (lógica fija)

| Ruta | Descripción | Tablas |
|------|-------------|--------|
| `/reservas` | Reservar espacio: zona, tipo vehículo, fecha/hora entrada y salida | `parking_spaces` (label, zone, type, state, zone_id) + `parking_zones` (name, capacity, is_covered, is_vip) + `parking_rates` (vehicle_type, unit, price, grace_period_min) |
| `/checkout` | Compra de pase/abono mensual | `parking_pass_types` (name, duration_days, price, max_entries_per_day, includes_car_wash, includes_valet, allowed_vehicle_types) → crea `parking_passes` |
| `/auth` | Login / Registro | `customers` + `profiles` |
| `/mi-cuenta` | Dashboard: pases activos, vehículos, últimas sesiones | `customers` |
| `/mi-cuenta/perfil` | Editar datos personales | `customers` |
| `/mi-cuenta/pases` | Mis pases/abonos: vigencia, beneficios, estado | `parking_passes` (plan_name, start_date, end_date, status, price) + `parking_pass_types` |
| `/mi-cuenta/vehiculos` | Gestión de vehículos registrados | `parking_pass_vehicles` + `parking_vehicles` |
| `/mi-cuenta/historial` | Historial de sesiones: entrada, salida, duración, monto | `parking_sessions` (vehicle_plate, vehicle_type, entry_at, exit_at, duration_min, amount, status) |

### 10.2 Templates

#### `parking_modern` ⭐ (Default)

| Propiedad | Valor |
|-----------|-------|
| **Estilo** | Limpio, funcional, orientado a conversión |
| **Colores** | `#2196F3` (azul), `#37474F` (gris azulado) |
| **Fuentes** | Inter / Inter |
| **Header** | `default` — CTA "Reservar Espacio" |
| **Footer** | `default` |

**Página Home:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `hero` | `split` |
| 2 | `parking_zones` | `grid` |
| 3 | `parking_pricing` | `cards` |
| 4 | `parking_features` | `icons` |
| 5 | `stats` | `counters` |
| 6 | `testimonials` | `carousel` |
| 7 | `faq` | `accordion` |
| 8 | `map` | `full_width` |

**Página Zonas:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `hero` | `minimal` |
| 2 | `parking_zones` | `map` |
| 3 | `parking_availability` | `realtime` |

**Página Tarifas:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `hero` | `minimal` |
| 2 | `parking_pricing` | `comparison` |
| 3 | `faq` | `accordion` |
| 4 | `cta` | `centered` |

**Página Servicios:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `hero` | `minimal` |
| 2 | `parking_features` | `cards` |
| 3 | `services_list` | `grid` |

---

#### `parking_tech`

| Propiedad | Valor |
|-----------|-------|
| **Estilo** | Smart parking, futurista, high-tech |
| **Colores** | `#00E676` (verde neón), `#121212` (casi negro) |
| **Fuentes** | Space Grotesk / Inter |
| **Header** | `default` |
| **Footer** | `minimal` |

#### `parking_urban`

| Propiedad | Valor |
|-----------|-------|
| **Estilo** | Urbano, integrado a la ciudad |
| **Colores** | `#FF9800` (naranja), `#424242` (gris oscuro) |
| **Fuentes** | Poppins / Roboto |
| **Header** | `default` |
| **Footer** | `default` |

#### `parking_premium`

| Propiedad | Valor |
|-----------|-------|
| **Estilo** | VIP, exclusivo, servicios premium |
| **Colores** | `#9C7C38` (gold), `#1A1A1A` (negro) |
| **Fuentes** | Playfair Display / Lato |
| **Header** | `transparent` |
| **Footer** | `centered` |

---

## 11. SaaS — Software como Servicio

### 11.1 Páginas del Builder (personalizables por secciones)

| # | Slug | Título Default | En Header | En Footer | Tipo |
|---|------|---------------|-----------|-----------|------|
| 1 | `home` | Inicio | ✅ | ❌ | builtin |
| 2 | `features` | Características | ✅ | ✅ | builtin |
| 3 | `precios` | Precios | ✅ | ✅ | builtin |
| 4 | `integraciones` | Integraciones | ✅ | ✅ | builtin |
| 5 | `nosotros` | Nosotros | ✅ | ✅ | builtin |
| 6 | `contacto` | Contacto | ✅ | ✅ | builtin |
| 7 | `blog` | Blog | ❌ | ✅ | builtin |
| 8 | `casos-de-exito` | Casos de Éxito | ❌ | ✅ | builtin |

### Páginas de Sistema (lógica fija)

| Ruta | Descripción | Tablas |
|------|-------------|--------|
| `/auth` | Registro / Login + Solicitar demo (lead) | `customers` + `profiles` + `leads` (source='website', si pide demo) |
| `/checkout` | Suscripción a plan: selección → datos empresa → pago (Stripe/pasarela) | Flujo externo de pago |
| `/mi-cuenta` | Dashboard del suscriptor: plan activo, uso, facturación | `customers` + datos de suscripción |
| `/mi-cuenta/perfil` | Editar datos personales y de empresa | `customers` |

### 11.2 Templates

#### `saas_modern` ⭐ (Default)

| Propiedad | Valor |
|-----------|-------|
| **Estilo** | Clean tech startup, gradientes suaves, ilustraciones |
| **Colores** | `#6366F1` (indigo), `#0F172A` (slate) |
| **Fuentes** | Inter / Inter |
| **Header** | `default` — CTA "Empezar Gratis" |
| **Footer** | `three_columns` con links organizados |

**Página Home:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `hero` | `split` |
| 2 | `partners` | `logos` |
| 3 | `features_grid` | `alternating` |
| 4 | `stats` | `counters` |
| 5 | `how_it_works` | `steps` |
| 6 | `pricing_table` | `three_columns` |
| 7 | `testimonials` | `carousel` |
| 8 | `integrations` | `logos` |
| 9 | `faq` | `accordion` |
| 10 | `demo_cta` | `form` |

**Página Features:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `hero` | `minimal` |
| 2 | `features_grid` | `tabs` |
| 3 | `image_text` | `image_right` |
| 4 | `image_text` | `image_left` |
| 5 | `cta` | `centered` |

**Página Precios:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `hero` | `minimal` |
| 2 | `pricing_table` | `toggle` |
| 3 | `faq` | `two_columns` |
| 4 | `cta` | `banner` |

**Página Integraciones:**

| Orden | Sección | Variante |
|-------|---------|----------|
| 1 | `hero` | `minimal` |
| 2 | `integrations` | `categories` |
| 3 | `cta` | `centered` |

---

#### `saas_corporate`

| Propiedad | Valor |
|-----------|-------|
| **Estilo** | Enterprise, profesional, confiable |
| **Colores** | `#1976D2` (azul corp), `#1A237E` (azul oscuro) |
| **Fuentes** | Roboto / Roboto |
| **Header** | `default` con topbar |
| **Footer** | `three_columns` |

#### `saas_creative`

| Propiedad | Valor |
|-----------|-------|
| **Estilo** | Creativo, playful, gradientes coloridos |
| **Colores** | `#FF6B6B` (coral), `#4ECDC4` (teal) |
| **Fuentes** | Poppins / Nunito |
| **Header** | `default` |
| **Footer** | `minimal` |

#### `saas_minimal`

| Propiedad | Valor |
|-----------|-------|
| **Estilo** | Ultra minimalista, mucho espacio, elegante |
| **Colores** | `#000000` (negro), `#FFFFFF` (blanco) |
| **Fuentes** | Outfit / Inter |
| **Header** | `minimal` |
| **Footer** | `centered` |

---

## 12. Flujo Frontend

### 12.1 Enrutamiento

```
app/
├── [[...slug]]/page.tsx           ← Catch-all: Home (sin slug) + todas las páginas del builder
│
├── productos/[id]/page.tsx        ← Detalle de producto (retail, restaurant)
├── categorias/[id]/page.tsx       ← Productos por categoría (retail, restaurant)
├── espacios/[id]/page.tsx         ← Detalle de habitación/espacio (hotel)
├── clases/[id]/page.tsx           ← Detalle de clase (gym)
├── viajes/page.tsx                ← Buscador de viajes (transport)
├── viajes/[id]/page.tsx           ← Detalle de viaje + selección asiento (transport)
│
├── carrito/page.tsx               ← Vista completa del carrito (retail, restaurant)
├── checkout/page.tsx              ← Flujo de pago multi-step
├── checkout/confirmacion/[id]/page.tsx ← Confirmación post-compra
│
├── reservas/page.tsx              ← Flujo de reserva (hotel, restaurant, parking)
│
├── auth/page.tsx                  ← Login / Registro
├── mi-cuenta/
│   ├── page.tsx                   ← Dashboard del cliente (varía según tipo negocio)
│   ├── perfil/page.tsx            ← Editar datos personales
│   ├── pedidos/page.tsx           ← Historial de pedidos (retail, restaurant)
│   ├── pedidos/[id]/page.tsx      ← Detalle de pedido
│   ├── direcciones/page.tsx       ← CRUD de direcciones (retail, restaurant)
│   ├── cupones/page.tsx           ← Cupones disponibles/usados
│   ├── reservas/page.tsx          ← Historial de reservas (hotel, restaurant)
│   ├── membresia/page.tsx         ← Estado de membresía (gym)
│   ├── clases/page.tsx            ← Clases reservadas (gym)
│   ├── checkins/page.tsx          ← Historial de accesos (gym)
│   ├── tickets/page.tsx           ← Mis pasajes (transport)
│   ├── tickets/[id]/page.tsx      ← Detalle de ticket + QR (transport)
│   ├── pases/page.tsx             ← Pases/abonos (parking)
│   ├── vehiculos/page.tsx         ← Mis vehículos (parking)
│   └── historial/page.tsx         ← Historial sesiones (parking)
│
└── api/                           ← API routes (sin cambios)
```

> **Nota**: Las rutas de `/mi-cuenta/*` se renderizan condicionalmente según el tipo de negocio. Si la organización es `retail`, solo muestra pedidos/direcciones/cupones. Si es `gym`, muestra membresía/clases/checkins, etc. El componente `MiCuentaLayout` usa el `type_id` de la organización para determinar qué sub-navegación mostrar.

### 12.2 Flujo de Renderizado de una Página

```
1. Request llega → Middleware detecta organización
2. [[...slug]]/page.tsx:
   a. Lee headers del middleware → obtiene organización
   b. Determina slug: vacío → 'home', con valor → slug
   c. Query a DB:
      SELECT p.*, 
             json_agg(s.* ORDER BY s.sort_order) as sections
      FROM website_pages p
      LEFT JOIN website_page_sections s ON s.page_id = p.id AND s.is_visible = true
      WHERE p.organization_id = X AND p.slug = Y AND p.is_published = true
      GROUP BY p.id
   d. Si la página tiene secciones data-driven, pre-fetch datos:
      - products_grid → fetch products
      - room_types → fetch space_types
      - categories_grid → fetch categories
      - etc.
   e. Renderiza: SiteHeader → SectionRenderer[] → SiteFooter
3. SiteHeader lee nav de:
   SELECT slug, title, icon FROM website_pages
   WHERE organization_id = X AND show_in_header = true AND is_published = true
   ORDER BY header_order
4. SiteFooter lee nav de:
   SELECT slug, title FROM website_pages
   WHERE organization_id = X AND show_in_footer = true AND is_published = true
   ORDER BY footer_order
   + footer_links de website_settings (links externos)
```

### 12.3 SectionRenderer

```tsx
// Componente que mapea section_type + variant → React Component
const SECTION_MAP = {
  hero: {
    fullscreen: HeroFullscreen,
    split: HeroSplit,
    minimal: HeroMinimal,
    video: HeroVideo,
    slider: HeroSlider,
  },
  products_grid: {
    grid: ProductsGrid,
    carousel: ProductsCarousel,
    list: ProductsList,
    featured: ProductsFeatured,
  },
  // ... todos los demás
}

function SectionRenderer({ section, organization, data, primaryColor }) {
  const Component = SECTION_MAP[section.section_type]?.[section.section_variant]
  if (!Component) return null
  
  return (
    <SectionWrapper settings={section.settings} primaryColor={primaryColor}>
      <Component 
        content={section.content}
        organization={organization}
        data={data}
        primaryColor={primaryColor}
      />
    </SectionWrapper>
  )
}
```

### 12.4 Flujo de Aplicación de Template

Cuando una organización selecciona un template desde el admin:

```
1. Admin selecciona "hotel_luxury"
2. Backend:
   a. Actualiza website_settings (colores, fuentes, header_style, footer_style)
   b. Crea/actualiza rows en website_pages (las 6 páginas del hotel)
   c. Crea/actualiza rows en website_page_sections (secciones de cada página)
3. A partir de ahí, el usuario personaliza libremente desde el admin.
```

---

## 13. Resumen de Tablas y Volumen

### Tablas

| Tabla | Acción | Rows estimadas por org |
|-------|--------|----------------------|
| `website_settings` | MODIFICAR (agregar ~8 columnas, deprecar ~16) | 1 |
| `website_pages` | CREAR | 5-7 |
| `website_page_sections` | CREAR | 30-50 |

### Lo que NO se crea

| Cosa | Razón |
|------|-------|
| `website_templates` | El catálogo de templates vive en código (TypeScript), no en DB |
| `website_section_types` | El catálogo de tipos de sección vive en código |
| `website_testimonials` | Vive como `content` jsonb en la sección de testimonios |
| `website_gallery` | Vive como `content` jsonb en la sección de galería |
| `website_faq` | Vive como `content` jsonb en la sección de FAQ |

### Lo que NO se duplica

| Dato | Tabla(s) original(es) | Cómo se usa en secciones |
|------|----------------------|-------------------------|
| Productos | `products` + `product_prices` + `product_images` + `product_tags` | Sección `products_grid` / `featured_products` solo guarda config (max_items, layout). El componente consulta la tabla original. |
| Categorías | `categories` | Sección `categories_grid` solo guarda config. |
| Habitaciones | `space_types` + `spaces` + `space_images` + `space_services` | Sección `room_types` solo guarda config de visualización. |
| Membresías | `membership_plans` | Sección `membership_plans` solo guarda config de layout. |
| Clases | `gym_classes` + `class_reservations` | Sección `class_schedule` solo guarda config de vista (calendar/list/grid). |
| Zonas parking | `parking_zones` + `parking_spaces` | Sección `parking_zones` solo guarda config. |
| Tarifas parking | `parking_rates` + `parking_pass_types` | Sección `parking_pricing` / `parking_pass_plans` solo guarda config. |
| Rutas transporte | `transport_routes` + `transport_stops` + `transport_fares` | Sección `routes` / `trip_search` solo guarda config. |
| Vehículos | `vehicles` + `vehicle_seats` | Sección `fleet_showcase` solo guarda config. |
| Servicios | `organization_services` + `services` | Sección `services_list` / `amenities` solo guarda config. |
| Cupones/Promos | `coupons` + `promotions` | Sección `offers` puede leer promos activas. |
| Pedidos web | `web_orders` + `web_order_items` | Páginas de sistema (`/mi-cuenta/pedidos`), no en secciones. |
| Carrito | `carts` (cart_data jsonb) | Página de sistema (`/carrito`), no en secciones. |
| Tickets | `trip_tickets` + `trips` + `trip_seats` | Páginas de sistema (`/mi-cuenta/tickets`), no en secciones. |
| Pases parking | `parking_passes` + `parking_sessions` | Páginas de sistema (`/mi-cuenta/pases`), no en secciones. |
| Clientes | `customers` + `customer_addresses` + `profiles` | Páginas de sistema (`/mi-cuenta/*`), no en secciones. |
| Reservas | `reservations` + `reservation_spaces` + `reservation_customers` | Páginas de sistema (`/reservas`, `/mi-cuenta/reservas`), no en secciones. |
| Mesas restaurant | `restaurant_tables` + `table_sessions` | Página de sistema (`/reservas` para restaurant), no en secciones. |
| Info de contacto | `organizations` (phone, email, address) | Sección `contact_form` usa datos de la organización. |
| Horarios | `website_settings.business_hours` | Footer y sección `contact_info` leen de ahí. |
| Redes sociales | `website_settings.social_links` | Footer lee de ahí. |

---

### Conteo Final de Componentes React a Crear

#### A. Secciones del Page Builder

| Categoría | Cantidad |
|-----------|----------|
| Secciones universales (18 tipos × ~3-4 variantes) | ~65 componentes |
| Secciones restaurant (5 tipos × ~3 variantes) | ~15 componentes |
| Secciones hotel (4 tipos × ~3 variantes) | ~12 componentes |
| Secciones retail (4 tipos × ~3 variantes) | ~12 componentes |
| Secciones gym (5 tipos × ~3 variantes) | ~15 componentes |
| Secciones transport (6 tipos × ~3 variantes) | ~18 componentes |
| Secciones parking (5 tipos × ~3 variantes) | ~15 componentes |
| Secciones saas (5 tipos × ~3 variantes) | ~15 componentes |
| SectionRenderer + SectionWrapper | 2 componentes |
| Header variantes (4) + Footer variantes (4) | 8 componentes |
| **Subtotal Builder** | **~177 componentes** |

#### B. Páginas de Sistema (lógica fija)

| Categoría | Páginas |
|-----------|---------|
| Compartidas: `/auth`, `/mi-cuenta`, `/mi-cuenta/perfil` | 3 |
| Detalle: `/productos/[id]`, `/categorias/[id]`, `/espacios/[id]`, `/clases/[id]` | 4 |
| Transaccional: `/carrito`, `/checkout`, `/checkout/confirmacion/[id]` | 3 |
| Reservas: `/reservas`, `/viajes`, `/viajes/[id]` | 3 |
| Portal Retail/Restaurant: pedidos, pedidos/[id], direcciones, cupones | 4 |
| Portal Hotel: reservas | 1 |
| Portal Gym: membresía, clases, checkins | 3 |
| Portal Transport: tickets, tickets/[id] | 2 |
| Portal Parking: pases, vehiculos, historial | 3 |
| Portal SaaS: dashboard suscriptor | 1 |
| **Subtotal Sistema** | **~27 páginas** |

#### C. Total

| Categoría | Cantidad |
|-----------|----------|
| Componentes de secciones (Builder) | ~177 |
| Páginas de sistema | ~27 |
| **TOTAL GENERAL** | **~204 componentes** |

> **Fases de implementación sugeridas:**
> 1. **Fase 1 — Core**: Tablas SQL + SectionRenderer + variantes `default` de secciones universales (~20 componentes) + páginas de sistema compartidas (auth, checkout, mi-cuenta) (~6 páginas)
> 2. **Fase 2 — Por tipo**: Secciones específicas por tipo + páginas de sistema por tipo (elegir 2-3 tipos prioritarios)
> 3. **Fase 3 — Variantes**: Variantes alternativas de secciones + templates alternativos
> 4. **Fase 4 — Polish**: Portal completo del cliente, cupones, historial, etc.

---

## 14. Pagos Online — Integración Wompi Colombia

### 14.1 Visión General

El sistema de pagos online permite a las organizaciones recibir pagos desde sus sitios web (`{subdominio}.goadmin.io` o dominio personalizado) a través de **Wompi Colombia**. La configuración de Wompi se realiza desde el panel administrativo (`app.goadmin.io`), pero el **webhook de notificación** lo recibe el sitio web del cliente.

```
┌─────────────┐     ┌──────────────┐     ┌────────────────────┐
│  Cliente     │────▶│  Checkout    │────▶│  Wompi Widget/API  │
│  (Browser)   │     │  /checkout   │     │  (Pago)            │
└─────────────┘     └──────────────┘     └────────┬───────────┘
                                                   │
                                                   ▼
┌─────────────────────────────────────────────────────────────┐
│  Wompi envía webhook POST a:                                │
│  https://{host}/api/webhooks/wompi_co                       │
│                                                             │
│  Prioridad del host:                                        │
│  1. custom_domain verificado (ej: www.mihotel.com)          │
│  2. system_subdomain (ej: hotelx.goadmin.io)               │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  /api/webhooks/wompi_co/route.ts                            │
│  1. Parsea el evento (transaction.updated)                  │
│  2. Busca web_order por order_number (= reference)          │
│  3. Valida firma SHA256 con events_secret                   │
│  4. Actualiza web_order (payment_status, status)            │
│  5. Crea registro en payments                               │
│  6. Registra en integration_events                          │
└─────────────────────────────────────────────────────────────┘
```

### 14.2 Tablas Involucradas

#### Tablas de integración (ya existentes, configuradas desde admin)

| Tabla | Rol en el flujo |
|-------|----------------|
| `integration_providers` | Catálogo: Wompi (code: `wompi`, category: `payments`) |
| `integration_connectors` | Conector: `wompi_co` (id: `39950173-...`, país: CO) |
| `integration_connections` | Conexión activa de una org a Wompi (environment, status, settings) |
| `integration_credentials` | Llaves de la org: `public_key`, `events_secret` (secret_ref → Vault) |
| `integration_webhooks` | Config del webhook: URL, events, signing_method, secret_ref |
| `integration_events` | Log de cada evento recibido (payload, status, error) |

#### Tablas de pedidos y pagos

| Tabla | Rol en el flujo |
|-------|----------------|
| `web_orders` | Pedido creado desde el sitio web. Campos clave: `order_number` (referencia Wompi), `payment_status`, `payment_method`, `payment_reference` |
| `web_order_items` | Items del pedido: `product_id`, `product_name`, `quantity`, `unit_price`, `total` |
| `payments` | Registro del pago: `source=web_order`, `source_id`, `method`, `amount`, `processor_response` (JSON completo de Wompi) |

#### Tabla de dominios

| Tabla | Rol en el flujo |
|-------|----------------|
| `organization_domains` | Determina la URL del webhook. Prioridad: `custom_domain` verificado > `system_subdomain` |

### 14.3 Flujo Detallado

#### A. Creación del pedido (`POST /api/orders`)

```
1. Cliente completa checkout → POST /api/orders
2. API genera order_number único: WO-{orgId}-{timestamp}-{random}
3. Inserta en web_orders (status=pending, payment_status=pending)
4. Inserta en web_order_items
5. Retorna { orderId, orderNumber } al frontend
6. Frontend usa orderNumber como "reference" al iniciar pago en Wompi
```

#### B. Recepción del webhook (`POST /api/webhooks/wompi_co`)

```
1. Wompi envía POST con evento transaction.updated
2. Payload contiene: transaction.reference = order_number
3. API busca web_order por order_number → obtiene organization_id
4. Busca integration_connection de esa org para wompi_co
5. Obtiene events_secret de integration_credentials (o Vault)
6. Valida firma: SHA256(concat(property_values) + timestamp + events_secret)
7. Si firma válida:
   a. Actualiza web_order.payment_status (paid/failed/refunded)
   b. Si APPROVED: web_order.status = confirmed
   c. Si DECLINED/ERROR: web_order.status = cancelled
   d. Inserta en payments (source=web_order, processor_response=transaction)
   e. Inserta en integration_events (status=processed)
8. Si firma inválida: rechaza con 401, registra en integration_events (status=rejected)
```

#### C. Construcción de la URL del webhook

La URL del webhook se construye desde el admin al configurar la integración:

```
1. Buscar dominio primario activo en organization_domains
2. Prioridad: custom_domain verified > system_subdomain
3. URL: https://{host}/api/webhooks/wompi_co
```

| Escenario | Host | Webhook URL |
|-----------|------|-------------|
| Solo subdominio | `hotelx.goadmin.io` | `https://hotelx.goadmin.io/api/webhooks/wompi_co` |
| Dominio propio | `www.hotelx.com` | `https://www.hotelx.com/api/webhooks/wompi_co` |

> **Importante:** El webhook va al sitio web del cliente (`goadmin-websites`), NO al admin (`app.goadmin.io`).

### 14.4 Mapeo de Estados

| Wompi Status | `web_orders.payment_status` | `web_orders.status` |
|-------------|----------------------------|---------------------|
| `APPROVED` | `paid` | `confirmed` |
| `DECLINED` | `failed` | `cancelled` |
| `VOIDED` | `refunded` | (sin cambio) |
| `ERROR` | `failed` | `cancelled` |
| `PENDING` | `pending` | `pending` |

### 14.5 Validación de Firma Wompi

Wompi incluye en el payload un objeto `signature`:

```json
{
  "signature": {
    "properties": ["transaction.id", "transaction.status", "transaction.amount_in_cents"],
    "checksum": "abc123..."
  },
  "timestamp": 1234567890
}
```

Algoritmo de validación:

```
1. Extraer valores de transaction según signature.properties
   Ej: ["12345-abc", "APPROVED", "5000000"]
2. Concatenar: "12345-abcAPPROVED5000000"
3. Agregar timestamp y events_secret: "12345-abcAPPROVED50000001234567890{events_secret}"
4. SHA256 del string resultante
5. Comparar con signature.checksum
```

### 14.6 Archivos del Sistema

| Archivo | Propósito |
|---------|-----------|
| `app/api/webhooks/wompi_co/route.ts` | Endpoint webhook — recibe eventos de Wompi, valida firma, actualiza orden y pago |
| `app/api/orders/route.ts` | Crea `web_orders` + `web_order_items` con `order_number` como referencia Wompi |
| `app/checkout/page.tsx` | UI de checkout (carrito, datos cliente, método de pago) |

### 14.7 Seguridad

- **Firma SHA256**: Cada webhook se valida contra el `events_secret` de la organización
- **Service Role**: El webhook usa `createAdminClient()` para escribir en tablas protegidas por RLS
- **Eventos rechazados**: Se registran en `integration_events` con `status=rejected`
- **Secrets en Vault**: Las llaves de Wompi se almacenan en Supabase Vault vía `integration_credentials.secret_ref`
- **Idempotencia**: Si un webhook llega duplicado, la orden ya tendrá el estado actualizado (el update es idempotente)

---

## 15. Pagos Online — Integración MercadoPago

### 15.1 Visión General

Integración con **MercadoPago** como pasarela de pagos. Soporta múltiples países (CO, MX, AR, BR, CL, PE, UY) y métodos de pago: tarjetas crédito/débito, PSE, Efecty, billetera digital. La configuración se realiza desde el admin (`go-admin-erp`), el webhook lo recibe el sitio web del cliente.

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────────────┐
│  Cliente     │────▶│  Checkout    │────▶│  MercadoPago Checkout    │
│  (Browser)   │     │  /checkout   │     │  (Checkout Pro / API)    │
└─────────────┘     └──────────────┘     └────────┬─────────────────┘
                                                   │
                                                   ▼
┌─────────────────────────────────────────────────────────────┐
│  MercadoPago envía webhook POST a:                          │
│  https://{host}/api/webhooks/mercadopago                    │
│                                                             │
│  Headers: x-signature, x-request-id                         │
│  Body: { type, action, data: { id: paymentId } }           │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  /api/webhooks/mercadopago/route.ts                         │
│  1. Parsea notificación (solo type=payment)                 │
│  2. Itera conexiones MP activas                             │
│  3. Verifica firma HMAC-SHA256 con webhook_secret           │
│  4. Consulta pago completo vía API de MP (access_token)     │
│  5. Busca web_order por external_reference (= order_number) │
│  6. Actualiza web_order, crea payment, registra evento      │
└─────────────────────────────────────────────────────────────┘
```

### 15.2 Diferencias clave con Wompi

| Aspecto | Wompi | MercadoPago |
|---------|-------|-------------|
| **Firma** | SHA256 (checksum en body) | HMAC-SHA256 (header `x-signature`) |
| **Datos del pago** | Pago completo viene en el webhook | Solo `data.id` → se consulta vía API |
| **Referencia** | `transaction.reference` | `external_reference` del pago consultado |
| **Credenciales** | 3: `public_key`, `private_key`, `events_secret` | 3: `public_key`, `access_token`, `webhook_secret` |
| **Connector code** | `wompi_co` | `mp_checkout` |
| **Países** | Solo CO | CO, MX, AR, BR, CL, PE, UY |
| **Error response** | 401/404/500 | Siempre 200 (evitar reintentos) |

### 15.3 Tablas Involucradas

Mismas tablas de integración que Wompi (sección 14.2), con estos valores específicos:

| Tabla | Valor para MercadoPago |
|-------|----------------------|
| `integration_connectors` | `mp_checkout` (id: `b00cfe3f-...`) |
| `integration_credentials.purpose` | `public_key`, `access_token`, `webhook_secret` |

### 15.4 Flujo Detallado

#### A. Creación del pedido

Mismo flujo que Wompi (sección 14.3-A). El `order_number` generado se usa como `external_reference` al crear la preferencia de pago en MercadoPago.

#### B. Recepción del webhook (`POST /api/webhooks/mercadopago`)

```
1. MercadoPago envía POST con: { type: "payment", data: { id: "123456" } }
   Headers: x-signature="ts=XXX,v1=HASH", x-request-id="uuid"
2. Solo se procesan type=payment (se ignoran merchant_order, etc.)
3. Buscar TODAS las conexiones activas de mp_checkout
4. Para cada conexión:
   a. Obtener credenciales (access_token + webhook_secret)
   b. Verificar firma HMAC-SHA256
   c. Si firma válida → consultar GET /v1/payments/{id} con access_token
   d. Si pago obtenido → encontró la conexión correcta → break
5. Del pago obtenido, extraer external_reference (= order_number)
6. Buscar web_order por order_number → obtener organization_id
7. Actualizar web_order, crear payment, registrar integration_event
```

#### C. Verificación de firma HMAC-SHA256

```
1. Parsear header x-signature: "ts=1234567890,v1=abc123..."
2. Construir template: "id:{data.id};request-id:{x-request-id};ts:{ts};"
3. HMAC-SHA256(template, webhook_secret)
4. Comparar resultado con v1
```

### 15.5 Mapeo de Estados

| MercadoPago Status | `web_orders.payment_status` | `web_orders.status` |
|-------------------|----------------------------|---------------------|
| `approved` | `paid` | `confirmed` |
| `authorized` | `paid` | `confirmed` |
| `pending` | `pending` | `pending` |
| `in_process` | `pending` | `pending` |
| `in_mediation` | `pending` | `pending` |
| `rejected` | `failed` | `cancelled` |
| `cancelled` | `failed` | `cancelled` |
| `refunded` | `refunded` | (sin cambio) |
| `charged_back` | `refunded` | (sin cambio) |

### 15.6 Métodos de Pago en Colombia

| Tipo | Métodos |
|------|---------|
| Tarjeta crédito | Visa, Mastercard, Amex, Diners, Codensa |
| Tarjeta débito | Visa Débito, Mastercard Débito |
| Transferencia | PSE |
| Efectivo | Efecty, Baloto |
| Billetera digital | Mercado Pago |

### 15.7 Archivos del Sistema

| Archivo | Propósito |
|---------|-----------|
| `app/api/webhooks/mercadopago/route.ts` | Endpoint webhook — recibe notificaciones, valida firma HMAC, consulta pago en API, actualiza orden |
| `app/api/orders/route.ts` | Crea `web_orders` con `order_number` como `external_reference` para MP |
| `app/checkout/page.tsx` | UI de checkout |

### 15.8 Seguridad

- **HMAC-SHA256**: Cada webhook se valida contra el `webhook_secret` de la conexión
- **Iteración segura**: Si la firma no coincide con una conexión, se prueba la siguiente (multi-tenant)
- **Service Role**: Usa `createAdminClient()` para tablas con RLS
- **Respuesta 200**: Siempre retorna 200 (incluso en error) para evitar reintentos excesivos de MercadoPago
- **Secrets en Vault**: Las credenciales se almacenan vía `integration_credentials.secret_ref`
- **API fetch**: El pago completo se obtiene de la API de MP (no confía solo en el webhook body)

---

## 16. Pagos Online — Integración PayU Colombia

### 16.1 Visión General

Integración con **PayU Latam** como pasarela de pagos para Colombia. Soporta tarjetas crédito/débito, PSE, Nequi, Bancolombia, Efecty y más. La configuración se realiza desde el admin (`go-admin-erp`), el webhook (URL de confirmación) lo recibe el sitio web del cliente.

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────────┐
│  Cliente     │────▶│  Checkout    │────▶│  PayU WebCheckout    │
│  (Browser)   │     │  /checkout   │     │  o API de pagos      │
└─────────────┘     └──────────────┘     └────────┬─────────────┘
                                                   │
                                                   ▼
┌─────────────────────────────────────────────────────────────┐
│  PayU envía confirmación POST a:                            │
│  https://{host}/api/webhooks/payu                           │
│                                                             │
│  Content-Type: application/x-www-form-urlencoded (o JSON)   │
│  Body: merchant_id, state_pol, reference_sale, sign, etc.   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  /api/webhooks/payu/route.ts                                │
│  1. Parsea payload (form-urlencoded o JSON)                 │
│  2. Valida campos: merchant_id, state_pol, reference_sale   │
│  3. Busca conexión por merchant_id                          │
│  4. Verifica firma MD5 con apiKey                           │
│  5. Busca web_order por reference_sale (= order_number)     │
│  6. Actualiza web_order, crea payment, registra evento      │
└─────────────────────────────────────────────────────────────┘
```

### 16.2 Diferencias clave con Wompi y MercadoPago

| Aspecto | Wompi | MercadoPago | PayU |
|---------|-------|-------------|------|
| **Firma** | SHA256 (body) | HMAC-SHA256 (header) | MD5 (body `sign`) |
| **Datos del pago** | Completo en webhook | Solo ID → fetch API | Completo en webhook |
| **Referencia** | `transaction.reference` | `external_reference` (API) | `reference_sale` |
| **Content-Type** | JSON | JSON | form-urlencoded o JSON |
| **Credenciales** | 3 | 3 | 4: `api_key`, `api_login`, `merchant_id`, `account_id` |
| **Match conexión** | Por org (vía order) | Iterar todas | Por `merchant_id` |
| **Connector code** | `wompi_co` | `mp_checkout` | `payu_co` |
| **País** | CO | Multi | CO |

### 16.3 Tablas Involucradas

Mismas tablas de integración que Wompi (sección 14.2), con estos valores específicos:

| Tabla | Valor para PayU |
|-------|----------------|
| `integration_connectors` | `payu_co` (id: `dc652aa4-...`) |
| `integration_credentials.purpose` | `api_key`, `api_login`, `merchant_id`, `account_id` |

### 16.4 Flujo Detallado

#### A. Creación del pedido

Mismo flujo que Wompi (sección 14.3-A). El `order_number` se usa como `referenceCode` al enviar el pago a PayU.

#### B. Recepción del webhook (`POST /api/webhooks/payu`)

```
1. PayU envía POST (form-urlencoded) a la URL de confirmación
   Body: merchant_id, state_pol, reference_sale, sign, value, currency, ...
2. Validar campos requeridos: merchant_id, state_pol, reference_sale
3. Buscar TODAS las conexiones activas de payu_co
4. Para cada conexión:
   a. Obtener credenciales (api_key + merchant_id)
   b. Comparar merchant_id del payload con el de la conexión
   c. Si coincide → verificar firma MD5
   d. Si firma válida → encontró la conexión correcta → break
5. Buscar web_order por reference_sale (= order_number)
6. Actualizar web_order, crear payment, registrar integration_event
```

#### C. Verificación de firma MD5

```
1. Campos: apiKey, merchantId, reference_sale, value, currency, state_pol
2. Redondear value: si es entero → "X.0", si es decimal → tal cual
3. Concatenar: "{apiKey}~{merchantId}~{reference_sale}~{value}~{currency}~{state_pol}"
4. MD5 del string resultante
5. Comparar con campo "sign" del payload
```

### 16.5 Mapeo de Estados

| `state_pol` | Nombre PayU | `web_orders.payment_status` | `web_orders.status` |
|-------------|-------------|----------------------------|---------------------|
| `4` | APPROVED | `paid` | `confirmed` |
| `5` | EXPIRED | `failed` | `cancelled` |
| `6` | DECLINED | `failed` | `cancelled` |
| `7` | PENDING | `pending` | `pending` |
| `104` | ERROR | `failed` | `cancelled` |

### 16.6 Métodos de Pago en Colombia

| Tipo | Métodos |
|------|---------|
| Tarjeta crédito | VISA, MASTERCARD, AMEX, DINERS, CODENSA |
| Tarjeta débito | VISA_DEBIT, MASTERCARD_DEBIT |
| Transferencia | PSE |
| Billetera digital | NEQUI, BANCOLOMBIA_TRANSFER, GOOGLE_PAY |
| Efectivo | EFECTY, BALOTO, OTHERS_CASH |
| Referencia bancaria | BANK_REFERENCED |

### 16.7 Archivos del Sistema

| Archivo | Propósito |
|---------|-----------|
| `app/api/webhooks/payu/route.ts` | Endpoint webhook — recibe confirmación, valida firma MD5, actualiza orden y pago |
| `app/api/orders/route.ts` | Crea `web_orders` con `order_number` como `referenceCode` para PayU |
| `app/checkout/page.tsx` | UI de checkout |

### 16.8 Seguridad

- **Firma MD5**: Cada webhook se valida contra el `api_key` y `merchant_id` de la conexión
- **Match por merchant_id**: Antes de verificar firma, se filtra la conexión por `merchant_id` (evita iteraciones innecesarias)
- **Service Role**: Usa `createAdminClient()` para tablas con RLS
- **Respuesta 200**: Siempre retorna 200 (PayU requiere confirmación)
- **Secrets en Vault**: Las credenciales se almacenan vía `integration_credentials.secret_ref`
- **Doble formato**: Soporta form-urlencoded y JSON (PayU puede enviar ambos)
- **IPs de PayU**: Para seguridad adicional se pueden validar las IPs de origen: `18.232.231.205`, `18.235.148.28`, `34.195.228.30`, `34.196.146.74`, `54.196.229.4`, `54.90.62.10`

---

## 17. Pagos Online — Integración Stripe

### 17.1 Visión General

Integración con **Stripe** como pasarela de pagos global. Soporta 46+ países, tarjetas crédito/débito, Checkout Sessions, Payment Intents, suscripciones y más. La configuración se realiza desde el admin (`go-admin-erp`), el webhook lo recibe el sitio web del cliente.

> **Importante**: Esta integración es para los **clientes de GO Admin ERP** (organizaciones que cobran a sus clientes finales). Es independiente del Stripe interno del SaaS.

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────────────┐
│  Cliente     │────▶│  Checkout    │────▶│  Stripe Checkout /       │
│  (Browser)   │     │  /checkout   │     │  Payment Elements        │
└─────────────┘     └──────────────┘     └────────┬─────────────────┘
                                                   │
                                                   ▼
┌─────────────────────────────────────────────────────────────┐
│  Stripe envía webhook POST a:                               │
│  https://{host}/api/webhooks/stripe                         │
│                                                             │
│  Header: stripe-signature (t=timestamp,v1=hmac)             │
│  Body: { id, type, data: { object: {...} } }               │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  /api/webhooks/stripe/route.ts                              │
│  1. Lee raw body + stripe-signature header                  │
│  2. Itera conexiones Stripe activas                         │
│  3. Verifica firma HMAC-SHA256 con webhook_secret           │
│  4. Filtra eventos de pago relevantes                       │
│  5. Extrae order_number de metadata/client_reference_id     │
│  6. Actualiza web_order, crea payment, registra evento      │
└─────────────────────────────────────────────────────────────┘
```

### 17.2 Diferencias clave con las otras pasarelas

| Aspecto | Wompi | MercadoPago | PayU | Stripe |
|---------|-------|-------------|------|--------|
| **Firma** | SHA256 (body) | HMAC-SHA256 (header) | MD5 (body `sign`) | HMAC-SHA256 (header `stripe-signature`) |
| **Datos del pago** | Completo en webhook | Solo ID → fetch API | Completo en webhook | Completo en webhook (evento tipado) |
| **Referencia** | `transaction.reference` | `external_reference` (API) | `reference_sale` | `metadata.order_number` / `client_reference_id` |
| **Credenciales** | 3 | 3 | 4 | 3: `publishable_key`, `secret_key`, `webhook_secret` |
| **Montos** | Centavos | Pesos | Pesos/decimales | Centavos (unidad más pequeña) |
| **Connector code** | `wompi_co` | `mp_checkout` | `payu_co` | `stripe_payments` |
| **País** | CO | Multi (LATAM) | CO | 46+ países global |
| **Checkout hosted** | Widget JS | Checkout Pro | Web Checkout básico | Checkout Sessions |
| **Suscripciones** | ❌ | Básico | Recurrentes | ✅ Nativo completo |

### 17.3 Tablas Involucradas

Mismas tablas de integración que Wompi (sección 14.2), con estos valores específicos:

| Tabla | Valor para Stripe |
|-------|------------------|
| `integration_connectors` | `stripe_payments` (id: `a2b84a76-...`) |
| `integration_credentials.purpose` | `publishable_key`, `secret_key`, `webhook_secret` |

### 17.4 Flujo Detallado

#### A. Creación del pedido

Mismo flujo que Wompi (sección 14.3-A). El `order_number` se incluye en `metadata.order_number` al crear el Payment Intent o como `client_reference_id` en Checkout Sessions.

#### B. Recepción del webhook (`POST /api/webhooks/stripe`)

```
1. Stripe envía POST con evento JSON completo
   Header: stripe-signature="t=1234567890,v1=abc123..."
2. Leer body como RAW TEXT (necesario para verificar firma)
3. Buscar TODAS las conexiones activas de stripe_payments
4. Para cada conexión:
   a. Obtener credenciales (webhook_secret)
   b. Verificar firma HMAC-SHA256
   c. Si firma válida → encontró la conexión correcta → break
5. Filtrar solo eventos de pago relevantes:
   - payment_intent.succeeded
   - payment_intent.payment_failed
   - payment_intent.canceled
   - charge.refunded
   - checkout.session.completed
6. Extraer order_number de metadata o client_reference_id
7. Buscar web_order por order_number
8. Actualizar web_order, crear payment, registrar integration_event
```

#### C. Verificación de firma HMAC-SHA256

```
1. Parsear header stripe-signature: "t=1234567890,v1=abc123..."
2. Verificar tolerancia de tiempo (máx 5 minutos)
3. Construir payload: "{timestamp}.{rawBody}"
4. HMAC-SHA256(payload, webhook_secret)
5. Comparar resultado con v1
```

### 17.5 Eventos Procesados y Mapeo de Estados

| Evento Stripe | `web_orders.payment_status` | `web_orders.status` |
|---------------|----------------------------|---------------------|
| `payment_intent.succeeded` | `paid` | `confirmed` |
| `checkout.session.completed` | `paid` | `confirmed` |
| `payment_intent.payment_failed` | `failed` | `cancelled` |
| `payment_intent.canceled` | `failed` | `cancelled` |
| `charge.refunded` | `refunded` | (sin cambio) |

### 17.6 Métodos de Pago

| Tipo | Métodos |
|------|---------|
| Tarjeta crédito | Visa, Mastercard, Amex, Diners Club |
| Tarjeta débito | Visa Debit, Mastercard Debit |

> **Nota**: Stripe en Colombia soporta principalmente tarjetas. Para PSE, Nequi, Efecty, etc., usar Wompi, PayU o MercadoPago.

### 17.7 Montos en Centavos

| Moneda | Ejemplo UI | Valor en API |
|--------|-----------|-------------|
| COP | $50,000 | `5000000` |
| USD | $10.99 | `1099` |
| MXN | $199.00 | `19900` |

### 17.8 Archivos del Sistema

| Archivo | Propósito |
|---------|-----------|
| `app/api/webhooks/stripe/route.ts` | Endpoint webhook — recibe eventos, valida firma HMAC-SHA256, actualiza orden y pago |
| `app/api/orders/route.ts` | Crea `web_orders` con `order_number` como `metadata.order_number` para Stripe |
| `app/checkout/page.tsx` | UI de checkout |

### 17.9 Seguridad

- **HMAC-SHA256**: Verificación de firma sin dependencia del SDK de Stripe (Web Crypto API nativa)
- **Tolerancia de tiempo**: Rechaza eventos con timestamp mayor a 5 minutos (protección contra replay attacks)
- **Raw body**: Se lee como texto plano para garantizar integridad de la firma
- **Service Role**: Usa `createAdminClient()` para tablas con RLS
- **Respuesta 200**: Retorna 200 en errores para evitar reintentos excesivos
- **Secrets en Vault**: Las credenciales se almacenan vía `integration_credentials.secret_ref`
- **Prefijos de llaves**: Test (`pk_test_`/`sk_test_`) vs Producción (`pk_live_`/`sk_live_`) — el ambiente se detecta por el prefijo
- **PCI SAQ A**: Mínima carga de compliance al usar Stripe.js/Elements (datos de tarjeta nunca pasan por nuestro servidor)

---

## 18. Pagos Online — Integración PayPal

### 18.1 Visión General

Integración con **PayPal Checkout** como pasarela de pagos global. Soporta 200+ países, cuenta PayPal, tarjetas crédito/débito, Pay Later, Venmo (US) y más. La configuración se realiza desde el admin (`go-admin-erp`), el webhook lo recibe el sitio web del cliente.

> **Importante**: PayPal en Colombia opera **solo en USD**. Los montos en COP se convierten automáticamente a USD al momento del pago.

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────────────┐
│  Cliente     │────▶│  Checkout    │────▶│  PayPal Buttons /        │
│  (Browser)   │     │  /checkout   │     │  PayPal Popup            │
└─────────────┘     └──────────────┘     └────────┬─────────────────┘
                                                   │
                                                   ▼
┌─────────────────────────────────────────────────────────────┐
│  PayPal envía webhook POST a:                               │
│  https://{host}/api/webhooks/paypal                         │
│                                                             │
│  Headers: paypal-transmission-id, paypal-transmission-sig,  │
│           paypal-transmission-time, paypal-cert-url,        │
│           paypal-auth-algo                                  │
│  Body: { id, event_type, resource: {...} }                  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  /api/webhooks/paypal/route.ts                              │
│  1. Lee body JSON + headers de verificación                 │
│  2. Itera conexiones PayPal activas                         │
│  3. Obtiene OAuth token + verifica firma vía API PayPal     │
│  4. Filtra eventos de pago relevantes                       │
│  5. Extrae order_number de reference_id/custom_id           │
│  6. Actualiza web_order, crea payment, registra evento      │
└─────────────────────────────────────────────────────────────┘
```

### 18.2 Diferencias clave con las otras pasarelas

| Aspecto | Wompi | MercadoPago | PayU | Stripe | PayPal |
|---------|-------|-------------|------|--------|--------|
| **Firma** | SHA256 (body) | HMAC-SHA256 (header) | MD5 (body) | HMAC-SHA256 (header) | Certificado + verify API |
| **Verificación** | Local | Local | Local | Local | **Llamada a API PayPal** |
| **Autenticación** | Bearer | Bearer | apiKey en body | Bearer sk_ | **OAuth 2.0** (token expira ~9h) |
| **Datos del pago** | Completo | Solo ID → fetch | Completo | Completo | Completo |
| **Referencia** | `transaction.reference` | `external_reference` | `reference_sale` | `metadata.order_number` | `purchase_units[0].reference_id` |
| **Credenciales** | 3 | 3 | 4 | 3 | 3: `client_id`, `client_secret`, `webhook_id` |
| **Montos** | Centavos | Pesos | Pesos | Centavos | **Strings decimales** (`"10.00"`) |
| **Connector code** | `wompi_co` | `mp_checkout` | `payu_co` | `stripe_payments` | `paypal_checkout` |
| **País** | CO | LATAM (6) | CO | 46+ | **200+ países** |
| **Checkout** | Widget JS | Checkout Pro | Web básico | Checkout Sessions | **Botones + popup PayPal** |
| **Suscripciones** | ❌ | Básico | Recurrentes | ✅ Nativo | ✅ Billing Plans |
| **React SDK** | N/A | N/A | N/A | @stripe/react-stripe-js | **@paypal/react-paypal-js** |

### 18.3 Tablas Involucradas

Mismas tablas de integración que Wompi (sección 14.2), con estos valores específicos:

| Tabla | Valor para PayPal |
|-------|-------------------|
| `integration_connectors` | `paypal_checkout` (id: `944c6b76-...`) |
| `integration_credentials.purpose` | `client_id`, `client_secret`, `webhook_id` |

### 18.4 Flujo Detallado

#### A. Creación del pedido

Mismo flujo que Wompi (sección 14.3-A). El `order_number` se incluye como `reference_id` en `purchase_units[0]` al crear la orden PayPal, o como `custom_id`.

#### B. Recepción del webhook (`POST /api/webhooks/paypal`)

```
1. PayPal envía POST con evento JSON completo
   Headers: paypal-transmission-id, paypal-transmission-sig,
            paypal-transmission-time, paypal-cert-url, paypal-auth-algo
2. Parsear body como JSON
3. Buscar TODAS las conexiones activas de paypal_checkout
4. Para cada conexión:
   a. Obtener credenciales (client_id, client_secret, webhook_id)
   b. Obtener OAuth access_token (client_credentials grant)
   c. Llamar API PayPal /v1/notifications/verify-webhook-signature
   d. Si verification_status === 'SUCCESS' → encontró conexión → break
5. Filtrar solo eventos de pago relevantes:
   - CHECKOUT.ORDER.COMPLETED
   - PAYMENT.CAPTURE.COMPLETED
   - PAYMENT.CAPTURE.DENIED
   - PAYMENT.CAPTURE.REFUNDED
   - PAYMENT.CAPTURE.REVERSED
6. Extraer order_number de reference_id o custom_id
7. Buscar web_order por order_number
8. Actualizar web_order, crear payment, registrar integration_event
```

#### C. Verificación de firma (vía API PayPal)

A diferencia de las otras pasarelas que verifican firmas localmente, **PayPal requiere llamar a su API**:

```
1. Obtener OAuth access_token con client_id + client_secret
2. POST /v1/notifications/verify-webhook-signature con:
   - auth_algo (del header)
   - cert_url (del header)
   - transmission_id (del header)
   - transmission_sig (del header)
   - transmission_time (del header)
   - webhook_id (de credenciales)
   - webhook_event (body completo)
3. Si verification_status === 'SUCCESS' → firma válida
```

### 18.5 Eventos Procesados y Mapeo de Estados

| Evento PayPal | `web_orders.payment_status` | `web_orders.status` |
|---------------|----------------------------|---------------------|
| `CHECKOUT.ORDER.COMPLETED` | `paid` | `confirmed` |
| `PAYMENT.CAPTURE.COMPLETED` | `paid` | `confirmed` |
| `PAYMENT.CAPTURE.DENIED` | `failed` | `cancelled` |
| `PAYMENT.CAPTURE.REFUNDED` | `refunded` | (sin cambio) |
| `PAYMENT.CAPTURE.REVERSED` | `refunded` | (sin cambio) |

### 18.6 Métodos de Pago

| Tipo | Métodos |
|------|---------|
| Cuenta PayPal | Saldo PayPal, tarjetas vinculadas |
| Tarjeta crédito | Visa, Mastercard, Amex, Discover |
| Tarjeta débito | Visa Debit, Mastercard Debit |
| Pay Later | Cuotas sin intereses (ciertos países) |
| Venmo | Solo US |

> **Nota**: PayPal en Colombia opera solo en USD. Para pagos en COP (PSE, Nequi, Efecty), usar Wompi, PayU o MercadoPago.

### 18.7 Montos (Strings Decimales)

A diferencia de Stripe/Wompi (centavos), PayPal usa **strings con punto decimal**:

| Moneda | Ejemplo UI | Valor en API |
|--------|-----------|-------------|
| USD | $10.00 | `"10.00"` |
| USD | $100.50 | `"100.50"` |
| MXN | $199.00 | `"199.00"` |

### 18.8 Ambientes

| Ambiente | URL Base API | Detección |
|----------|-------------|-----------|
| Sandbox | `https://api-m.sandbox.paypal.com` | `connection.environment !== 'production'` |
| Producción | `https://api-m.paypal.com` | `connection.environment === 'production'` |

### 18.9 Archivos del Sistema

| Archivo | Propósito |
|---------|-----------|
| `app/api/webhooks/paypal/route.ts` | Endpoint webhook — recibe eventos, verifica firma vía API PayPal, actualiza orden y pago |
| `app/api/orders/route.ts` | Crea `web_orders` con `order_number` como `reference_id` para PayPal |
| `app/checkout/page.tsx` | UI de checkout |

### 18.10 Seguridad

- **Verificación vía API**: La firma se verifica llamando a `/v1/notifications/verify-webhook-signature` (no localmente)
- **OAuth 2.0**: Access token con client_credentials, expira cada ~9h
- **Service Role**: Usa `createAdminClient()` para tablas con RLS
- **Respuesta 200**: Retorna 200 en errores para evitar reintentos excesivos (PayPal reintenta hasta 3 días)
- **Secrets en Vault**: Las credenciales se almacenan vía `integration_credentials.secret_ref`
- **client_id público**: Solo `client_id` va al frontend (para JS SDK), `client_secret` NUNCA se expone
- **Webhook timeout**: PayPal espera respuesta en 30 segundos
- **Idempotency**: Usar header `PayPal-Request-Id` para evitar cargos duplicados en reintentos

---

## 19. Marketing — Integración Meta (Facebook / Instagram)

### 19.1 Visión General

Integración con **Meta Marketing** (Facebook / Instagram) para catálogo de productos, Meta Pixel (tracking) y Conversions API (CAPI). Permite a los clientes de GO Admin ERP sincronizar productos, trackear eventos de conversión y optimizar campañas de publicidad.

> **Importante**: Esta integración es **separada** de los conectores de mensajería (`meta_instagram`, `meta_messenger`) que ya existen. El connector es `meta_marketing`.

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────────────┐
│  Cliente     │────▶│  Sitio Web   │────▶│  Meta Pixel (browser)    │
│  (Browser)   │     │  goadmin     │     │  fbq('track', event)     │
└─────────────┘     └──────┬───────┘     └────────┬─────────────────┘
                           │                      │
                           ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Conversions API (server-side)                              │
│  POST /api/meta/send-event → Graph API /{pixel_id}/events  │
│  Deduplicación: event_id compartido Pixel ↔ CAPI           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Meta envía webhook POST a:                                 │
│  https://{host}/api/webhooks/meta                           │
│                                                             │
│  Header: X-Hub-Signature-256 (sha256=HMAC)                  │
│  Body: { object, entry: [{ id, time, changes: [...] }] }    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  /api/webhooks/meta/route.ts                                │
│  GET: Responde challenge para verificación                  │
│  POST: Verifica firma HMAC-SHA256, registra eventos         │
└─────────────────────────────────────────────────────────────┘
```

### 19.2 Componentes de la Integración

| Componente | Descripción | Ubicación |
|------------|-------------|----------|
| **Meta Pixel** | Script JS que trackea eventos en el browser | `components/site/MetaPixel.tsx` |
| **Conversions API** | Envío server-side de eventos (Purchase, etc.) | `app/api/meta/send-event/route.ts` |
| **Webhook** | Recepción de notificaciones de Meta (catálogo, etc.) | `app/api/webhooks/meta/route.ts` |
| **Query Pixel** | Consulta pixel_id desde integration_credentials | `lib/supabase/queries.ts → getMetaPixelId()` |

### 19.3 Diferencias con las pasarelas de pago

| Aspecto | Pasarelas (Wompi, Stripe, etc.) | Meta Marketing |
|---------|--------------------------------|----------------|
| **Propósito** | Procesar pagos | Tracking + catálogo + ads |
| **Webhook** | Notifica estado de pago → actualiza `web_orders` | Notifica cambios en catálogo/feed → log en `integration_events` |
| **Firma** | Varía por proveedor | HMAC-SHA256 con `app_secret` via `X-Hub-Signature-256` |
| **Frontend** | Widget/checkout de pago | Script Pixel inyectado en `<head>` |
| **Server-side** | N/A (webhook pasivo) | CAPI: envía eventos activamente a Meta |
| **Verificación GET** | No | Sí — Meta envía `hub.challenge` para verificar endpoint |

### 19.4 Tablas Involucradas

| Tabla | Valor para Meta |
|-------|------------------|
| `integration_connectors` | `meta_marketing` (id: `1894a4af-...`) |
| `integration_credentials.purpose` | `access_token`, `app_secret`, `pixel_id`, `catalog_id` |
| `integration_events` | Log de webhooks inbound + CAPI outbound |

### 19.5 Meta Pixel — Inyección Automática

El pixel se inyecta **automáticamente** si la organización tiene una conexión `meta_marketing` activa con `pixel_id`:

```
1. catch-all page.tsx llama getMetaPixelId(organization.id)
2. Si existe → pasa metaPixelId como prop a OrganizationLayout
3. OrganizationLayout renderiza <MetaPixel pixelId={...} />
4. MetaPixel usa next/script (afterInteractive) para inyectar fbevents.js
5. Se dispara PageView automáticamente en cada carga
```

#### Eventos del Pixel por página

| Página | Evento | Parámetros |
|--------|--------|------------|
| Cualquiera | `PageView` | Automático |
| `/productos/[id]` | `ViewContent` | `content_ids`, `value`, `currency` |
| Agregar al carrito | `AddToCart` | `content_ids`, `value`, `currency` |
| `/checkout` | `InitiateCheckout` | `value`, `currency`, `num_items` |
| Compra completada | `Purchase` | `content_ids`, `value`, `currency` |
| `/contacto` (envío) | `Lead` | `value`, `currency` |
| `/reservas` | `Schedule` | `value`, `currency` |

### 19.6 Conversions API (CAPI)

**Endpoint:** `POST /api/meta/send-event`

Envía eventos server-side a Meta para mejor atribución. Complementa al Pixel.

```json
{
  "organization_id": 123,
  "events": [{
    "event_name": "Purchase",
    "event_id": "WO-123-...",
    "event_source_url": "https://mitienda.goadmin.io/checkout/success",
    "user_data": {
      "email": "cliente@email.com",
      "phone": "+573001234567",
      "client_ip_address": "123.45.67.89",
      "fbc": "fb.1.xxx",
      "fbp": "fb.1.xxx"
    },
    "custom_data": {
      "value": 95000,
      "currency": "COP",
      "content_ids": ["SKU-001", "SKU-002"],
      "content_type": "product",
      "num_items": 2
    }
  }]
}
```

**Importante:**
- Los datos personales (email, teléfono, nombre) se **hashean automáticamente** con SHA-256 antes de enviar
- El `event_id` debe coincidir con el del Pixel para **deduplicación**
- Solo necesita `organization_id` — las credenciales se obtienen automáticamente

### 19.7 Webhook de Meta

**Endpoint:** `GET/POST /api/webhooks/meta`

#### GET — Verificación

Meta envía un GET para verificar el endpoint:
```
GET /api/webhooks/meta?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=CHALLENGE
```
Se responde con `hub.challenge` si el `verify_token` coincide con `settings.webhook_verify_token` de la conexión.

#### POST — Recepción de eventos

- Verifica firma `X-Hub-Signature-256` (HMAC-SHA256 con `app_secret`)
- Registra cada `entry.changes[]` como `integration_event`
- Responde HTTP 200 siempre (Meta lo requiere)

### 19.8 Credenciales

| `purpose` | Tipo | Uso |
|-----------|------|-----|
| `access_token` | Token largo (~60 días) | Auth a Graph API |
| `app_secret` | Secreto de la app | Verificar webhooks |
| `pixel_id` | ID numérico | Inyección Pixel + CAPI |
| `catalog_id` | ID numérico | Sync de productos |

### 19.9 Archivos del Sistema

| Archivo | Propósito |
|---------|----------|
| `app/api/webhooks/meta/route.ts` | Webhook — GET challenge + POST firma HMAC-SHA256, log eventos |
| `app/api/meta/send-event/route.ts` | CAPI — enviar eventos server-side con hash SHA-256 automático |
| `components/site/MetaPixel.tsx` | Componente client — inyecta script fbevents.js con `next/script` |
| `components/site/OrganizationLayout.tsx` | Layout — renderiza `<MetaPixel>` si `metaPixelId` existe |
| `lib/supabase/queries.ts` | `getMetaPixelId()` — consulta pixel_id de conexión activa |
| `app/[[...slug]]/page.tsx` | Catch-all — fetchea `metaPixelId` y lo pasa al layout |

### 19.10 Seguridad

- **HMAC-SHA256**: Firma verificada con `app_secret` via Web Crypto API (no `crypto` de Node)
- **Solo pixel_id al frontend**: `access_token` y `app_secret` NUNCA se exponen al browser
- **SHA-256 automático**: Datos personales en CAPI se hashean antes de enviar a Meta
- **Service Role**: Usa `createAdminClient()` para tablas con RLS
- **Respuesta 200**: Retorna 200 para evitar que Meta reintente excesivamente (timeout: 20s)
- **Secrets en Vault**: Las credenciales se almacenan vía `integration_credentials.secret_ref`
- **Token renovación**: El access_token expira ~60 días — se debe renovar periódicamente
- **Deduplicación**: Usar mismo `event_id` en Pixel y CAPI para evitar conteo doble

---

## 20. Flujo E-commerce Retail — Análisis y Arquitectura

### 20.1 Visión General

Este documento describe el flujo completo de compra para organizaciones tipo **retail** (tienda/e-commerce), desde que el cliente llega al sitio hasta la confirmación post-compra. Incluye un análisis crítico del estado actual, los gaps identificados y la arquitectura recomendada.

### 20.2 Flujo Actual (Estado "AS-IS")

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        FLUJO RETAIL ACTUAL                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. CATÁLOGO                                                            │
│  ┌──────────┐    ┌──────────────┐    ┌─────────────────┐               │
│  │  Home     │───▶│  /productos  │───▶│  /productos/[id] │              │
│  │  (Retail  │    │  (catch-all  │    │  (SSR detail)    │              │
│  │  Template)│    │   fallback)  │    │  ⚠️ Sin addToCart│              │
│  └──────────┘    └──────────────┘    └─────────────────┘               │
│       │                                                                 │
│       ▼                                                                 │
│  2. CARRITO (localStorage)                                              │
│  ┌──────────┐    ┌──────────────┐                                      │
│  │  Cart     │◀──│  ProductGrid  │  ← Solo funciona en listado/home    │
│  │  Drawer   │    │  addToCart()  │                                      │
│  └────┬─────┘    └──────────────┘                                      │
│       │                                                                 │
│       ▼                                                                 │
│  3. CHECKOUT (client-side)                                              │
│  ┌──────────────────────────────────────────────────┐                  │
│  │  /checkout (⚠️ usa SiteHeader/SiteFooter viejo)  │                  │
│  │  Step 1: Revisión carrito                         │                  │
│  │  Step 2: Datos envío                              │                  │
│  │  Step 3: Método pago (⚠️ solo UI, sin pasarela)   │                  │
│  │  → POST /api/orders                               │                  │
│  │  → "¡Pedido Realizado!" (⚠️ sin pago real)        │                  │
│  └──────────────────────────────────────────────────┘                  │
│       │                                                                 │
│       ▼                                                                 │
│  4. WEBHOOKS (existen pero nunca se disparan)                          │
│  ┌────────────────────────────────────────┐                            │
│  │  Wompi / MP / PayU / Stripe / PayPal   │                            │
│  │  → Actualizan web_orders               │                            │
│  │  → Crean payments                      │                            │
│  │  → Registran integration_events        │                            │
│  │  ⚠️ Nunca reciben eventos porque       │                            │
│  │     no se redirige a pasarela          │                            │
│  └────────────────────────────────────────┘                            │
│       │                                                                 │
│       ▼                                                                 │
│  5. POST-COMPRA                                                         │
│  ┌────────────────────────────────────────┐                            │
│  │  /mi-cuenta/pedidos → lista real ✅     │                            │
│  │  /mi-cuenta/pedidos/[id] → detalle ✅   │                            │
│  │  ⚠️ Sin email de confirmación          │                            │
│  │  ⚠️ Sin tracking sin login             │                            │
│  └────────────────────────────────────────┘                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 20.3 Componentes Actuales

| Componente | Archivo | Estado | Problema |
|-----------|---------|--------|----------|
| **RetailTemplate** | `components/site/templates/RetailTemplate.tsx` | ✅ Funcional | Template legacy (no Page Builder), `addToCart` funciona aquí |
| **ProductGrid** | `components/site/ProductGrid.tsx` | ✅ Funcional | Soporta imágenes (`product_images`), `addToCart` con localStorage |
| **CartDrawer** | `components/site/CartDrawer.tsx` | ✅ Funcional | Drawer lateral, +/- cantidad, eliminar, ir a checkout |
| **CartIndicator** | `components/site/CartIndicator.tsx` | ✅ Funcional | Badge en header con conteo de items |
| **Producto detalle** | `app/productos/[id]/page.tsx` | 🔴 Incompleto | Botón "Agregar al carrito" **sin onClick** (es SSR, sin lógica client) |
| **Carrito page** | `app/carrito/page.tsx` | 🔴 Inútil | SSR, siempre muestra vacío (no accede a localStorage) |
| **Checkout** | `app/checkout/page.tsx` | 🔴 Crítico | `'use client'` viejo, **no redirige a pasarela**, métodos de pago solo UI |
| **API Orders** | `app/api/orders/route.ts` | ✅ Funcional | Crea `web_orders` + `web_order_items`, genera `order_number` |
| **Webhooks** | `app/api/webhooks/*` | ✅ Funcional | 5 pasarelas implementadas, pero sin trigger desde checkout |
| **Mi cuenta pedidos** | `app/mi-cuenta/pedidos/` | ✅ Funcional | Lista + detalle con data real de Supabase |

### 20.4 Gaps Críticos Identificados

#### 🔴 P0 — Bloqueantes (el flujo de compra no funciona)

| # | Gap | Impacto | Ubicación |
|---|-----|---------|-----------|
| 1 | **No hay redirección a pasarela de pago** | Órdenes se crean como `pending` pero el usuario nunca paga | `app/checkout/page.tsx` |
| 2 | **Botón "Agregar al carrito" en detalle no funciona** | SSR sin lógica client; el botón es decorativo | `app/productos/[id]/page.tsx` L118 |
| 3 | **Checkout usa patrón viejo** | `'use client'` + `fetch('/api/organization?subdomain=...')`, sin `getOrgContext`, sin `OrganizationLayout` | `app/checkout/page.tsx` |

#### 🟡 P1 — Importantes (funcionalidad incompleta)

| # | Gap | Impacto | Solución propuesta |
|---|-----|---------|-------------------|
| 4 | No hay validación de stock/inventario | Se puede comprar más de lo disponible | Validar en `/api/orders` contra `products.stock_quantity` |
| 5 | No hay impuestos (IVA) | Total incorrecto para Colombia (19% IVA) | Calcular según `website_settings.tax_rate` o por producto |
| 6 | Shipping hardcodeado | `> $100k = gratis, sino $10k` para todas las orgs | Usar `website_settings.shipping_*` configurable |
| 7 | No hay email de confirmación | Mensaje dice "te enviaremos" pero no hay lógica | Llamar edge function o API de email post-orden |
| 8 | No hay página de estado de pedido sin login | Post-compra requiere registrarse | Crear `/pedido/[orderNumber]` con token |
| 9 | `app/carrito/page.tsx` es inútil | SSR no accede a localStorage | Eliminar o convertir a client con lógica real |

#### 🟠 P2 — Menores (mejoras de UX)

| # | Gap | Impacto |
|---|-----|---------|
| 10 | Carrito no sincroniza entre dispositivos | Solo localStorage, no backend |
| 11 | No hay búsqueda de productos | UX limitada para tiendas grandes |
| 12 | No existe listado de categorías `/categorias` | Solo `/categorias/[id]` funciona |
| 13 | Imágenes de producto en carrito/checkout | Solo muestra emoji 📦 |
| 14 | No hay wishlist / favoritos | Feature común en e-commerce |

### 20.5 Flujo Recomendado ("TO-BE")

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     FLUJO RETAIL RECOMENDADO                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. CATÁLOGO                                                            │
│  ┌──────────┐    ┌──────────────┐    ┌─────────────────┐               │
│  │  Home     │───▶│  /productos  │───▶│  /productos/[id] │              │
│  │  (Page    │    │  (Page Bldg  │    │  SSR + client    │              │
│  │  Builder) │    │   o fallback)│    │  AddToCartBtn ✅  │              │
│  └──────────┘    └──────────────┘    └─────────────────┘               │
│       │                                                                 │
│       ▼                                                                 │
│  2. CARRITO (localStorage + evento custom)                              │
│  ┌──────────┐    ┌──────────────┐                                      │
│  │  Cart     │◀──│  AddToCartBtn │  ← Funciona en listado Y detalle    │
│  │  Drawer   │    │  (client)     │                                      │
│  └────┬─────┘    └──────────────┘                                      │
│       │                                                                 │
│       ▼                                                                 │
│  3. CHECKOUT (modernizado)                                              │
│  ┌──────────────────────────────────────────────────────┐              │
│  │  /checkout                                            │              │
│  │  SSR layout (getOrgContext + OrganizationLayout)      │              │
│  │  + Client wizard:                                     │              │
│  │    Step 1: Revisión carrito                           │              │
│  │    Step 2: Datos envío + dirección guardada           │              │
│  │    Step 3: Método de pago (dinámico según pasarelas)  │              │
│  │    → POST /api/orders (crea orden pending)            │              │
│  │    → POST /api/checkout/init (genera link de pago)    │ ← NUEVO     │
│  │    → Redirige a pasarela externa                      │              │
│  └──────────────────────────────────────────────────────┘              │
│       │                                                                 │
│       ▼                                                                 │
│  4. PASARELA DE PAGO (externa)                                         │
│  ┌──────────────────────────────────────────────────────┐              │
│  │  Wompi Widget / MP Checkout / PayU WebCheckout /     │              │
│  │  Stripe Checkout Session / PayPal Buttons            │              │
│  │  → Usuario completa pago                             │              │
│  │  → Redirect a /checkout/resultado?ref={orderNumber}  │              │
│  └──────────────────────────────────────────────────────┘              │
│       │                                     │                           │
│       │ (async)                              │ (redirect)               │
│       ▼                                     ▼                           │
│  5. WEBHOOK                           6. RESULTADO                     │
│  ┌────────────────────┐              ┌────────────────────┐            │
│  │ /api/webhooks/*    │              │ /checkout/resultado │            │
│  │ Actualiza orden    │              │ Muestra estado      │            │
│  │ paid/failed/etc    │              │ según payment_status│            │
│  │ Crea payment       │              │ de web_orders       │            │
│  └────────────────────┘              └────────────────────┘            │
│                                             │                           │
│                                             ▼                           │
│  7. POST-COMPRA                                                         │
│  ┌──────────────────────────────────────────────────────┐              │
│  │  ✅ Email de confirmación (edge function)             │              │
│  │  ✅ /mi-cuenta/pedidos (historial con data real)      │              │
│  │  ✅ /pedido/{orderNumber} (tracking sin login)        │              │
│  │  ✅ Meta Pixel: Purchase event (CAPI + browser)       │              │
│  └──────────────────────────────────────────────────────┘              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 20.6 API de Inicialización de Pago (Propuesta)

Nuevo endpoint **`POST /api/checkout/init`** que actúa como puente entre la orden y la pasarela:

```
Request:
{
  "orderNumber": "WO-123-ABC-XYZ",
  "gateway": "wompi_co" | "mp_checkout" | "payu_co" | "stripe_payments" | "paypal_checkout",
  "returnUrl": "https://mitienda.goadmin.io/checkout/resultado"
}

Response:
{
  "success": true,
  "gateway": "wompi_co",
  "checkoutUrl": "https://checkout.wompi.co/p/?public-key=...&reference=WO-123...",
  // o para Stripe: sessionUrl
  // o para MP: init_point
  // o para PayU: formHtml (auto-submit form)
  // o para PayPal: { clientId, orderId } (para JS SDK buttons)
}
```

#### Lógica por pasarela:

| Pasarela | Método de checkout | Flujo |
|----------|-------------------|-------|
| **Wompi** | Widget JS embebido o redirect | Generar URL con `public_key` + `reference` + `amount_in_cents` |
| **MercadoPago** | Checkout Pro (redirect) | Crear preferencia vía API → retornar `init_point` |
| **PayU** | WebCheckout (form POST) | Generar form con firma MD5 → auto-submit |
| **Stripe** | Checkout Sessions | Crear session vía API → retornar `session.url` |
| **PayPal** | Buttons (JS SDK) | Retornar `clientId` → renderizar botones PayPal en frontend |

### 20.7 Detección de Pasarelas Disponibles

El checkout debe mostrar solo las pasarelas que la organización tiene configuradas:

```sql
SELECT ic.code, ic.name, icon.id, icon.environment
FROM integration_connections icon
JOIN integration_connectors ic ON ic.id = icon.connector_id
WHERE icon.organization_id = {orgId}
  AND icon.status = 'active'
  AND ic.code IN ('wompi_co', 'mp_checkout', 'payu_co', 'stripe_payments', 'paypal_checkout')
```

Si **ninguna pasarela** está configurada → mostrar solo "Pago contra entrega" y "Transferencia bancaria".

### 20.8 Componente AddToCartButton (Propuesta)

Componente client reutilizable para resolver el gap del botón en detalle de producto:

```
Archivo: components/site/AddToCartButton.tsx

Props:
  - productId: number
  - productName: string
  - price: number
  - primaryColor: string
  - variant?: 'full' | 'icon' (default: 'full')

Lógica:
  1. Lee subdomain de window.location.hostname
  2. Lee carrito de localStorage (cart_{subdomain})
  3. Agrega o incrementa quantity
  4. Guarda en localStorage
  5. Dispara CustomEvent('cart-updated')
  6. Muestra feedback visual (✓ Agregado)
```

### 20.9 Archivos Involucrados

| Archivo | Rol | Estado |
|---------|-----|--------|
| `components/site/templates/RetailTemplate.tsx` | Home retail con hero, categorías, productos destacados | ✅ Legacy funcional |
| `components/site/ProductGrid.tsx` | Grid de productos con filtro por categoría, addToCart | ✅ Funcional |
| `components/site/CartDrawer.tsx` | Drawer lateral del carrito | ✅ Funcional |
| `components/site/CartIndicator.tsx` | Badge de items en header | ✅ Funcional |
| `components/site/SiteHeader.tsx` | Header con soporte cart para retail | ✅ Funcional |
| `app/productos/[id]/page.tsx` | Detalle de producto SSR | 🔴 Falta AddToCartButton client |
| `app/checkout/page.tsx` | Checkout multi-paso | 🔴 Falta modernizar + pasarela |
| `app/carrito/page.tsx` | Página de carrito standalone | 🔴 Inútil (SSR sin localStorage) |
| `app/api/orders/route.ts` | Creación de web_orders | ✅ Funcional |
| `app/api/checkout/init/route.ts` | Inicialización de pago | ❌ No existe aún |
| `app/checkout/resultado/page.tsx` | Página post-pago | ❌ No existe aún |
| `app/api/webhooks/*/route.ts` | Webhooks de 5 pasarelas | ✅ Funcional |
| `app/mi-cuenta/pedidos/page.tsx` | Historial de pedidos | ✅ Funcional |
| `app/mi-cuenta/pedidos/[id]/page.tsx` | Detalle de pedido | ✅ Funcional |
| `app/categorias/[id]/page.tsx` | Productos por categoría | ✅ Funcional |

### 20.10 Modelo de Datos Relevante

```sql
-- Orden de compra web
web_orders:
  id, organization_id, branch_id, customer_id,
  order_number (VARCHAR, único, formato WO-{orgId}-{ts}-{rand}),
  status (pending → confirmed → preparing → ready → shipped → delivered → completed | cancelled),
  payment_status (pending → paid | failed | refunded),
  payment_method, payment_reference,
  subtotal, delivery_fee, tax_amount, total,
  delivery_type (pickup | delivery),
  delivery_address (JSONB),
  customer_name, customer_email, customer_phone, customer_notes,
  confirmed_at, cancelled_at, cancellation_reason,
  created_at, updated_at

-- Items de la orden
web_order_items:
  id, web_order_id, product_id,
  product_name, product_sku,
  quantity, unit_price, total

-- Pagos registrados por webhooks
payments:
  id, organization_id, branch_id,
  source ('web_order'), source_id,
  method, amount, currency,
  reference, processor_response (JSONB),
  status (pending | paid | failed | refunded)
```

### 20.11 Cálculos del Checkout

| Concepto | Estado actual | Recomendado |
|----------|--------------|-------------|
| **Subtotal** | `Σ(item.price × item.quantity)` ✅ | Sin cambios |
| **Envío** | `subtotal > 100000 ? 0 : 10000` (hardcodeado) | `website_settings.free_shipping_threshold`, `website_settings.shipping_flat_rate` |
| **Impuestos** | ❌ No se calculan | `tax = subtotal × (website_settings.tax_rate / 100)` default 19% CO |
| **Descuento** | ❌ No existe | Aplicar cupón de `coupons` tabla (ya existe en mi-cuenta) |
| **Total** | `subtotal + shipping` | `subtotal + shipping + tax - discount` |

### 20.12 Plan de Implementación (Priorizado)

#### Fase A — Hacer funcional el flujo de compra (P0)

| # | Tarea | Esfuerzo | Dependencias |
|---|-------|----------|-------------|
| A1 | Crear `AddToCartButton` client component | Bajo | Ninguna |
| A2 | Integrar `AddToCartButton` en `app/productos/[id]/page.tsx` | Bajo | A1 |
| A3 | Modernizar `app/checkout/page.tsx` → SSR + Client wizard | Medio | Ninguna |
| A4 | Crear `POST /api/checkout/init` (puente orden→pasarela) | Alto | Definir flujo por pasarela |
| A5 | Crear `/checkout/resultado` (página post-pago) | Medio | A4 |
| A6 | Conectar checkout step 3 → `/api/checkout/init` → redirect | Medio | A3, A4 |

#### Fase B — Completar funcionalidad (P1)

| # | Tarea | Esfuerzo |
|---|-------|----------|
| B1 | Validación de stock en `/api/orders` | Bajo |
| B2 | Impuestos configurables por org | Bajo |
| B3 | Shipping configurable por org | Bajo |
| B4 | Eliminar `app/carrito/page.tsx` (redundante) | Trivial |
| B5 | Email de confirmación post-orden | Medio |
| B6 | Página tracking `/pedido/[orderNumber]` sin login | Medio |

#### Fase C — Mejoras de UX (P2)

| # | Tarea | Esfuerzo |
|---|-------|----------|
| C1 | Imágenes de producto en carrito/checkout | Bajo |
| C2 | Búsqueda de productos | Medio |
| C3 | Listado de categorías `/categorias` | Bajo |
| C4 | Aplicar cupones en checkout | Medio |
| C5 | Direcciones guardadas en checkout (customer_addresses) | Medio |

### 20.13 Seguridad

- **Validación server-side**: Precios se verifican en `/api/orders` contra la DB, NO se confía en el precio del localStorage
- **Order number único**: Formato `WO-{orgId}-{ts}-{rand}` previene colisiones
- **Webhooks verificados**: Cada pasarela tiene su propio mecanismo de verificación de firma
- **RLS**: `web_orders` protegido con RLS; admin client usa service role
- **CSRF**: Las APIs de orders/checkout usan POST con body JSON
- **Rate limiting**: Considerar rate limit en `/api/orders` para prevenir abuso
