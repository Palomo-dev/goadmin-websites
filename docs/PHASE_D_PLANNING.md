# Fase D — Delivery + Conductores, Favoritos, Estimación Tiempo

> **Estado:** ✅ COMPLETADA
> **Dependencias:** Fase A ✅ + B ✅ + C ✅ completadas

---

## D1 — Delivery + Conductores (Integración Website ↔ ERP Transporte)

### Objetivo
Permitir que el cliente vea en tiempo real quién lleva su pedido (conductor + vehículo), con tracking GPS y estimación de llegada.

### Tablas existentes que se usan
- `shipments` — ya se crea automáticamente desde `webOrderConfirmationService` para `delivery_own`
- `driver_credentials` — datos del conductor (licencia, certificaciones, contacto emergencia)
- `vehicles` — datos del vehículo (placa, tipo, marca, modelo, color)
- `transport_events` — historial de eventos GPS y estados del envío
- `proof_of_delivery` — prueba de entrega (firma, fotos, receptor)
- `delivery_attempts` — intentos de entrega fallidos

### Tareas

| # | Tarea | Archivos | Prioridad |
|---|-------|----------|-----------|
| D1.1 | **API tracking conductor** — `/api/orders/[id]/delivery` que retorne datos del conductor asignado (nombre, foto, teléfono), vehículo (placa, tipo, color) y último evento GPS | `app/api/orders/[id]/delivery/route.ts` | 🔴 Alta |
| D1.2 | **UI tracking conductor en página pública** — Mostrar tarjeta de conductor en `/pedido/[orderNumber]` con nombre, foto, tipo vehículo, placa; botón "Llamar conductor" | `app/pedido/[id]/OrderTracker.tsx` | 🔴 Alta |
| D1.3 | **Mapa en vivo** — Integrar Google Maps/Mapbox en la página de tracking público mostrando ubicación del conductor (polling transport_events cada 10s) | `app/pedido/[id]/DeliveryMap.tsx` (nuevo componente client) | 🟡 Media |
| D1.4 | **ETA dinámico** — Calcular tiempo estimado de llegada basado en distancia (Google Directions API) entre última posición del conductor y dirección de entrega | `app/api/orders/[id]/eta/route.ts` | 🟡 Media |
| D1.5 | **Notificación al cliente** — Email/push cuando el conductor recoge el pedido (status → in_delivery) con datos del conductor y link de tracking | `lib/email/send-delivery-notification.ts` | 🟢 Baja |
| D1.6 | **Prueba de entrega en portal** — Mostrar en `/mi-cuenta/pedidos/[id]` la prueba de entrega (firma, fotos, nombre receptor) si existe | `app/mi-cuenta/pedidos/[id]/page.tsx` | 🟢 Baja |

### Flujo
```
ERP confirma pedido (delivery_own)
    ↓
webOrderConfirmationService → crea shipment automático
    ↓
ERP → Admin asigna conductor + vehículo (deliveryIntegrationService.assignVehicleAndDriver)
    ↓
Website → API /delivery detecta shipment → consulta driver_credentials + vehicles
    ↓
Website → Muestra conductor en tracking público
    ↓
Conductor recoge → markAsPickedUp → web_order.status = in_delivery
    ↓
Conductor registra eventos GPS → transport_events
    ↓
Website → Polling eventos → actualiza posición en mapa
    ↓
Conductor entrega → markAsDelivered → proof_of_delivery → web_order.status = delivered
```

---

## D2 — Favoritos (Platos/Productos Favoritos del Cliente)

### Objetivo
Permitir que el cliente marque productos como favoritos y pueda re-pedirlos rápidamente desde una sección dedicada.

### Estrategia de almacenamiento
Usar la columna `metadata` (jsonb) de `customers` para almacenar un array de `favorite_product_ids`. No requiere tabla nueva.

### Tareas

| # | Tarea | Archivos | Prioridad |
|---|-------|----------|-----------|
| D2.1 | **API favoritos** — GET/POST `/api/favorites` para leer/agregar/quitar favoritos del customer. Usa `customers.metadata.favorites[]` | `app/api/favorites/route.ts` | 🔴 Alta |
| D2.2 | **Botón ♡ en menú** — Toggle favorito en cada producto del menú (requiere auth) | `components/site/MenuView.tsx` | 🔴 Alta |
| D2.3 | **Página /mi-cuenta/favoritos** — Lista de productos favoritos con botón "Agregar al carrito" y "Pedir todo" | `app/mi-cuenta/favoritos/page.tsx` | 🟡 Media |
| D2.4 | **Sección "Tus favoritos" en menú** — Si el cliente está logueado, mostrar sección especial al inicio del menú con sus favoritos | `components/site/MenuView.tsx` | 🟢 Baja |

