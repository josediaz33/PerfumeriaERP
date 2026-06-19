# JODA Parfums ERP

> Sistema de gestión integral para negocios de perfumería y decants — 100% offline, corre en el navegador sin necesidad de servidor ni base de datos externa.

[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Dexie.js](https://img.shields.io/badge/Dexie.js-v5-FF6B35)](https://dexie.org/)

---

## Estado actual — v2.0 (Fase 2 en curso)

| Fase | Estado | Descripción |
|------|--------|-------------|
| **Fase 1 — MVP Operativo** | ✅ Completa | Inventario, ventas, logística, contabilidad, presupuestos, clientes, utilidades |
| **Fase 2 — Branding y Catálogo** | 🔄 En curso | Identidad visual, catálogo exportable, seguridad por PIN |
| **Fase 3 — Analytics** | 📋 Planificada | Dashboard avanzado, reportes, exportaciones extendidas |
| **Fase 4 — UX avanzada** | 📋 Planificada | Color de acento configurable, modo oscuro, accesos rápidos |
| **Fase 5 — Sourcing** | 📋 Planificada | Comparador de proveedores, integración pedido ↔ sourcing |

---

## Descripción

JODA Parfums ERP es una aplicación web diseñada específicamente para negocios de perfumería que manejan productos sellados, testers y producción de decants (fraccionamiento). Cubre el ciclo completo: desde la gestión de stock y producción hasta presupuestos, logística de entrega, contabilidad y análisis de rentabilidad.

Toda la información se almacena localmente en el navegador mediante **IndexedDB** (Dexie.js v5), lo que garantiza privacidad total, uso sin conexión y cero costos de infraestructura.

---

## Módulos

| Módulo | Descripción |
|--------|-------------|
| **Dashboard** | KPIs del mes: ventas, utilidad, stock crítico, pedidos pendientes |
| **Inventario** | Productos por tipo (sellado / tester / decant\_source), lotes con CPP ponderado (FIFO), alertas de stock mínimo, fotos de producto, apertura de botella para decants |
| **Decants** | Producción de frascos, control de ML, historial trazable por origen |
| **Ventas** | Registro de ventas directas de sellados, decants, parciales e insumos con desglose de ganancia por ítem |
| **Logística** | Pipeline de pedidos locales con validación de stock, señas/pagos anticipados, comisiones tarjeta/QR, entrega con cobro de saldo o vuelto digital, gasto de envío contabilizado |
| **Contabilidad** | Movimientos contables con filtros por mes, tipo y cuenta; eliminación de transferencias con reversión doble |
| **Cuentas** | Saldos en tiempo real, historial por cuenta y recálculo desde movimientos |
| **Proveedores** | Órdenes de compra internacionales con recepción, distribución de flete y edición en cascada |
| **Presupuestos** | Presupuestos PDF por cliente con análisis de rentabilidad interno y conversión a pedido; aplica descuentos por ítem y descuento global |
| **Clientes** | Directorio de clientes con historial de compras y generación de etiquetas de envío |
| **Utilidades** | Análisis de rentabilidad histórica y distribución de ganancias |
| **Catálogo** | Vista de productos con fichas individuales, exportación HTML interactiva compatible con iOS/WhatsApp |
| **Configuración** | Parámetros del negocio, tipo de cambio USD/PYG, logo, PIN de acceso |

---

## Novedades — Fase 2

### Identidad visual y seguridad (BRAND)

#### PIN de acceso (BRAND-03)
- Pantalla de bloqueo con keypad numérico, logo del negocio y nombre de la empresa
- PIN configurable de 4 a 6 dígitos desde Configuración → "Protección con PIN"
- El PIN se almacena en IndexedDB; la sesión se mantiene activa durante el mismo contexto de navegador mediante `sessionStorage`
- Al eliminar el PIN, la app queda sin bloqueo

#### Logo y nombre en sidebar (BRAND-04)
- El sidebar muestra el logo configurado (redondeado, `rounded-xl`) junto al nombre del negocio
- Si no hay logo, muestra la inicial del nombre sobre fondo violeta
- Ambos son reactivos: cambian en tiempo real al guardar en Configuración sin recargar la página

### Catálogo mejorado (CATX)

#### Ficha individual de producto (CATX-06)
- Clic en cualquier tarjeta del catálogo abre un modal con imagen ampliada, badges de tipo y familia olfativa, nombre, marca, concentración/tamaño, notas olfativas y precios
- Para decants: muestra todos los tamaños con precio configurado (3ml, 5ml, 10ml, 30ml) independientemente de si existe un lote físico preparado

#### Exportación HTML autocontenida (CATX-07 / CATX-08)
- Genera un único archivo `.html` con todas las imágenes embebidas en base64 — no requiere internet para visualizarse
- **Modales via CSS `:target`**: cada tarjeta es un `<a href="#p-{id}">` nativo; el modal es un `<div id="p-{id}">` activado por CSS `.mow:target { display: flex }`. Funciona sin JavaScript, incluyendo iOS Quick Look (apertura desde WhatsApp)
- Botón cierre y backdrop navegan a `#top` sin requerir JS
- Búsqueda con `oninput` + `onkeyup` como progressive enhancement para navegadores con JS habilitado
- Descarga via `<a download>` para evitar bloqueo de popups en funciones async
- Diseño responsive: grilla de 2 columnas en móvil, auto-fill en desktop

### Fixes de esta fase

| Módulo | Fix |
|--------|-----|
| **Logística** | Anular entrega revierte correctamente todos los movimientos de la entrega (cobro + comisión + envío), preservando las señas ya registradas |
| **Logística** | Gasto de envío pagado por la empresa se registra como `expense/shipping` al confirmar la entrega; selector de cuenta disponible incluso cuando el saldo fue cubierto íntegramente por señas |
| **Logística** | `totalCost` del pedido incluye el gasto de envío cuando lo absorbe el negocio |
| **Contabilidad** | Eliminar una transferencia ahora revierte ambos saldos (débito en origen, crédito en destino) |
| **Contabilidad** | Botón eliminar disponible para todos los tipos de movimiento, incluyendo transferencias |
| **Presupuestos** | Al convertir a pedido, el precio de cada ítem aplica el descuento individual del ítem multiplicado por el descuento global del presupuesto |
| **Ventas** | Agregar al carrito el mismo producto con diferente precio crea una línea separada en lugar de fusionar cantidades |
| **Catálogo** | Precios de decants tomados de `product.price3ML/5ML/10ML/30ML` — no depende de que existan lotes físicos preparados para mostrar el precio |

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Framework UI | [React 19](https://react.dev/) + [TypeScript 6](https://www.typescriptlang.org/) |
| Build tool | [Vite 8](https://vite.dev/) |
| Estilos | [Tailwind CSS v4](https://tailwindcss.com/) (plugin nativo de Vite) |
| Base de datos | [Dexie.js v5](https://dexie.org/) sobre IndexedDB del navegador |
| Estado reactivo | `useLiveQuery` de dexie-react-hooks |
| Routing | [React Router v7](https://reactrouter.com/) |
| Exportación PDF | [jsPDF](https://github.com/parallax/jsPDF) |
| Iconografía | [Lucide React](https://lucide.dev/) |

---

## Arquitectura

```
src/
├── db/
│   ├── db.ts          # Instancia Dexie + versiones del schema + seed inicial
│   └── types.ts       # Interfaces TypeScript para todas las entidades
├── lib/
│   ├── format.ts      # Helpers: fmtPYG, fmtDate, today, nowISO
│   ├── images.ts      # compressImage, blobToBase64, base64ToBlob, createObjectURL
│   └── customers.ts   # upsertCustomer
├── components/
│   ├── layout/        # Sidebar, Layout, LockScreen
│   └── ui/            # Button, Card, Modal, Input, Select, Badge, PageHeader...
└── pages/             # Un archivo por módulo de negocio
```

---

## Flujo principal de venta

```
[Opción A] Ventas directas
   ↓
   Sale + SaleItem + movimiento contable

[Opción B] Presupuesto → Pedido
   Presupuesto (borrador → enviado → aceptado)
        ↓  [botón "Crear pedido"]
   Logística — Pendiente
        ↓  [valida stock + insumos]
   Logística — En preparación  ← descuenta ML/stock, crea DecantBatch, descuenta frascos
        ↓
   Logística — Listo
        ↓  [registra cobro / confirma si todo fue señado]
   Logística — Entregado       ← crea Sale + SaleItem + movimiento contable + gasto de envío si aplica
        ↓
   Aparece en Ventas, Contabilidad y Utilidades
```

---

## Tipos de producto

| Tipo | Descripción | Stock | CPM |
|------|-------------|-------|-----|
| `sealed` | Botella sellada para venta | `stockSealed` (unidades) | — |
| `tester` | Tester para venta (precio diferente) | `stockSealed` (unidades) | — |
| `decant_source` | Botella abierta, fuente de decants | `stockOpenML` (ml) | `costPYG` |
| cualquier otro abierto | Sellado/tester abierto para decants | `stockOpenML` (ml) | `costPYG / sizeML` |

---

## Reglas de negocio clave

### CPM (costo por mililitro)
```
product.type === 'decant_source'  →  costPYG
cualquier otro abierto            →  costPYG / sizeML
```

### Costo de un decant
```
costoDecant = CPM × sizeML + supply.costPYG (frasco)
```

### FIFO en lotes
Al preparar un pedido o vender, `quantityRemaining` de cada `StockEntry` se decrementa desde el lote más antiguo hasta cubrir la cantidad requerida.

### Cascade de costos al editar lotes
Editar el costo de un lote calcula `costDelta = nuevoTotal - anteriorTotal` y lo propaga al `Movement` contable vinculado y al saldo de la `Account` correspondiente.

### Señas / pagos anticipados en pedidos
Cada pago anticipado genera un `Movement` de ingreso inmediato. Al entregar, se cobra solo `max(0, totalAmount - señaTotal)`. Si el saldo es 0, la entrega se confirma sin requerir cuenta de cobro (pero se puede asignar cuenta para registrar gasto de envío si aplica).

### Comisiones tarjeta / QR
Al cobrar una seña o el saldo de entrega con método `card` o `qr`, se aplica **3% + IVA 10% = 3,3%** sobre el monto cobrado. Se generan dos movimientos: ingreso bruto en la cuenta elegida y gasto de comisión (`category: 'services'`) en la misma cuenta. La comisión se descuenta de la utilidad final del pedido (`totalProfit`).

### Vuelto digital en cobro en efectivo
Al entregar con método `cash`, se puede activar "Recibí efectivo y transferí el vuelto". Se ingresa el efectivo recibido, el vuelto se calcula automáticamente (`cashReceived − saldo`) y se elige una cuenta de origen (billetera digital). Genera: ingreso del efectivo bruto en la cuenta de cobro y gasto del vuelto en la cuenta seleccionada.

### Gasto de envío en pedidos
Si `order.shippingPaidBy === 'business'` y `shippingCost > 0`, al confirmar la entrega se registra un `Movement` de tipo `expense/shipping` en la cuenta elegida. Este gasto se incluye en `totalCost` del pedido para el cálculo de rentabilidad.

### Pre-creación de productos al hacer pedido a proveedor
Al crear un pedido a proveedor, los productos que aún no existen en inventario se crean automáticamente con `stockSealed: 0`. Esto permite armar pedidos de Logística con esos productos antes de recepcionar el pedido. El stock real se agrega al recepcionar normalmente.

### Insumos en pedidos con decants
Al pasar un pedido a "Preparar", el sistema descuenta automáticamente el frasco correspondiente por cada ítem de tipo `decant` (búsqueda por `sizeML`). Por eso el array `supplies[]` del `LocalOrder` es para insumos adicionales (etiquetas, packaging, etc.) y **no** debe incluir los frascos de decant para evitar doble descuento.

### Trazabilidad Presupuesto ↔ Pedido
- `Budget.localOrderId` — ID del `LocalOrder` creado desde este presupuesto
- `LocalOrder.budgetId` — ID del `Budget` de origen
- Si el pedido se elimina desde Logística, `localOrderId` se limpia en el presupuesto y el botón "Crear pedido" vuelve a aparecer

### Precios de decants en catálogo
Los precios visibles en el catálogo (app y HTML exportado) se toman de `product.price3ML`, `product.price5ML`, `product.price10ML`, `product.price30ML`. No dependen de que existan lotes físicos (`DecantBatch`) preparados para esos tamaños.

---

## Módulos en detalle

### Inventario
- **Tipos de producto**: sellado, tester (se vende como sellado a precio diferente) y decant\_source
- **Abrir para decants**: botón que descuenta 1 unidad sellada/tester por FIFO y suma los ML al stock abierto; permite convertir cualquier producto en fuente de decants
- **Lotes (StockEntry)**: costo USD + cotización → costo PYG; CPP recalculado al agregar lotes
- **Edición de lotes en cascada**: cambiar precio propaga el delta al movimiento contable y al saldo de la cuenta
- **Fotos de producto**: hasta N fotos por producto con compresión automática (800px), thumbnails con hover-delete
- **Visible en catálogo**: toggle por producto para controlar qué aparece en el catálogo público
- **Ingreso rápido con trazabilidad**: al agregar stock con proveedor seleccionado, se crea un `Order` con `status: 'received'` que aparece en el historial del proveedor

### Proveedores
- Recepción de pedidos: genera `StockEntry` por producto, distribuye el flete proporcionalmente, recalcula CPP
- **Edición de pedidos recibidos**: modal con cambio de cotización, flete y precios por ítem; cascade completo a stock entries, CPP de productos, movimiento y saldo
- **Pago anticipado**: al crear un pedido o desde la tabla de pedidos activos, se puede registrar el pago del total de productos antes de recepcionar. Al recepcionar un pedido prepagado, solo se descuenta el envío
- **Pre-creación de productos**: al crear un pedido, los productos nuevos se crean en inventario con `stockSealed: 0` para poder usarlos en Logística antes de recepcionar

### Presupuestos
- **Tipos de línea**: Sellado, Tester, Decant (tamaños 3/5/10/30ml), Parcial, Personalizado
- **Auto-llenado**: seleccionar producto + tipo completa descripción y precio sugerido
- **Análisis de rentabilidad interno** (no aparece en PDF):
  - Costo estimado por línea según tipo
  - Ganancia unitaria y margen % con colores de alerta
  - Totales: costo, ingreso neto con descuento, ganancia estimada, margen general
- **Export PDF**: diseño con header oscuro/dorado, tabla de ítems, subtotal con descuento, total
- **Conversión a pedido**: presupuesto aceptado → un click → `LocalOrder` en Logística con ítems y estado Pendiente; el precio aplica descuento por ítem × descuento global; frascos para decants se descontarán al preparar (no se pre-cargan en `supplies[]`)

### Logística
- Validación de stock antes de preparar: unidades selladas, ML abiertos, frascos e insumos
- Al preparar: descuenta stock del producto + FIFO sobre lotes + frascos por ítem decant + insumos de venta + crea `DecantBatch`
- **Pagos anticipados** (señas) con movimiento contable inmediato; saldo calculado al entregar; admiten método tarjeta/QR con comisión automática
- **Entrega**: fecha editable, métodos efectivo/transferencia/tarjeta/QR/otro; comisión automática en tarjeta y QR; vuelto digital opcional en efectivo; gasto de envío registrado si lo paga el negocio
- **Reversión a Pendiente**: restaura ML/stock, elimina DecantBatch, repone frascos e insumos
- **Anular entrega**: revierte cobros de la entrega (principal + comisión + envío) preservando señas ya registradas; devuelve el pedido a estado Listo
- **Eliminar venta de logística**: revierte cobro, restaura stock (FIFO + frascos + ML + insumos), elimina `DecantBatch` y el pedido asociado

### Catálogo
- **Vista interna**: grid responsive de productos con foto, badge de tipo y familia olfativa, precios por tamaño
- **Ficha de producto (CATX-06)**: modal al clic con imagen ampliada, todos los datos del producto y precios por tamaño configurados
- **Export HTML (CATX-07/08)**: archivo autocontenido con imágenes en base64, modales CSS `:target` sin JS, búsqueda como enhancement, diseño responsive; compatible con iOS Quick Look / WhatsApp
- **Export PDF**: tabla con productos filtrados, branding oscuro/dorado, logo del negocio

### Cuentas
- Historial por cuenta: filtro de mes, resumen ingresos/egresos/saldo del período, tabla de movimientos
- **Recalcular desde movimientos**: herramienta de corrección que suma todos los movimientos de la cuenta para corregir inconsistencias históricas

### Utilidades
- **6 KPIs**: utilidad acumulada, utilidad del mes, distribuido, sin distribuir, margen promedio, ticket promedio
- **Evolución mensual**: tabla con mini-barras de ingresos/costos/ganancia por mes (últimos 12); margen coloreado (verde ≥40%, naranja 20–39%, rojo <20%)
- **Detalle de ventas**: sección colapsable, filtro por mes en chips, tabla individual por venta con margen %
- **Distribución**: calculadora con porcentajes configurables; registra distribución por período. Si hay deuda personal activa, muestra desglose: porción bruta → deuda cubierta → neto disponible (informativo)
- **Historial de distribuciones clickeable**: modal con ventas del período, desglose de los 3 destinos y métricas
- **Balance personal**: panel con total retirado, devuelto y saldo pendiente; historial entrelazado; botones "Retirar" y "Devolver"

---

## Próximo a desarrollar

### Fase 2 — pendientes

| ID | Feature | Descripción |
|----|---------|-------------|
| BRAND-06 | Color de acento configurable | Permitir cambiar el color primario de la UI (violeta) desde Configuración |
| CATX-09 | Botón "Pedir por WhatsApp" en HTML | En cada modal del catálogo exportado, botón que arma un mensaje de WhatsApp pre-llenado con el producto y precio seleccionado |

### Fase 3 — Analytics

| ID | Feature | Descripción |
|----|---------|-------------|
| ANA-01 | Dashboard avanzado | Gráficos de evolución, top productos, comparativa mensual |
| ANA-02 | Reporte de stock | Vista consolidada de stock crítico, rotación y valor en inventario |
| ANA-03 | Reporte de clientes | Frecuencia de compra, ticket promedio, productos favoritos por cliente |

### Fase 4 — UX

| ID | Feature | Descripción |
|----|---------|-------------|
| UX-01 | Modo oscuro | Toggle claro/oscuro con persistencia en config |
| UX-02 | Accesos rápidos | Atajos de teclado para acciones frecuentes (nueva venta, nuevo pedido) |
| UX-03 | Notificaciones internas | Alertas de stock mínimo y pedidos pendientes visibles en el sidebar |

### Fase 5 — Sourcing

| ID | Feature | Descripción |
|----|---------|-------------|
| SOURCE-01 | Módulo de sourcing | Comparador de precios entre proveedores para el mismo producto |
| SOURCE-02 | Integración pedido ↔ sourcing | Flujo presupuesto → solicitud de sourcing → pedido a proveedor |
| MAY-08 | sobrePedido → SourcingRequest | Los ítems marcados "sobre pedido" en presupuesto generan solicitud de sourcing automática |

---

## Instalación y uso

### Requisitos previos
- [Node.js](https://nodejs.org/) v18 o superior
- npm v9 o superior

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/josediaz33/PerfumeriaERP.git
cd PerfumeriaERP

# 2. Instalar dependencias
npm install

# 3. Iniciar servidor de desarrollo
npm run dev
```

Abre `http://localhost:5173`. La base de datos se crea automáticamente con datos semilla en la primera ejecución: 3 cuentas por defecto y frascos de 3/5/10/30ml.

### Scripts disponibles

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Servidor de desarrollo con HMR |
| `npm run build` | Build de producción (salida en `dist/`) |
| `npm run preview` | Preview del build de producción |
| `npm run lint` | Análisis estático con ESLint |

---

## Consideraciones de despliegue

Al ser una SPA estática sin backend, puede desplegarse en cualquier hosting de archivos estáticos:

- **Vercel / Netlify**: build command `npm run build`, output dir `dist`
- **GitHub Pages**: `npm run build` → servir `dist/`
- **Self-hosted**: servir `dist/` con Nginx o cualquier servidor HTTP

> **Importante:** Cada navegador/dispositivo tiene su propia base de datos local. Los datos no se sincronizan entre dispositivos. Para hacer backup, usar la función de exportación en Configuración → "Exportar datos".

---

## Licencia

Uso privado — todos los derechos reservados © JODA Parfums.
