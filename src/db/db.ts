import Dexie, { type Table } from 'dexie'
import type {
  Account,
  Movement,
  Product,
  ProductImage,
  StockEntry,
  ShipmentBatch,
  Supply,
  DecantBatch,
  Sale,
  SaleItem,
  Customer,
  Supplier,
  SupplierPrice,
  Order,
  LocalOrder,
  Budget,
  UtilityDistribution,
  AppConfig,
  ExchangeRate,
  SourcingRequest,
  SourcingLine,
  SupplierQuote,
  Category,
} from './types'

export class JodaDB extends Dexie {
  accounts!: Table<Account>
  movements!: Table<Movement>
  products!: Table<Product>
  categories!: Table<Category, string>  // key type: string (slug)
  stockEntries!: Table<StockEntry>
  shipmentBatches!: Table<ShipmentBatch>
  supplies!: Table<Supply>
  decantBatches!: Table<DecantBatch>
  sales!: Table<Sale>
  saleItems!: Table<SaleItem>
  customers!: Table<Customer>
  suppliers!: Table<Supplier>
  supplierPrices!: Table<SupplierPrice>
  orders!: Table<Order>
  localOrders!: Table<LocalOrder>
  budgets!: Table<Budget>
  utilityDistributions!: Table<UtilityDistribution>
  config!: Table<AppConfig>
  exchangeRates!: Table<ExchangeRate>
  images!: Table<ProductImage>
  sourcingRequests!: Table<SourcingRequest>
  sourcingLines!: Table<SourcingLine>
  supplierQuotes!: Table<SupplierQuote>

