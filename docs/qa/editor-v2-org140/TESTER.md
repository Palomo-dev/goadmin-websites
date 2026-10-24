# Evidencia del editor y la tienda: org 140

Esta evidencia cubre render local e interacciones aisladas. **No confirma un despliegue, la tienda en vivo ni una sesión autenticada del editor.** La entrega permanece pendiente de esas comprobaciones.

[Galería de PNG antes/después](GALLERY.md) · [Galería HTML descargable](index.html) · [Reporte de capturas](capture-report.json) · [Reporte de interacciones](interaction-report.json)

## Método y resultados

- Antes: `goadmin-websites` `origin/main`, commit `cd51611b2271ad69f36a9c7bba5cde1557a44220`.
- Después: árbol de trabajo de `fix/editor-tienda-opciones-v2`, sobre `main`.
- 184 capturas: 46 escenarios × antes/después × escritorio de 1440 px y celular de 390 px. No se detectaron desbordamientos horizontales ni bloques colapsados. Cargaron las 88 imágenes presentes en esos renders.
- 4 capturas adicionales de interacciones móviles. Pasaron 8 comprobaciones: abrir y cerrar el menú superior y los laterales izquierdo/derecho; ejecutar el callback de «Pedir» sin navegar; cerrar el diálogo de prueba.
- El tester ejecutó independientemente 573 comprobaciones y pruebas de los scripts y suites enumerados abajo. Todas pasaron. Las 8 comprobaciones de navegador se ejecutaron por el agente principal y se revisó su reporte.
- Se revisaron visualmente cinco capturas finales representativas: producto en celular, categoría en escritorio, segundo botón en celular, contador/stock en escritorio y menú superior abierto en celular. También se revisaron muestras de la ronda anterior: tarjeta superpuesta, posiciones del botón, mosaico de categorías, distribución de banners y buscador.

Los productos, precios, categorías y fotos provienen de un snapshot público de org 140, obtenido mediante MCP después de validar el esquema. No se publica ese documento completo. Se armaron configuraciones de demostración para activar las opciones nuevas: **reseñas 4.7/12, stock de 3 unidades y una oferta a una hora son datos de demostración**; no son afirmaciones sobre ventas, existencias u ofertas vigentes.

Las capturas usan SSR de componentes reales y CSS compilado por separado desde cada versión. En el caso del bloque base se renderizaron `ProductDetailRenderer`, `CategoryDetailRenderer`, `SectionRenderer` y sus subcomponentes reales. Se simularon dependencias de infraestructura, como navegación de Next, moneda, favoritos y acciones externas. Las imágenes públicas se almacenaron temporalmente fuera del repositorio para capturarlas sin fallos de red. No se copiaron esos archivos, el snapshot, credenciales, perfiles del navegador ni scripts del entorno a este directorio.

Las interacciones usan React real con `MobileMenuShell` y `MobileBottomNav`. El callback de carrito se representa con un diálogo de prueba: **no es el carrito completo ni prueba checkout, pagos o pedidos**. El primer intento de «Pedir» falló por un fixture de dos ítems: el parser exige tres y activó la barra predeterminada; el selector había pulsado «Buscar». Se corrigió el fixture a tres ítems y se añadió una aserción de la etiqueta «Pedir» antes del clic. La ejecución corregida pasó las ocho comprobaciones.

## Cobertura de los 25 puntos

Todos los enlaces a la galería incluyen antes/después en escritorio y celular, salvo las interacciones móviles indicadas. **Ningún punto se declara comprobado en producción ni en el editor autenticado.**

