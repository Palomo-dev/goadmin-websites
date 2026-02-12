# Análisis de Integración: Website (web_orders) ↔ ERP (POS, Inventario, Finanzas, Transporte)

> **Fecha:** Febrero 2026
> **Alcance:** Verificar que el flujo completo desde el checkout del website hasta el software administrativo (ERP) está correctamente conectado.

---

## 1. Diagrama de Flujo Completo

```
WEBSITE (goadmin-websites)                    ERP (go-admin-erp)
═══════════════════════                       ══════════════════

Cliente hace checkout                         
    ↓                                         
POST /api/orders                              
    ├─ Valida stock (stock_levels) ✅          
    ├─ Busca/crea customer ✅                  
    ├─ Calcula tax (organization_taxes) ✅     
    ├─ Crea web_orders ✅                      
    ├─ Crea web_order_items ✅                 
    ├─ Crea tips (si propina > 0) ✅          
    ├─ Registra coupon_redemptions ✅          
    └─ Email confirmación ✅                   
                                              
    ↓ (Realtime postgres_changes)             Admin ve pedido en POS → Pedidos Online
                                                  ├─ Vista Kanban (pending/confirmed/preparing/ready) ✅
                                                  ├─ Notificación sonora ✅
                                                  ├─ Auto-refresh 30s ✅
                                                  └─ Suscripción realtime ✅
                                              
                                              Admin confirma pedido →
                                              webOrderConfirmationService.confirmOrder()
                                                  ├─ Crea sales + sale_items (POS) ✅
                                                  ├─ Crea kitchen_tickets + kitchen_ticket_items ✅
                                                  ├─ Crea tips vía PropinasService ⚠️ DUPLICADO
                                                  ├─ Crea shipments (si delivery_own) ✅
                                                  └─ Actualiza web_orders.sale_id ✅
                                              
                                              Admin gestiona delivery →
                                              deliveryIntegrationService
                                                  ├─ Asigna conductor + vehículo ✅
                                                  ├─ Marca picked_up → web_order.status=in_delivery ✅
                                                  ├─ Registra transport_events (GPS) ✅
                                                  ├─ Marca delivered → web_order.status=delivered ✅
                                                  ├─ Crea proof_of_delivery ✅
                                                  └─ Libera vehículo ✅
```

---

## 2. Estado de Integración por Módulo

### 2.1 POS (Punto de Venta) ✅ INTEGRADO

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| **web_orders → sales** | ✅ | `webOrderConfirmationService` crea `sales` con todos los campos (total, subtotal, tax, discount, customer_id, branch_id) |
| **web_order_items → sale_items** | ✅ | Items copiados con product_id, quantity, unit_price, tax_amount, modifiers en notes.jsonb |
| **sale_id vinculado** | ✅ | `web_orders.sale_id` se actualiza al confirmar, permite navegar del pedido web a la venta POS |
| **Kitchen tickets** | ✅ | Se crean `kitchen_tickets` + `kitchen_ticket_items` automáticamente al confirmar → llegan a cocina/comandas |
| **Pedidos Online (listado)** | ✅ | ERP tiene vista Kanban completa en `/pos/pedidos-online` con filtros, stats, realtime |
| **Pedidos Online (detalle)** | ✅ | ERP tiene detalle completo en `/pos/pedidos-online/[id]` con acciones (confirmar, rechazar, preparar, listo, entregar, cancelar, convertir a venta) |
| **Cupones** | ✅ | `coupon_code` y `discount_total` guardados en `web_orders`, `coupon_redemptions` registrado, `usage_count` incrementado |
| **Promociones** | ✅ | `discount_total` incluye descuento de promociones, visible en ERP via web_orders.discount_total |

### 2.2 Propinas ⚠️ PROBLEMA DE DUPLICACIÓN

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| **Website crea tip** | ✅ | `/api/orders` inserta en `tips` con tip_type='online', sale_id=null, server_id='00000000...' |
| **ERP crea tip (confirmación)** | ⚠️ | `webOrderConfirmationService.createTip()` crea OTRO registro en tips vía PropinasService |
| **Distribución en ERP** | ✅ | `/pos/propinas` permite ver, filtrar y distribuir propinas |

**🔴 BUG: Propina duplicada.** El website crea un tip al hacer el pedido Y el ERP crea otro al confirmar. Esto resulta en **propina contada doble**.

**Solución recomendada:** Eliminar la creación de tip en el website (`/api/orders`) y dejar que solo el ERP la cree al confirmar (ya que ahí tiene el `sale_id` correcto). O alternativamente, que el `webOrderConfirmationService` busque si ya existe un tip con `notes LIKE '%{order_number}%'` antes de crear uno nuevo.

### 2.3 Inventario ⚠️ PARCIALMENTE INTEGRADO

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| **Validación de stock** | ✅ | `/api/orders` consulta `stock_levels` (qty_on_hand - qty_reserved) antes de crear pedido |
| **Reserva de stock** | ❌ FALTA | Al crear web_order, NO se incrementa `qty_reserved` en `stock_levels` |
| **Deducción de stock** | ❌ FALTA | Al confirmar/entregar pedido, NO se decrementa `qty_on_hand` ni se crea `stock_movements` |
| **Movimientos de inventario** | ❌ FALTA | No se registran `stock_movements` (tipo 'sale' o 'web_order') al completar el pedido |
| **Productos del catálogo** | ✅ | Website lee `products` con precios (`product_prices`), imágenes, categorías correctamente |

**🔴 GAP CRÍTICO:** El stock se valida pero nunca se ajusta. Dos clientes podrían comprar el mismo último producto porque no hay reserva.