  constructor() {
    super('JodaParfumsDB')
    this.version(1).stores({
      accounts: '++id, type, isActive',
      movements: '++id, type, category, accountId, toAccountId, date, referenceId',
      products: '++id, brand, olfactiveFamily, type, createdAt',
      stockEntries: '++id, productId, supplierId, date',
      supplies: '++id, type, sizeML',
      decantBatches: '++id, productId, date',
      sales: '++id, date, accountId, customerId',
      saleItems: '++id, saleId, productId, type',
      customers: '++id, name',
      suppliers: '++id, name, country',
      supplierPrices: '++id, supplierId, brand',
      orders: '++id, supplierId, status, orderDate',
      localOrders: '++id, customerId, status, orderDate',
      budgets: '++id, customerId, status, createdAt',
      utilityDistributions: '++id, startDate, endDate',
      config: '++id, key',
      exchangeRates: '++id, date',
    })
    this.version(2).stores({
      accounts: '++id, type, isActive',
      movements: '++id, type, category, accountId, toAccountId, date, referenceId',
      products: '++id, brand, olfactiveFamily, type, createdAt',
      stockEntries: '++id, productId, supplierId, shipmentBatchId, date',
      shipmentBatches: '++id, supplierId, date',
      supplies: '++id, type, sizeML',
      decantBatches: '++id, productId, date',
      sales: '++id, date, accountId, customerId',
      saleItems: '++id, saleId, productId, type',
      customers: '++id, name',
      suppliers: '++id, name, country',
      supplierPrices: '++id, supplierId, brand',
      orders: '++id, supplierId, status, orderDate',
      localOrders: '++id, customerId, status, orderDate',
      budgets: '++id, customerId, status, createdAt',
      utilityDistributions: '++id, startDate, endDate',
      config: '++id, key',
      exchangeRates: '++id, date',
    })
    this.version(3).stores({
      accounts: '++id, type, isActive',
      movements: '++id, type, category, accountId, toAccountId, date, referenceId',
      products: '++id, brand, olfactiveFamily, type, createdAt',
      stockEntries: '++id, productId, supplierId, shipmentBatchId, date',
      shipmentBatches: '++id, supplierId, date',
      supplies: '++id, type, sizeML',
      decantBatches: '++id, productId, date, sourceId',
      sales: '++id, date, accountId, customerId, referenceId',
      saleItems: '++id, saleId, productId, type',
      customers: '++id, name',
      suppliers: '++id, name, country',
      supplierPrices: '++id, supplierId, brand',
      orders: '++id, supplierId, status, orderDate',
      localOrders: '++id, customerId, status, orderDate',
      budgets: '++id, customerId, status, createdAt',
      utilityDistributions: '++id, startDate, endDate',
      config: '++id, key',
      exchangeRates: '++id, date',
    })
    this.version(4).stores({
      accounts: '++id, type, isActive',
      movements: '++id, type, category, accountId, toAccountId, date, referenceId',
      products: '++id, brand, olfactiveFamily, type, createdAt',
      stockEntries: '++id, productId, supplierId, shipmentBatchId, orderId, date',
      shipmentBatches: '++id, supplierId, date',
      supplies: '++id, type, sizeML',
      decantBatches: '++id, productId, date, sourceId',
      sales: '++id, date, accountId, customerId, referenceId',
      saleItems: '++id, saleId, productId, type',
      customers: '++id, name',
      suppliers: '++id, name, country',
      supplierPrices: '++id, supplierId, brand',
      orders: '++id, supplierId, status, orderDate',
      localOrders: '++id, customerId, status, orderDate',
      budgets: '++id, customerId, status, createdAt',
      utilityDistributions: '++id, startDate, endDate',
      config: '++id, key',
      exchangeRates: '++id, date',
    })
    // v5 — BRAND: tabla de imágenes (id string UUID, no autoincremental)
    this.version(5).stores({
      accounts: '++id, type, isActive',
      movements: '++id, type, category, accountId, toAccountId, date, referenceId',
      products: '++id, brand, olfactiveFamily, type, createdAt',
      stockEntries: '++id, productId, supplierId, shipmentBatchId, orderId, date',
      shipmentBatches: '++id, supplierId, date',
      supplies: '++id, type, sizeML',
      decantBatches: '++id, productId, date, sourceId',
      sales: '++id, date, accountId, customerId, referenceId',
      saleItems: '++id, saleId, productId, type',
      customers: '++id, name',
      suppliers: '++id, name, country',
      supplierPrices: '++id, supplierId, brand',
      orders: '++id, supplierId, status, orderDate',
      localOrders: '++id, customerId, status, orderDate',
      budgets: '++id, customerId, status, createdAt',
      utilityDistributions: '++id, startDate, endDate',
      config: '++id, key',
      exchangeRates: '++id, date',
      images: 'id, mime, createdAt',
    })
    // v6 — SOURCE: comparador de proveedores
    this.version(6).stores({
      accounts: '++id, type, isActive',
      movements: '++id, type, category, accountId, toAccountId, date, referenceId',
      products: '++id, brand, olfactiveFamily, type, createdAt',
      stockEntries: '++id, productId, supplierId, shipmentBatchId, orderId, date',
      shipmentBatches: '++id, supplierId, date',
      supplies: '++id, type, sizeML',
      decantBatches: '++id, productId, date, sourceId',
      sales: '++id, date, accountId, customerId, referenceId',
      saleItems: '++id, saleId, productId, type',
      customers: '++id, name',
      suppliers: '++id, name, country',
      supplierPrices: '++id, supplierId, brand',
      orders: '++id, supplierId, status, orderDate',
      localOrders: '++id, customerId, status, orderDate',
      budgets: '++id, customerId, status, createdAt',
      utilityDistributions: '++id, startDate, endDate',
      config: '++id, key',
      exchangeRates: '++id, date',
      images: 'id, mime, createdAt',
      sourcingRequests: '++id, status, createdAt',
      sourcingLines: '++id, requestId, productId, destination',
      supplierQuotes: '++id, requestId, supplierId',
    })

    // v7 — CATEGORÍAS: sistema de categorías dinámicas administradas por el usuario.
    //
    // DISEÑO:
    //   categories: tabla con IDs tipo slug (string, no autoincrement).
    //     - El slug es un identificador estable que migra a SQL sin transformación.
    //     - En Fase 6 → tabla SQL `categories` (slug VARCHAR PRIMARY KEY).
    //
    //   products.*categoryIds: MultiEntry index de Dexie sobre el array de slugs.
    //     - Permite db.products.where('categoryIds').equals('masculino') sin cargar todo.
    //     - En Fase 6 → tabla junction SQL `product_categories` (product_id, category_slug).
    //
    // ÍNDICES:
    //   categories: primary key = id (slug), indexed: type, sortOrder
    //   products: agrega *categoryIds (MultiEntry); elimina olfactiveFamily (ya sin uso en index)
    //
    // MIGRACIÓN DE DATOS: ninguna. categoryIds undefined = sin categorías asignadas.
    // Los campos category, olfactiveFamily, concentration, sizeML se mantienen intactos.
    this.version(7).stores({
      accounts: '++id, type, isActive',
      movements: '++id, type, category, accountId, toAccountId, date, referenceId',
      // *categoryIds: MultiEntry index — indexa cada elemento del array individualmente
      products: '++id, brand, type, createdAt, *categoryIds',
      stockEntries: '++id, productId, supplierId, shipmentBatchId, orderId, date',
      shipmentBatches: '++id, supplierId, date',
      supplies: '++id, type, sizeML',
      decantBatches: '++id, productId, date, sourceId',
      sales: '++id, date, accountId, customerId, referenceId',
      saleItems: '++id, saleId, productId, type',
      customers: '++id, name',
      suppliers: '++id, name, country',
      supplierPrices: '++id, supplierId, brand',
      orders: '++id, supplierId, status, orderDate',
      localOrders: '++id, customerId, status, orderDate',
      budgets: '++id, customerId, status, createdAt',
      utilityDistributions: '++id, startDate, endDate',
      config: '++id, key',
      exchangeRates: '++id, date',
      images: 'id, mime, createdAt',
      sourcingRequests: '++id, status, createdAt',
      sourcingLines: '++id, requestId, productId, destination',
      supplierQuotes: '++id, requestId, supplierId',
      // categories: primary key = slug (string). type e sortOrder son índices secundarios.
      categories: 'id, type, sortOrder',
    })
  }
}