| Punto | Evidencia disponible | Qué permanece sin comprobar |
| --- | --- | --- |
| 1. Bloque base de producto/categoría | [Producto con solo beneficios](GALLERY.md#1-product-base), [categoría con solo cabecera](GALLERY.md#1-category-base). Render completo real. Script `verify-detalle-urgencia.mjs`, 36 comprobaciones, incluye composición preview/publicado y bloques ocultos/incompletos. | Navegación en la vista previa autenticada y en la tienda desplegada. |
| 2. Publicación confirmada y aviso pendiente | Endpoint real aislado: 27 comprobaciones; hook de publicación: 4 pruebas; servicio de revalidación: 5 pruebas. Se cubren ACK pendiente, error, reintento idempotente y una edición concurrente. | Sin captura del estado «Publicando…» en el ERP, ni confirmación contra CDN/despliegue real. |
| 3. Cambios sin editar | Tests del hook para guardar sin modificación y pruebas de montaje de campos/predeterminados. | Recorrer las pestañas reales del editor con sesión y comprobar «Platos estrella». |
| 4. Segundo botón | [Botón configurado con enlace explícito](GALLERY.md#4-secondary), incluido celular. Script de render del header. | WhatsApp con el contacto real de la organización y navegación desde el editor/tienda desplegada. |
| 5. Estilos de buscador | [Mini](GALLERY.md#5-mini), [barra](GALLERY.md#5-bar), [mega](GALLERY.md#5-mega), [flotante](GALLERY.md#5-pill_floating), [contorno](GALLERY.md#5-outlined), [subrayado](GALLERY.md#5-underline) y [overlay](GALLERY.md#5-icon_overlay). Contratos y render del header. | Búsqueda de productos real, resultados y todas las combinaciones de color, ícono, radio y posición en una sesión completa. |
| 6. Contenedores de íconos | [Círculo](GALLERY.md#6-circle), [cuadrado](GALLERY.md#6-square), [semirredondeado](GALLERY.md#6-semi) y [sin contenedor](GALLERY.md#6-none). Contratos/render adicionales. | Hover real y todas las combinaciones por cada ícono dentro del header completo desplegado. |
| 7. Varios menús | [Menú de categorías y de páginas en zonas diferentes](GALLERY.md#7-multiple-menus). | Abrir cada megamenú y sus enlaces en el sitio completo; configurar los menús desde el ERP autenticado. |
| 8. Dropdown superior y lado lateral | [Superior](screenshots/interacciones/8-top_dropdown-mobile.png), [izquierda](screenshots/interacciones/8-drawer_left-mobile.png), [derecha](screenshots/interacciones/8-drawer_right-mobile.png). Clics, geometría de anclaje y cierre con overlay en componentes reales; 20 contratos móviles. | Integración de cada menú con la navegación y el estado del sitio completo. No hay comparativa antes/después de estos paneles abiertos. |
| 9. «Pedir» abre carrito | [Callback de carrito ejecutado](screenshots/interacciones/9-pedir-carrito-mobile.png). El test exige la etiqueta «Pedir» y comprueba que la URL no cambia. | Abrir y operar el carrito real. El diálogo visible es un fixture, no el carrito de la tienda. |
| 10. Populares de la organización | Contrato de populares y render de header; se ejecutó `verify-header-render.cjs`, 147 comprobaciones. | Sin captura del desplegable con los más vendidos reales ni comparación entre organizaciones en el despliegue. |
| 11. Hero pegado al header | Suite `zonaGlobal.test.tsx`: control de espaciado y cambios de la primera sección. | Sin captura del header y hero completos juntos para todas las variantes; sin comprobar el hueco en el despliegue. |
| 12. Banners | [Uno grande y dos pequeños](GALLERY.md#12-hero_plus_2), [dos iguales](GALLERY.md#12-split_50), [tres](GALLERY.md#12-triple_center), [apilados](GALLERY.md#12-full_stack), [círculos](GALLERY.md#12-circles). Se ve «Promociones». El script de banners/categorías/listado cubre otras distribuciones y estilos. | Todas las combinaciones por banner y sus interacciones, especialmente hover/carrusel en el sitio completo. |
| 13. Fondo de imagen | Suite `imagenSeccion.render.test.tsx`: selector y subida simulados. El script de banners comprueba el traslado de `imagenFondo` a `bg_image`. | Sin subida de un archivo real a Storage ni captura del selector y resultado dentro del editor autenticado. |
| 14. Posición del botón | [Centrado](GALLERY.md#14-below), [izquierda](GALLERY.md#14-below_left), [derecha](GALLERY.md#14-below_right), [junto al precio](GALLERY.md#14-beside_price). El script de tarjetas cubre las 11 posiciones por render. | Capturas de las otras siete posiciones e interacciones de hover/táctil en el sitio completo. |
| 15. Tarjeta superpuesta | [Texto sobre imagen y degradado](GALLERY.md#15-overlay). | Configurar y publicar desde el ERP autenticado. |
| 16. Alineación 3×3 | [Arriba/izquierda](GALLERY.md#16-top-left), [centro](GALLERY.md#16-middle-center), [abajo/derecha](GALLERY.md#16-bottom-right). Las nueve combinaciones tienen comprobación SSR en tarjetas. | Capturas de las otras seis combinaciones y configuración desde el ERP autenticado. |
| 17. Posición de reseñas | [Arriba del título](GALLERY.md#17-above_title), [debajo del título](GALLERY.md#17-below_title), [debajo del precio](GALLERY.md#17-below_price). | Datos de reseñas reales en una sesión completa. Los valores usados para estas demostraciones son sintéticos. |
| 18. Formas de etiqueta | [Redondeada](GALLERY.md#18-rounded), [semirredondeada](GALLERY.md#18-semi). El script de tarjetas comprueba también las cuatro formas anteriores. | Configuración y publicación desde el ERP autenticado. |
| 19. Acción «Elegir» | [Render del enlace](GALLERY.md#19-choose). El script de tarjetas comprueba el destino al detalle y la ausencia de controles anidados. | Abrir un selector con variantes/modificadores reales y completar la selección antes de agregar. La prueba disponible no verifica un modal selector. |
| 20. Predeterminados de etiquetas | Ocho pruebas de campos de tarjeta: montaje, repetidores, alineación y valores predeterminados. | Sin capturas o grabación del contador de etiquetas al abrir el editor por primera vez. |
| 21. Diseños de categorías | [Círculos](GALLERY.md#21-circle), [tarjetas](GALLERY.md#21-card_bottom), [píldoras](GALLERY.md#21-pill), [íconos](GALLERY.md#21-minimal_icon), [mosaico](GALLERY.md#21-bento). | Configurar y publicar desde el ERP autenticado; todas las combinaciones con imágenes de categorías. |
| 22. Límite y paginación de productos | Script de banners/categorías/listado: límite 6 de 19 en grid/lista/carrusel; tamaño de página, segunda página y acumulación de «ver más». | Sin captura de lista/paginación ni clic de página en el sitio completo. |
| 23. Beneficios e íconos | [Círculo](GALLERY.md#23-circle), [cuadrado](GALLERY.md#23-square), [redondeado](GALLERY.md#23-rounded), [sin contenedor](GALLERY.md#23-none). La captura del punto 1 muestra el beneficio añadido junto al bloque base conservado. | Todas las variantes, tamaños y colores en el editor y en la tienda desplegada. |
| 24. Contador y urgencia | [Producto](GALLERY.md#24-producto), [carrito](GALLERY.md#24-carrito), [checkout](GALLERY.md#24-checkout). SSR de contador y stock de demostración. Tests de presencia: hook 18, endpoint 32; aislamiento de stock 18; suite de controles de urgencia. | Presencia real entre navegadores, datos de stock reales, paso del tiempo, carrito/checkout completos y editor autenticado. Las capturas no son ofertas ni existencias vigentes. |
| 25. Escape | `atajosEditor.test.tsx`: Escape cierra el popover, conserva selección y paneles y no deselecciona al pulsarlo sobre la ventana. | Sin captura o recorrido del editor autenticado. |

## Pruebas ejecutadas por el tester

Los comandos de la tienda se ejecutaron desde `goadmin-websites`; las suites Jest, desde el repositorio hermano `go-admin-erp`. Son pruebas locales con dependencias simuladas según cada fuente; los conteos de los scripts incluyen aserciones de contrato y SSR, no sesiones de navegador.

| Comando | Resultado |
| --- | --- |
| `node scripts/verify-product-card-render.cjs` | 120 comprobaciones correctas |
| `node scripts/verify-banners-categorias-listado.cjs` | 70 comprobaciones correctas |
| `node scripts/verify-publicacion-confirmada.cjs` | 27 comprobaciones correctas |
| `node scripts/verify-detalle-urgencia.mjs` | 36 comprobaciones correctas |
| `node --disable-warning=ExperimentalWarning scripts/verify-constructor-header.mjs` | 37 comprobaciones correctas |
| `node scripts/verify-header-render.cjs` | 147 comprobaciones correctas |
| `node --disable-warning=ExperimentalWarning scripts/verify-menu-movil.mjs` | 20 comprobaciones correctas |
| `node scripts/verify-presencia-hook.cjs` | 18 comprobaciones correctas |
| `node scripts/verify-presencia-pagina.cjs` | 32 comprobaciones correctas |
| `node scripts/verify-stock-publico.cjs` | 18 comprobaciones correctas |
| `npx jest src/components/sitio-web/editor/inspector/__tests__/camposTarjeta.render.test.tsx --runInBand --silent` | 8 pruebas correctas |
| `npx jest src/components/sitio-web/__tests__/useSitioV2.publicacion.test.tsx --runInBand --silent` | 4 pruebas correctas |
| `npx jest src/lib/services/website/__tests__/revalidarPublicacionWeb.test.ts --runInBand --silent` | 5 pruebas correctas |
| Jest: `imagenSeccion.render.test.tsx`, `urgencia.render.test.tsx`, `atajosEditor.test.tsx`, `zonaGlobal.test.tsx` con `--runInBand --silent` | 31 pruebas correctas |

Total independiente: **573**. Reporte del navegador: **8** comprobaciones correctas y cuatro capturas adicionales. No se probó ni se ejecutó un pedido, un pago o una publicación real como parte de esta evidencia. No se asigna aprobación al alcance completo.
