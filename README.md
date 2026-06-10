# JODA Parfums ERP

> Sistema de gestión integral para negocios de perfumería y decants — 100% offline, corre en el navegador sin necesidad de servidor ni base de datos externa.

[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Dexie.js](https://img.shields.io/badge/Dexie.js-v4-FF6B35)](https://dexie.org/)

---

## Descripción

JODA Parfums ERP es una aplicación web progresiva diseñada específicamente para negocios de perfumería que manejan productos sellados y producción de decants (fraccionamiento). Cubre el ciclo completo de operaciones: desde la gestión de stock y producción hasta ventas, logística de entrega, contabilidad y reportes.

Toda la información se almacena localmente en el navegador mediante **IndexedDB** (Dexie.js), lo que garantiza privacidad total, uso sin conexión y cero costos de infraestructura.

---

## Módulos

| Módulo | Descripción |
|--------|-------------|
| **Dashboard** | Vista general con KPIs: ventas del mes, utilidad, stock crítico, pedidos pendientes |
| **Inventario** | Gestión de productos sellados y fuentes de decant, compras con CPP ponderado (FIFO), alertas de stock mínimo |
| **Decants** | Producción de decants, control de ML por frasco, historial trazable por origen (manual, venta, pedido) |
| **Ventas** | Registro de pedidos con carrito de productos, generación de órdenes que fluyen a Logística |
| **Logística** | Pipeline de pedidos locales: Pendiente → En preparación → Listo → Entregado, con validación de stock antes de preparar |
| **Contabilidad** | Registro de ingresos y egresos, vinculación con ventas y reposiciones, reversión de lotes al eliminar un egreso |
| **Cuentas** | Billeteras y cuentas bancarias, seguimiento de saldos en tiempo real |
| **Proveedores** | Base de datos de proveedores, historial de precios, gestión de pedidos internacionales |
| **Catálogo** | Catálogo visual de productos con información de concentración, familia olfativa y precios por tamaño |
| **Presupuestos** | Generación y exportación de presupuestos en PDF para clientes |
| **Utilidades** | Distribución porcentual de la utilidad neta: reinversión, reposición y retiro personal |
| **Configuración** | Parámetros del negocio, tipo de cambio USD/PYG, datos de contacto |

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Framework UI | [React 19](https://react.dev/) + [TypeScript 6](https://www.typescriptlang.org/) |
| Build tool | [Vite 8](https://vite.dev/) |
| Estilos | [Tailwind CSS v4](https://tailwindcss.com/) (plugin nativo de Vite) |
| Base de datos | [Dexie.js v4](https://dexie.org/) sobre IndexedDB del navegador |
| Estado reactivo | [Dexie React Hooks](https://dexie.org/docs/dexie-react-hooks/useLiveQuery()) — `useLiveQuery` |
| Routing | [React Router v7](https://reactrouter.com/) |
| Gráficos | [Recharts](https://recharts.org/) |
| Exportación PDF | [jsPDF](https://github.com/parallax/jsPDF) + [html2canvas](https://html2canvas.hertzen.com/) |
| Iconografía | [Lucide React](https://lucide.dev/) |
| Estado global | [Zustand](https://zustand-demo.pmnd.rs/) |

---

## Arquitectura

```
src/
├── db/
│   ├── db.ts          # Instancia Dexie + versiones del schema + seed
│   └── types.ts       # Interfaces TypeScript para todas las entidades
├── lib/
│   └── format.ts      # Helpers: formateo de moneda PYG, fechas, etc.
├── components/
│   ├── layout/        # Sidebar, Layout principal
│   └── ui/            # Componentes reutilizables: Button, Card, Modal, Input, Badge...
└── pages/             # Un archivo por módulo de negocio
```

**Modelo de datos clave:**
- `Product` — sellados y fuentes de decant (con CPP y stock en ML)
- `StockEntry` — lotes de compra con FIFO para deducción y reversión
- `DecantBatch` — producción de decants trazable (`sourceType`: manual / sale / local_order)
- `LocalOrder` — pedidos locales con estado pipeline
- `Sale` + `SaleItem` — ventas completadas con desglose por producto
- `Movement` — movimientos contables vinculados a ventas, reposiciones y pedidos

---

## Flujo principal de venta

```
Ventas (crear pedido)
        ↓
Logística — Pendiente
        ↓  [valida stock + insumos]
Logística — En preparación  ← descuenta ML/stock, crea DecantBatch
        ↓
Logística — Listo
        ↓  [registra cobro]
Logística — Entregado       ← crea Sale + SaleItem + movimiento contable
        ↓
Aparece en historial de Ventas y Contabilidad
```

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

Abre `http://localhost:5173` en el navegador. La base de datos se crea automáticamente en la primera ejecución con datos semilla (cuentas y frascos por defecto).

### Scripts disponibles

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Servidor de desarrollo con HMR |
| `npm run build` | Build de producción (salida en `dist/`) |
| `npm run preview` | Preview del build de producción |
| `npm run lint` | Análisis estático con ESLint |

---

## Variables de entorno

No se requieren variables de entorno. Toda la configuración del negocio (nombre, teléfono, tipo de cambio) se gestiona desde el módulo **Configuración** dentro de la app.

---

## Consideraciones de despliegue

Al ser una SPA estática sin backend, puede desplegarse en cualquier hosting de archivos estáticos:

- **Vercel** / **Netlify**: conectar el repositorio y configurar build command `npm run build`, output dir `dist`
- **GitHub Pages**: usar `npm run build` y servir la carpeta `dist/`
- **Self-hosted**: servir la carpeta `dist/` con Nginx o cualquier servidor HTTP

> **Importante:** Cada usuario/equipo tiene su propia base de datos local en el navegador. Los datos no se sincronizan entre dispositivos en esta versión.

---

## Roadmap

- [ ] Sincronización en la nube (CouchDB / PouchDB o Supabase)
- [ ] Soporte multi-usuario con roles
- [ ] App móvil (PWA instalable)
- [ ] Módulo de clientes (CRM básico)
- [ ] Integración con WhatsApp Business API para envío de presupuestos
- [ ] Reportes exportables en Excel

---

## Licencia

Uso privado — todos los derechos reservados © JODA Parfums.