export const db = new JodaDB()

// ─── Seed de categorías (independiente del seed inicial) ─────────────────────
//
// Las categorías de género se pre-cargan en todos los dispositivos nuevos Y
// también en dispositivos existentes que hacen upgrade a v7 (se omiten si ya
// existen por el check db.categories.count()).
//
// IMPORTANTE: este seed usa slugs fijos. Si el usuario renombra 'masculino'
// a 'Hombre', el slug sigue siendo 'masculino' — solo cambia el display name.
// Esto garantiza que los product.categoryIds apuntando a 'masculino' siguen
// siendo válidos después del rename.
//
// MIGRACIÓN FASE 6: al exportar a SQL, estos slugs pasan tal cual como
// PRIMARY KEY de la tabla `categories`. No requieren ningún remapeo.

export async function seedCategories() {
  const count = await db.categories.count()
  if (count > 0) return  // ya seeded — no sobreescribir personalizaciones del usuario

  const now = new Date().toISOString()

  // Géneros: las 4 categorías de audiencia más comunes en perfumería y accesorios.
  // El usuario puede agregar más desde Configuración → Categorías.
  await db.categories.bulkAdd([
    { id: 'masculino', name: 'Masculino', type: 'gender', emoji: '♂',  sortOrder: 1, createdAt: now },
    { id: 'femenino',  name: 'Femenino',  type: 'gender', emoji: '♀',  sortOrder: 2, createdAt: now },
    { id: 'unisex',    name: 'Unisex',    type: 'gender', emoji: '⚥',  sortOrder: 3, createdAt: now },
    { id: 'ninos',     name: 'Niños',     type: 'gender', emoji: '👶', sortOrder: 4, createdAt: now },
  ])
}

// ─── Seed initial data ────────────────────────────────────────────────────────

export async function seedInitialData() {
  const accountCount = await db.accounts.count()
  if (accountCount > 0) return

  const now = new Date().toISOString()

  await db.accounts.bulkAdd([
    { name: 'Caja (Efectivo)', type: 'cash', balance: 0, currency: 'PYG', createdAt: now, isActive: true },
    { name: 'Cuenta Bancaria', type: 'bank', balance: 0, currency: 'PYG', createdAt: now, isActive: true },
    { name: 'Billetera Digital', type: 'digital_wallet', balance: 0, currency: 'PYG', createdAt: now, isActive: true },
  ])

  await db.config.bulkAdd([
    { key: 'business_name', value: 'JODA Parfums' },
    { key: 'business_phone', value: '' },
    { key: 'business_address', value: 'Paraguay' },
    { key: 'usd_pyg_rate', value: '7500' },
    { key: 'restock_percent', value: '40' },
    { key: 'reinvest_percent', value: '30' },
    { key: 'personal_percent', value: '30' },
  ])

  await db.supplies.bulkAdd([
    { name: 'Frasco 3ml', type: '3ml', sizeML: 3, costPYG: 3000, stock: 0, minStock: 10, createdAt: now, updatedAt: now },
    { name: 'Frasco 5ml', type: '5ml', sizeML: 5, costPYG: 4500, stock: 0, minStock: 10, createdAt: now, updatedAt: now },
    { name: 'Frasco 10ml', type: '10ml', sizeML: 10, costPYG: 7000, stock: 0, minStock: 10, createdAt: now, updatedAt: now },
    { name: 'Frasco 30ml', type: '30ml', sizeML: 30, costPYG: 15000, stock: 0, minStock: 5, createdAt: now, updatedAt: now },
  ])
}

// ─── Helper: get config value ─────────────────────────────────────────────────

export async function getConfig(key: string): Promise<string> {
  const entry = await db.config.where('key').equals(key).first()
  return entry?.value ?? ''
}

export async function setConfig(key: string, value: string): Promise<void> {
  const existing = await db.config.where('key').equals(key).first()
  if (existing?.id) {
    await db.config.update(existing.id, { value })
  } else {
    await db.config.add({ key, value })
  }
}

export async function getCurrentRate(): Promise<number> {
  const val = await getConfig('usd_pyg_rate')
  return parseFloat(val) || 7500
}