**Solución recomendada:**
1. **Al crear web_order:** Incrementar `qty_reserved` en `stock_levels` para cada item
2. **Al confirmar (ERP):** Decrementar `qty_on_hand` y restablecer `qty_reserved`. Crear `stock_movements` tipo 'sale'
3. **Al cancelar:** Restaurar `qty_reserved`

### 2.4 Transporte / Envíos ✅ INTEGRADO

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| **Shipment automático** | ✅ | `webOrderConfirmationService` crea `shipments` (source_type='web_order') para delivery_own |
| **Asignación conductor** | ✅ | ERP tiene `AssignDeliveryDialog` + `deliveryIntegrationService.assignVehicleAndDriver()` |
| **Tracking eventos** | ✅ | `transport_events` registra created, assigned, picked_up, delivered, delivery_failed |
| **Prueba de entrega** | ✅ | `proof_of_delivery` con firma, fotos, receptor |
| **Delivery attempts** | ✅ | `delivery_attempts` registra intentos fallidos con razón |
| **Sincronización estados** | ✅ | `markAsPickedUp` → web_order.in_delivery, `markAsDelivered` → web_order.delivered |
| **Shipping rates** | ✅ | Website consulta `shipping_rates` dinámicamente por ciudad en checkout |
| **Vehículos** | ✅ | ERP gestiona vehículos, conductores, asignación |

### 2.5 Finanzas ⚠️ NO INTEGRADO

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| **Registro de pago** | ❌ FALTA | Al confirmar pago (webhook), no se crea registro en tabla de pagos |
| **Ingreso contable** | ❌ FALTA | No se genera asiento contable ni registro en `ingresos` |
| **Factura de venta** | ❌ FALTA | No se crea `facturas_venta` desde la sale generada |
| **Cuenta por cobrar** | ⚠️ PARCIAL | `sales.balance` se establece correctamente (0 si paid), pero no hay CxC formal |
| **Delivery fee como ingreso** | ❌ FALTA | El delivery_fee está en web_orders.delivery_fee pero no se refleja como línea separada en la sale |
| **Conciliación bancaria** | ❌ FALTA | Los pagos online (Wompi, Stripe, PayPal, MercadoPago) no se vinculan con transacciones bancarias |

**🟡 GAP MEDIO:** Las ventas se crean en el POS correctamente, pero no hay integración automática con el módulo de finanzas. El admin tendría que crear manualmente las facturas y registrar los pagos.

**Solución recomendada (Fase futura):**
1. Al confirmar pago (webhook) → crear registro en tabla `payments` vinculado a la sale
2. Trigger o servicio que al crear sale con payment_status='paid' → genere factura de venta
3. Al crear factura → generar asiento contable automático

---

## 3. Resumen de Gaps y Prioridades

| # | Gap | Severidad | Módulo | Solución |
|---|-----|-----------|--------|----------|
| 1 | **Propina duplicada** — Website Y ERP crean tip | 🔴 Alta | POS/Propinas | Eliminar tip en `/api/orders` o buscar existente en ERP antes de crear |
| 2 | **Stock no se reserva/deduce** — Solo se valida, no se ajusta | 🔴 Alta | Inventario | Reservar al crear pedido, deducir al confirmar, restaurar al cancelar |
| 3 | **Sin registro de pago formal** — Los webhooks confirman pero no registran payment | 🟡 Media | Finanzas | Crear payment record en webhook de pago exitoso |
| 4 | **Sin facturación automática** — No se generan facturas desde web sales | 🟡 Media | Finanzas | Trigger sale.paid → crear factura_venta |
| 5 | **Delivery fee no desglosado en sale** — Incluido en total pero no como línea | 🟢 Baja | POS | Agregar sale_item de tipo 'shipping' o campo delivery_fee en sales |
| 6 | **Promotion IDs no en sale** — Solo discount_total, no qué promos se aplicaron | 🟢 Baja | POS | Guardar promotion_ids en web_orders y/o sales.notes |

---

## 4. Lo que SÍ funciona correctamente (✅)

1. **Checkout completo** → web_orders con todos los datos (items, customer, tax, shipping, tip, coupon, discount)
2. **Realtime al ERP** → Suscripción postgres_changes + polling 30s
3. **Confirmación → Sale + Comanda** → Creación automática de sale + sale_items + kitchen_ticket
4. **Delivery propio** → Shipment automático + asignación conductor/vehículo + tracking completo
5. **Tracking público** → `/pedido/[orderNumber]` con timeline, shipment info, estados en vivo
6. **Portal cliente** → `/mi-cuenta/pedidos` con historial, detalle, re-pedir, tracking link
7. **Cupones** → Validación completa + redención + uso trackeado
8. **Promociones** → Auto-detección + aplicación + descuento en total
9. **Shipping dinámico** → Consulta shipping_rates por ciudad + selector en checkout
10. **Clientes** → Búsqueda/creación automática en customers
11. **Tax** → Lee organization_taxes para calcular impuestos correctamente
12. **Stock validación** → Lee stock_levels antes de permitir la compra

---

## 5. Recomendación de Próximos Pasos

### Prioridad 1 — Fixes críticos (antes de Fase D)
1. **Fix propina duplicada** — 1 cambio en `/api/orders/route.ts` (eliminar insert en tips) o 1 cambio en `webOrderConfirmationService` (verificar existente)
2. **Reserva de stock** — Al crear web_order, incrementar qty_reserved; al confirmar/cancelar, ajustar

### Prioridad 2 — Integración financiera (Fase E propuesta)
3. Registro de pagos desde webhooks
4. Facturación automática desde sales
5. Asientos contables

### Prioridad 3 — Fase D planificada
6. Delivery + Conductores en website
7. Favoritos
8. Estimación de tiempo
