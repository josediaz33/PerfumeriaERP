# JODA Parfums — ERP

Sistema de gestión interno para perfumería de nicho. 100% offline, funciona en el navegador sin conexión a internet ni servidor externo.

## Stack técnico

| Capa | Tecnología |
|---|---|
| UI | React 19 + TypeScript |
| Build | Vite |
| Estilos | Tailwind CSS v4 |
| Base de datos | Dexie.js v5 (IndexedDB) |
| Routing | React Router v6 |
| PDF | jsPDF |
| Ícones | Lucide React |

**Schema DB actual: v7**

---

## Módulos

| Ruta | Módulo | Descripción |
|---|---|---|
| `/` | Dashboard | Resumen de cuentas, stock crítico, pedidos pendientes |
| `/inventario` | Inventario | CRUD de productos con imágenes, categorías, tipos |
| `/catalogo` | Catálogo | Vista y filtros profesionales, export PDF/HTML, toggle visibilidad |
| `/ventas` | Ventas | Punto de venta con sellados, decants y parciales |
| `/decants` | Decants | Historial de decants con filtros y paginación |
| `/presupuestos` | Presupuestos | Cotizaciones mayoristas con descuento y PDF |
| `/logistica` | Logística | Pedidos locales, insumos por tamaño, preparar/anular |
| `/proveedores` | Proveedores | Órdenes de compra, recepción, prepagos |
| `/sourcing` | Sourcing | Comparador de proveedores, escenarios A/B |
| `/cuentas` | Cuentas | Movimientos de efectivo y transferencias |
| `/contabilidad` | Contabilidad | Historial contable completo, señas |
| `/clientes` | Clientes | Base de clientes con historial |
| `/utilidades` | Utilidades | Calculadoras de margen y costo |
| `/configuracion` | Configuración | Branding, categorías dinámicas, backup/restore, PIN |

---

## Versión actual: v2.6

### Sistema de categorías dinámicas
- Admin de categorías en Configuración: CRUD con slug, nombre, tipo, emoji y color
- Tipos: `gender` / `olfactive` / `style` / `other`
- Asignación masiva con editor tipo spreadsheet en Inventario
- Filtros y badges en Catálogo e Inventario

### Filtros profesionales en Catálogo
- **Disponibilidad**: Todos / Disponibles / Sin disponibilidad (respeta toggle de visibilidad forzada)
- **Tipo de objeto**: Fragancias / Relojes / General
- **Formato**: Sellados / Decants / Testers
- **Familia olfativa**: 10 familias (oculta para Relojes y General)
- **Categorías dinámicas**: pills con color por categoría
- **Precio**: rango min/max en Guaraníes
- Chips de filtros activos con × individual + "Limpiar todo"
- Badge numérica en botón Filtros

### Exportaciones
- **HTML**: portal ecommerce autocontenido con carrito, compatible iOS; exporta el subconjunto filtrado
- **PDF**: grilla 3 columnas A4 con imágenes, header/footer paginado, precios desde los campos del producto

### Logística — insumos por pedido
- Selector de frasco cuando hay 2+ opciones del mismo tamaño (muestra stock de cada uno)
- Auto-selección del frasco con más stock disponible
- `supplyId` comprometido guardado en el pedido → preparar y anular usan el mismo frasco
- Tipo "Parcial" en Presupuestos: input libre de ml en lugar de opciones fijas

---

## Tipos de producto

| `type` en DB | Descripción |
|---|---|
| `sealed` | Frasco sellado |
| `tester` | Tester sin caja |
| `decant_source` | Frasco abierto para hacer decants |

| `category` en DB | Descripción |
|---|---|
| `fragrance` | Fragancia (default — retrocompatible) |
| `watch` | Reloj |
| `general` | Otro producto |

---

## Backup y restauración

En Configuración → Exportar datos: genera un JSON con todos los productos, imágenes (base64), cuentas, movimientos, categorías y configuración. Versión del backup: `3`.

---

## Pendiente (próximas versiones)

1. **MAY-08**: Derivar "sobre pedido" de presupuestos → SourcingRequest automático
2. **ANA**: Analytics — dashboard de gráficos, top productos, reporte de stock y clientes
3. **UX**: Modo oscuro, atajos de teclado, notificaciones de stock mínimo
4. **Fase 6**: Catálogo web público con backend (Supabase/Firebase), sincronización multi-dispositivo

---

## Desarrollo local

```bash
npm install
npm run dev
```

Build de producción:
```bash
npm run build
```

La app se abre en `http://localhost:5173`. No requiere conexión; todos los datos se guardan en IndexedDB del navegador.
