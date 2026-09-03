# JODA Parfums ERP

> Sistema de gestión integral para negocios de perfumería y decants — 100% offline, corre en el navegador sin necesidad de servidor ni base de datos externa.

[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Dexie.js](https://img.shields.io/badge/Dexie.js-v5-FF6B35)](https://dexie.org/)

---

## Estado actual — v2.5

| Fase | Estado | Descripción |
|------|--------|-------------|
| **Fase 1 — MVP Operativo** | ✅ Completa | Inventario, ventas, logística, contabilidad, presupuestos, clientes, utilidades |
| **Fase 2 — Branding y Catálogo** | ✅ Completa | Identidad visual, catálogo exportable, PIN, color de acento configurable |
| **Fase 3 — Analytics** | 📋 Planificada | Dashboard avanzado, reportes, exportaciones extendidas |
| **Fase 4 — UX avanzada** | 📋 Planificada | Modo oscuro, accesos rápidos, notificaciones internas |
| **Fase 5 — Sourcing** | ✅ Completa | Comparador de proveedores con conversión a pedido; pendiente: MAY-08 |

---

## Descripción

JODA Parfums ERP es una aplicación web diseñada para negocios de perfumería que manejan productos sellados, testers, relojes y producción de decants (fraccionamiento). Cubre el ciclo completo: desde la gestión de stock y producción hasta presupuestos, logística de entrega, contabilidad y análisis de rentabilidad.

Toda la información se almacena localmente en el navegador mediante **IndexedDB** (Dexie.js v5), lo que garantiza privacidad total, uso sin conexión y cero costos de infraestructura.

---

## Módulos

| Módulo | Descripción |
|--------|-------------|
| **Dashboard** | KPIs del mes: ventas, utilidad, stock crítico, pedidos pendientes |
| **Inventario** | Productos por tipo y categoría (fragancia / reloj / general), lotes con CPP ponderado (FIFO), alertas de stock mínimo, fotos de producto, apertura de botella para decants |
| **Decants** | Producción de frascos, control de ML, historial trazable por origen, compra de insumos con débito de cuenta |
| **Ventas** | Registro de ventas directas de sellados, decants, parciales e insumos con desglose de ganancia por ítem; selector de producto con búsqueda y miniaturas |
| **Logística** | Pipeline de pedidos locales con validación de stock, señas navegables a contabilidad, comisiones, entrega y reversión |
| **Contabilidad** | Movimientos con filtros por mes/tipo/cuenta; scroll automático al navegar desde señas |
| **Cuentas** | Saldos en tiempo real, historial por cuenta, edición de transferencias |
| **Proveedores** | Órdenes de compra con recepción, distribución de flete; formulario de pedido con selector inteligente por categoría |
| **Presupuestos** | Presupuestos PDF por cliente con análisis de rentabilidad interno y conversión a pedido |
| **Clientes** | Directorio con historial de compras y etiquetas de envío |
| **Utilidades** | Análisis de rentabilidad histórica y distribución de ganancias |
| **Catálogo** | Vista interna + exportación HTML interactiva con carrito, publicación en GitHub Pages |
| **Comparador** | Solicitudes de cotización a múltiples proveedores, tabla comparativa, conversión a orden de compra |
| **Configuración** | Parámetros del negocio, tipo de cambio, logo, PIN, color de acento |

---

## Novedades — v2.5 (Septiembre 2026)

### Sistema de categorías de producto

El sistema ahora soporta múltiples tipos de producto más allá de las fragancias. El campo `category` en cada producto determina el comportamiento en toda la app:

| Categoría | `sizeML` | Campos fragancia | Label de venta |
|-----------|----------|-----------------|----------------|
| `fragrance` (default) | ✅ Requerido | Concentración + familia olfativa | "sellado" |
| `watch` | ❌ No aplica | Ocultos | "unidad" |
| `general` | ❌ No aplica | Ocultos | "unidad" |

- **Retrocompatibilidad total**: `category === undefined` se trata como `'fragrance'` en toda la app. Sin migración de base de datos.
- **Marcador de código**: todos los puntos provisionales están marcados con `// TODO(PROVISIONAL-CATEGORY)` para su migración a BD relacional en Fase 6.
- **`effSizeML = sizeML ?? 1`**: patrón estándar en cálculos de costo-por-ML para evitar NaN/Infinity en productos sin tamaño.

**Módulos actualizados:**
- **Inventario**: selector de categoría en form; campos de fragancia condicionales; filtro por categoría; propagación de `category` al crear `decant_source`
- **Catálogo**: muestra `'Reloj'` en lugar de concentración/ml para watches (vista interna y HTML exportado)
- **Ventas**: división segura `sizeML ?? 1`; label adaptativo `'unidad'` / `'sellado'`
- **Presupuestos**: división segura `sizeML ?? 1` en líneas decant/parcial
- **Proveedores**: `sizeML` opcional; campo ml oculto en formulario según categoría

### Componente ProductAutocomplete

Nuevo componente reutilizable `src/components/ui/ProductAutocomplete.tsx` que reemplaza todos los selects nativos de producto en la app:

- **`MiniThumb`**: carga la imagen del producto desde IndexedDB (`imageIds[0]`), crea `ObjectURL` con limpieza automática al desmontar
- **Dropdown**: miniatura 32×32 · nombre · marca/tamaño · badge de stock (verde / gris)
- **Búsqueda**: filtra por nombre y marca en tiempo real, hasta 60 resultados
- **UX**: botón × para limpiar, `onBlur` con 150ms para permitir clicks, reset de search via `useEffect` cuando el valor se resetea externamente
- **Usado en**: Ventas, Presupuestos, Logística, Proveedores

### Rediseño del formulario "Nuevo pedido" en Proveedores

Cada línea de producto ahora tiene un layout en tarjeta con 4 filas:

1. **`ProductAutocomplete`** — busca en el inventario con miniatura; al seleccionar auto-rellena nombre, marca, ml, tipo y category
2. **Marca + Nombre manual** — visibles solo cuando no hay producto del inventario seleccionado (`productId === '0'`)
3. **ml + cantidad + precio** — ml oculto para relojes/general; grid 2 o 3 columnas según corresponda
4. **Chips de tipo** — Sellado / Tester / Para decants

### Fix: imágenes PNG/AVIF con fondo negro

`compressImage()` en `src/lib/images.ts` ahora rellena el canvas con blanco (`fillRect`) antes de dibujar la imagen. Esto evita que los píxeles transparentes de PNG/AVIF se conviertan a negro al exportar como JPEG (que no soporta canal alfa).

---

## Novedades — v2.4 (Agosto 2026)

### Logística — Señas navegables y trazabilidad

- Las señas en el card de pedido y en el modal de detalle son clickeables: navegan a `/contabilidad` resaltando el movimiento correspondiente con scroll automático + highlight violeta
- `AdvancePayment.movementId` guarda el ID del movimiento contable para la navegación
- Badge `⚠ Sin registro` en señas sin movimiento asociado (migración de datos legados)
- Fix 'Anular entrega': ya no revierte señas incorrectamente

### Catálogo — Rediseño completo

**Vista interna (ERP):**
- Header custom, pills de tipo + familia olfativa con scroll horizontal
- Toggle `SlidersHorizontal` para rango de precio
- Cards portrait 3/4, badge sobre imagen, "desde Gs. X" para decants

**Catálogo exportado (HTML público):**
- Fondo arena `#f4f2ee`, cards blancas con radio 14px + sombra doble sutil
- Grid `minmax(210px,1fr)` gap 18px, badge dark frosted-glass sobre imagen
- "desde Gs. X" en card, detalle de tamaños en modal; botones negros, header sticky blanco

**Toggle de visibilidad por producto:**
- Verde (`catalogVisible=true`): forzar visible aunque sin stock
- Rojo (`catalogVisible=false`): ocultar siempre
- Naranja (`undefined`): sigue regla de stock

### Decants — Historial con filtros y paginación

- Búsqueda por perfume/marca, pills por tamaño (3/5/10/30ml), picker de mes
- Paginación 15/página con ellipsis inteligente
- Componente `Pagination` reutilizable (`src/components/ui/Pagination.tsx`)

---

## Novedades — v2.3 (Julio/Agosto 2026)

- **Catálogo**: mensaje WhatsApp ecommerce profesional (bullet por ítem + nombre negocio + total)
- **Cuentas**: fecha editable en transferencias + edición de transferencias históricas
- **Decants**: modal de compra de insumos con débito de cuenta seleccionable
- **Inventario**: apertura de botella → `decant_source` separado con CPP ponderado + lote de trazabilidad + botón de migración legacy
- **Logística**: ítem tipo 'Insumo' con `supplyId`; `totalCost` incluye insumos; fix `validItems` supply
- **Ventas**: fila 'Insumos y envío' en detalle de venta
- **Proveedores**: fix eliminar prepago revierte movimiento; fecha editable en pago anticipado; fix `sizeML` en recepción decants

---

## Novedades — v2.2

- Edición de pedidos a proveedor antes de recepcionar (fecha, ítems, cotización, notas)
- Tipo de producto por ítem al crear pedido: Sellado / Tester / Para decants
- Pre-creación y recepción respetan el tipo; productos mismo nombre/distinto tipo = entidades separadas
- Pago anticipado al crear pedido

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
│   ├── images.ts      # compressImage (con relleno blanco para PNG/AVIF), blobToBase64
│   └── customers.ts   # upsertCustomer
├── components/
│   ├── layout/        # Sidebar, Layout, LockScreen
│   └── ui/
│       ├── Button, Card, Modal, Input, Select, Badge, PageHeader
│       ├── CustomerAutocomplete   # Selector de cliente con búsqueda
│       ├── ProductAutocomplete    # Selector de producto con miniatura (MiniThumb)
│       └── Pagination             # Paginación reutilizable con ellipsis
└── pages/             # Un archivo por módulo de negocio
```

---

## Tipos de producto

| Tipo (`type`) | Categoría (`category`) | Stock | CPM |
|---------------|----------------------|-------|-----|
| `sealed` | `fragrance` / `watch` / `general` | `stockSealed` (unidades) | — |
| `tester` | `fragrance` | `stockSealed` (unidades) | — |
| `decant_source` | `fragrance` | `stockOpenML` (ml) | `costPYG` directo |
| sellado/tester abierto | `fragrance` | `stockOpenML` (ml) | `costPYG / (sizeML ?? 1)` |

---

## Reglas de negocio clave

### CPM (costo por mililitro)
```
product.type === 'decant_source'  →  costPYG
cualquier otro abierto            →  costPYG / (sizeML ?? 1)
```

### Costo de un decant
```
costoDecant = CPM × sizeML + supply.costPYG (frasco)
```

### FIFO en lotes
Al preparar un pedido o vender, `quantityRemaining` de cada `StockEntry` se decrementa desde el lote más antiguo hasta cubrir la cantidad requerida.

### Señas / pagos anticipados en pedidos
Cada pago anticipado genera un `Movement` de ingreso inmediato y guarda `movementId` para navegación a Contabilidad. Al entregar, se cobra solo el saldo restante.

### Comisiones tarjeta / QR
Al cobrar con `card` o `qr` se aplica **3% + IVA 10% = 3,3%**. Se generan dos movimientos: ingreso bruto y gasto de comisión. La comisión se descuenta de `totalProfit`.

### Vuelto digital en efectivo
`cashReceived − saldo` = vuelto. Genera: ingreso del efectivo bruto + gasto del vuelto desde la cuenta digital elegida.

### Gasto de envío
Si `shippingPaidBy === 'business'` y `shippingCost > 0`, se registra `expense/shipping` al confirmar entrega e impacta en `totalCost`.

### Pre-creación de productos al hacer pedido
Los productos inexistentes se crean con `stockSealed/stockOpenML: 0` al guardar el pedido, permitiendo armar pedidos de logística antes de recepcionar.

### Trazabilidad Presupuesto ↔ Pedido
- `Budget.localOrderId` — ID del `LocalOrder` creado desde el presupuesto
- `LocalOrder.budgetId` — ID del `Budget` de origen
- Si el pedido se elimina, `localOrderId` se limpia y el botón 'Crear pedido' reaparece

### Categoría retrocompatible
`category === undefined` se trata como `'fragrance'` en todos los módulos. Los productos existentes no requieren migración.

---

## Flujo principal de venta

```
[Opción A] Ventas directas
   ↓
   Sale + SaleItem + movimiento contable

[Opción B] Presupuesto → Pedido
   Presupuesto (borrador → enviado → aceptado)
        ↓  [botón 'Crear pedido']
   Logística — Pendiente
        ↓  [valida stock + insumos]
   Logística — En preparación  ← descuenta ML/stock, crea DecantBatch, descuenta frascos
        ↓
   Logística — Listo
        ↓  [registra cobro / confirma si todo fue señado]
   Logística — Entregado       ← crea Sale + SaleItem + movimiento contable + gasto de envío
        ↓
   Aparece en Ventas, Contabilidad y Utilidades
```

---

## Próximo a desarrollar

### Fase 5 — Sourcing (pendiente menor)

| ID | Feature | Descripción |
|----|---------|-------------|
| MAY-08 | sobrePedido → SourcingRequest | Ítems 'sobre pedido' de presupuesto generan automáticamente una SourcingRequest |

### Fase 3 — Analytics

| ID | Feature | Descripción |
|----|---------|-------------|
| ANA-01 | Dashboard avanzado | Gráficos de evolución, top productos, comparativa mensual |
| ANA-02 | Reporte de stock | Stock crítico, rotación y valor en inventario |
| ANA-03 | Reporte de clientes | Frecuencia de compra, ticket promedio, productos favoritos por cliente |

### Fase 4 — UX

| ID | Feature | Descripción |
|----|---------|-------------|
| UX-01 | Modo oscuro | Toggle claro/oscuro con persistencia |
| UX-02 | Accesos rápidos | Atajos de teclado para acciones frecuentes |
| UX-03 | Notificaciones internas | Alertas de stock mínimo en sidebar |

### Fase 6 — Backend y multi-dispositivo

- Migrar catálogo HTML estático a catálogo web real (Supabase o Firebase)
- Sincronización de datos entre dispositivos
- Migrar campos de fragancia a tabla relacional `fragrances` (eliminar `TODO(PROVISIONAL-CATEGORY)`)

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

Abre `http://localhost:5173`. La base de datos se crea automáticamente con datos semilla en la primera ejecución.

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

> **Importante:** Cada navegador/dispositivo tiene su propia base de datos local. Los datos no se sincronizan entre dispositivos. Para backup usar Configuración → "Exportar datos".

---

## Licencia

Uso privado — todos los derechos reservados © JODA Parfums.
