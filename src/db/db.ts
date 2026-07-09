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
} from './types'

export class JodaDB extends Dexie {
  accounts!: Table<Account>
  movements!: Table<Movement>
  products!: Table<Product>
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
  }
}

export const db = new JodaDB()

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
