# JODA Parfums ERP

> Sistema de gestión integral para negocios de perfumería y decants — 100% offline, corre en el navegador sin necesidad de servidor ni base de datos externa.

[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Dexie.js](https://img.shields.io/badge/Dexie.js-v4-FF6B35)](https://dexie.org/)

---

## Descripción

JODA Parfums ERP es una aplicación web diseñada específicamente para negocios de perfumería que manejan productos sellados, testers y producción de decants (fraccionamiento). Cubre el ciclo completo: desde la gestión de stock y producción hasta presupuestos, logística de entrega, contabilidad y análisis de rentabilidad.

Toda la información se almacena localmente en el navegador mediante **IndexedDB** (Dexie.js), lo que garantiza privacidad total, uso sin conexión y cero costos de infraestructura.

---

## Módulos

| Módulo | Descripción |
|--------|-------------|
| **Dashboard** | KPIs del mes: ventas, utilidad, stock crítico, pedidos pendientes |
| **Inventario** | Productos por tipo (sellado / tester / decant\_source), lotes con CPP ponderado (FIFO), alertas de stock mínimo, apertura de botella para decants |
| **Decants** | Producción de frascos, control de ML, historial trazable por origen |
| **Ventas** | Registro de ventas directas con desglose de ganancia por ítem |
| **Logística** | Pipeline de pedidos locales con validación de stock, señas (pagos anticipados) y entrega con cobro de saldo |
| **Contabilidad** | Movimientos contables con filtros por mes, tipo y cuenta |
| **Cuentas** | Saldos en tiempo real, historial por cuenta y recálculo desde movimientos |
| **Proveedores** | Órdenes de compra internacionales con recepción, distribución de flete y edición en cascada |
| **Presupuestos** | Presupuestos PDF por cliente con análisis de rentabilidad interno y conversión a pedido de logística |
| **Clientes** | Directorio de clientes con historial de compras |
| **Utilidades** | Análisis de rentabilidad histórica y distribución de ganancias |
| **Catálogo** | Vista de productos con precios por tamaño |
| **Configuración** | Parámetros del negocio, tipo de cambio USD/PYG |

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Framework UI | [React 19](https://react.dev/) + [TypeScript 6](https://www.typescriptlang.org/) |
| Build tool | [Vite 8](https://vite.dev/) |
| Estilos | [Tailwind CSS v4](https://tailwindcss.com/) (plugin nativo de Vite) |
| Base de datos | [Dexie.js v4](https://dexie.org/) sobre IndexedDB del navegador |
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
│   └── customers.ts   # upsertCustomer
├── components/
│   ├── layout/        # Sidebar, Layout principal
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
   Logística — Entregado       ← crea Sale + SaleItem + movimiento contable
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

### Señas (pagos anticipados en pedidos)
Cada seña genera un `Movement` de ingreso inmediato. Al entregar, se cobra solo `max(0, totalAmount - señaTotal)`. Si el saldo es 0, la entrega se confirma sin requerir cuenta de cobro.

### Insumos en pedidos con decants
Al pasar un pedido a "Preparar", `advanceStatus` descuenta automáticamente el frasco correspondiente por cada ítem de tipo `decant` (búsqueda por `sizeML`). Por eso el array `supplies[]` del `LocalOrder` es para insumos adicionales (etiquetas, packaging, etc.) y **no** debe incluir los frascos de decant para evitar doble descuento.

### Trazabilidad Presupuesto ↔ Pedido
- `Budget.localOrderId` — ID del `LocalOrder` creado desde este presupuesto
- `LocalOrder.budgetId` — ID del `Budget` de origen
- Si el pedido se elimina desde Logística, `localOrderId` se limpia en el presupuesto y el botón "Crear pedido" vuelve a aparecer

---

## Módulos en detalle

### Inventario
- **Tipos de producto**: sellado, tester (se vende como sellado a precio diferente) y decant\_source
- **Abrir para decants**: botón que descuenta 1 unidad sellada/tester por FIFO y suma los ML al stock abierto; permite convertir cualquier producto en fuente de decants
- **Lotes (StockEntry)**: costo USD + cotización → costo PYG; CPP recalculado al agregar lotes
- **Edición de lotes en cascada**: cambiar precio propaga el delta al movimiento contable y al saldo de la cuenta
- **Ingreso rápido con trazabilidad**: al agregar stock con proveedor seleccionado (tanto producto individual como lote múltiple), se crea un `Order` con `status: 'received'` que aparece en el historial del proveedor

### Proveedores
- Recepción de pedidos: genera `StockEntry` por producto, distribuye el flete proporcionalmente, recalcula CPP
- **Edición de pedidos recibidos**: modal con cambio de cotización, flete y precios por ítem; cascade completo a stock entries, CPP de productos, movimiento y saldo
- **Pago anticipado**: al crear un pedido o desde la tabla de pedidos activos, se puede registrar el pago del total de productos antes de recepcionar. Al recepcionar un pedido prepagado, solo se descuenta el envío

### Presupuestos
- **Tipos de línea**: Sellado, Tester, Decant (tamaños 3/5/10/30ml), Parcial, Personalizado
- **Auto-llenado**: seleccionar producto + tipo completa descripción y precio sugerido
- **Análisis de rentabilidad interno** (no aparece en PDF):
  - Costo estimado por línea según tipo
  - Ganancia unitaria y margen % con colores de alerta
  - Totales: costo, ingreso neto con descuento, ganancia estimada, margen general
- **Export PDF**: diseño con header oscuro/dorado, tabla de ítems, subtotal con descuento, total
- **Conversión a pedido**: presupuesto aceptado → un click → `LocalOrder` en Logística con ítems y estado Pendiente; frascos para decants se descontarán al preparar (no se pre-cargan en `supplies[]`)

### Logística
- Validación de stock antes de preparar: unidades selladas, ML abiertos y frascos
- Al preparar: descuenta stock del producto + FIFO sobre lotes + frascos por ítem decant + crea `DecantBatch`
- Señas con movimiento contable inmediato; saldo calculado al entregar
- **Reversión a Pendiente**: restaura ML/stock, elimina DecantBatch, repone frascos en insumos
- **Eliminar venta de logística**: revierte cobro, restaura stock (FIFO + frascos + ML), elimina `DecantBatch` y el pedido asociado

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

> **Importante:** Cada navegador/dispositivo tiene su propia base de datos local. Los datos no se sincronizan entre dispositivos en esta versión.

---

## Licencia

Uso privado — todos los derechos reservados © JODA Parfums.