### Estructura metadata
```json
{
  "favorites": [123, 456, 789]  // product IDs
}
```

---

## D3 — Estimación de Tiempo de Preparación

### Objetivo
Calcular automáticamente el `estimated_ready_at` basado en el promedio real de tiempos de preparación registrados en `kitchen_tickets`, en lugar del input manual del admin.

### Tablas existentes
- `kitchen_tickets` — tiene `created_at`, `status`, `estimated_time`
- `kitchen_ticket_items` — tiene `status` con timestamps implícitos
- `web_orders` — tiene `estimated_ready_at`

### Tareas

| # | Tarea | Archivos | Prioridad |
|---|-------|----------|-----------|
| D3.1 | **API tiempo estimado** — `/api/orders/estimate-time` que consulte los últimos N kitchen_tickets completados de la branch, calcule promedio real de preparación y devuelva minutos estimados | `app/api/orders/estimate-time/route.ts` | 🟡 Media |
| D3.2 | **Mostrar estimación en checkout** — Después de crear pedido, mostrar "Tu pedido estará listo en ~X minutos" basado en la API | `components/site/CheckoutWizard.tsx` | 🟡 Media |
| D3.3 | **Mostrar en tracking** — Barra de progreso con tiempo estimado vs tiempo transcurrido en `/pedido/[orderNumber]` | `app/pedido/[id]/OrderTracker.tsx` | 🟡 Media |
| D3.4 | **Sugerir al admin en ERP** — Pre-llenar el campo "Tiempo estimado" en el diálogo de confirmación con el promedio calculado | `webOrderConfirmationService.ts` (ERP) | 🟢 Baja |

### Cálculo propuesto
```
1. Obtener últimos 50 kitchen_tickets completados de la branch
2. Calcular: tiempo_real = updated_at(status='completed') - created_at
3. Filtrar outliers (> 2 desviaciones estándar)
4. Promedio = media de tiempos filtrados
5. Factor_carga = tickets_activos_ahora / capacidad_promedio
6. Estimación = promedio × (1 + factor_carga × 0.3)
```

---

## Orden de implementación recomendado

1. **D2 (Favoritos)** — Más simple, alto valor para UX, independiente
2. **D3 (Estimación tiempo)** — Mejora directa en la experiencia de tracking
3. **D1 (Delivery + Conductores)** — Más complejo, requiere que el ERP tenga conductores y vehículos configurados

## Dependencias externas
- **D1.3/D1.4**: Requieren `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` en `.env`
- **D2**: Requiere que el cliente esté autenticado para marcar favoritos
- **D3**: Requiere datos históricos en `kitchen_tickets` para cálculos precisos

---

## Implementación completada

### Archivos creados
| Archivo | Descripción |
|---------|-------------|
| `app/api/favorites/route.ts` | API GET/POST favoritos (customers.metadata.favorites) |
| `app/mi-cuenta/favoritos/page.tsx` | Página portal con productos favoritos |
| `app/mi-cuenta/favoritos/FavoriteProductCard.tsx` | Card de producto favorito con agregar al carrito / quitar |
| `app/api/orders/[id]/delivery/route.ts` | API delivery: conductor, vehículo, último GPS, POD |
| `components/site/DeliveryInfo.tsx` | Tarjeta conductor + vehículo + estado + POD con polling 15s |
| `components/site/DeliveryMap.tsx` | Google Maps con posición conductor en vivo + ETA via Directions |
| `components/site/EstimatedTime.tsx` | Barra progreso tiempo estimado preparación |
| `app/api/orders/estimate-time/route.ts` | API estimación tiempo basada en kitchen_tickets históricos |
| `lib/email/send-delivery-notification.ts` | Email al cliente cuando conductor recoge pedido |

### Archivos modificados
| Archivo | Cambio |
|---------|--------|
| `lib/supabase/queries.ts` | +getProductsByIds para obtener productos favoritos por IDs |
| `components/site/MenuView.tsx` | +props customerId/organizationId/initialFavorites, +toggleFavorite, +botón ❤️ en cards |
| `app/[[...slug]]/page.tsx` | Caso 'menu': pasa customer + favoritos iniciales a MenuView |
| `app/pedido/[id]/OrderTracker.tsx` | +DeliveryInfo, +DeliveryMap, +EstimatedTime integrados |
| `app/mi-cuenta/pedidos/[id]/page.tsx` | +DeliveryInfo para conductor/POD en portal |
| `app/api/orders/[id]/tracking/route.ts` | +organization_id, +branch_id en response |

### Compilación: ✅ Sin errores TypeScript
