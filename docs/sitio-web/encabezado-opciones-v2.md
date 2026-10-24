# Encabezado: opciones del editor y render público

El render de la tienda lee ahora `header_builder` y `mobile_header` del documento V2. Esos contratos y los controles ya existían en el ERP, pero `main` de la tienda no tenía sus componentes. Se reaprovecharon selectivamente los renderers de los PR #34 y #33 de la tienda; no se fusionaron esas ramas. Los helpers puros se mantienen idénticos a los del ERP.

Sin estos campos el lector devuelve `null` y conserva las variantes, colores y espaciados anteriores. No hay migración ni backfill para este bloque: la configuración se guarda en el JSON del borrador al editarla. Revertir el código devuelve el render anterior; las claves opcionales permanecen almacenadas y pueden volver a interpretarse después. No se modificaron ajustes ni publicaciones de clientes.

## Comportamiento

- Segundo botón: lee los ajustes efectivos, también en el celular. Al activarlo el editor pide un destino en lugar de inventar un número de contacto. Una URL externa se abre con `noopener noreferrer`. El destino especial `whatsapp` necesita el número configurado del sitio; el inspector explica cómo configurarlo o usar un enlace propio. Sin ese dato no se presenta como una acción utilizable.
- Buscador: seis apariencias de barra (`bar`, `mini`, `mega`, `pill_floating`, `outlined`, `underline`) y un panel desde ícono. Borde, color, radio, sombra, ancho, glifo, posición y botón conservan los mismos resultados y búsqueda por Enter. El botón de buscar envía el formulario; se eliminó el selector de categorías decorativo que traía la propuesta. Las barras nuevas aparecen también en móvil, salvo una presentación móvil elegida expresamente en el documento.
- Íconos: contenedor común o por acción, con forma, fondo, borde, sombra y estados de hover. El lector conserva el círculo anterior cuando no hay configuración nueva.
- Menús: varias instancias en zonas de topbar, header y fila de menú. El menú móvil respeta el dropdown superior y el lateral izquierdo/derecho incluso con menús del constructor.
- Menú móvil: se conectan el contrato y los componentes de paneles, distribución y barra tipo app. El corte de las variantes móviles usa `lg` para que la tableta no quede sin encabezado.
- Carrito: las acciones `cart` de la barra tipo app y `Pedir` de ambas barras rápidas llaman al carrito del layout. No navegan a la carta.
- Populares: desaparecen los términos de ejemplo. `/api/products/popular` resuelve organización y sede por el contexto, reutiliza el catálogo cacheado y devuelve hasta cinco nombres con ventas reales, ordenados por `sales_count`. Sin ventas, la lista queda vacía. El endpoint no acepta un id de organización del navegador ni añade consultas SQL nuevas.
- Vista previa: las claves JSON de constructor/móvil requieren mayor profundidad que los valores simples. La validación admite hasta ocho niveles únicamente para esas dos claves; conserva los límites de entradas, longitud y origen del mensaje.

## Verificación

```
node scripts/verify-constructor-header.mjs
node scripts/verify-menu-movil.mjs
node scripts/verify-header-render.cjs
node scripts/verify-busqueda-org.mjs
```

El render usa los componentes reales que comparten borrador y publicación, con mocks de infraestructura explícitos. Comprueba apariencias de buscador, colores, glifos, posiciones, cajas de íconos, dos menús simultáneos, CTA secundario, acciones de carrito y aislamiento del endpoint de populares. Los escenarios se recorren con las combinaciones de vista previa/publicado y escritorio/celular; las comprobaciones de geometría e interacción del navegador se conservan en la evidencia de integración.

En el ERP: `constructorHeader.render.test.tsx` y `zonaGlobal.test.tsx` comprueban que los controles usan el kit, que abrir/navegar no escribe y que los valores elegidos se guardan. Los selectores de las pestañas Constructor y Celular, y los del inspector de encabezado, usan el componente `Select` del kit v2.

Las pruebas locales no acreditan un despliegue público: la revisión visual de la web real depende de desplegar los PR contra `main` y de la configuración de publicación documentada en `publicacion-confirmada.md`.
