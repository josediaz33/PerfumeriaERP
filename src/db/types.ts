// ─── Core types for JODA Parfums ERP ─────────────────────────────────────────

export type AccountType = 'cash' | 'bank' | 'digital_wallet' | 'other'

export interface Account {
  id?: number
  name: string
  type: AccountType
  balance: number
  currency: 'PYG'
  createdAt: string
  isActive: boolean
}

export type MovementType = 'income' | 'expense' | 'transfer'
export type MovementCategory =
  | 'sale'
  | 'restock'
  | 'supplies'
  | 'packaging'
  | 'shipping'
  | 'services'
  | 'personal_withdrawal'
  | 'personal_return'
  | 'transfer'
  | 'other'

export interface Movement {
  id?: number
  type: MovementType
  category: MovementCategory
  amount: number
  accountId: number
  toAccountId?: number
  description: string
  referenceId?: number
  referenceType?: 'sale' | 'order' | 'local_order' | 'stock_entry'
  date: string
  createdAt: string
}

export type ProductType = 'sealed' | 'tester' | 'decant_source'

// ─── Sistema de categorías dinámicas ─────────────────────────────────────────
//
// DISEÑO: las categorías son administradas por el usuario en Configuración.
// Se almacenan en la tabla `categories` de Dexie con IDs de tipo slug string
// (ej. 'masculino', 'femenino', 'floral') en lugar de autoincrement numérico.
//
// RAZÓN DEL SLUG: los slugs son identifcadores estables y legibles que migran
// a SQL sin transformación. En la BD relacional, el slug se convierte en
// PRIMARY KEY o columna UNIQUE — sin necesidad de remapear IDs.
//
// MIGRACIÓN FUTURA (Fase 6):
//   categories → tabla SQL `categories` (slug PRIMARY KEY)
//   product.categoryIds[] → tabla junction SQL `product_categories`
//     (product_id INT, category_slug VARCHAR — sin transformación de datos)
//
// Dexie usa MultiEntry index (*categoryIds) para queries eficientes sobre arrays:
//   db.products.where('categoryIds').equals('masculino').toArray()
// En SQL esto equivale a un JOIN sobre `product_categories`.

export type CategoryType =
  | 'gender'     // Masculino, Femenino, Unisex, Niños
  | 'olfactive'  // Floral, Amaderado, Oriental... (complementa olfactiveFamily provisional)
  | 'style'      // Casual, Formal, Deportivo, Para regalo...
  | 'other'      // Cualquier otra agrupación definida por el usuario

export interface Category {
  id: string           // slug único: 'masculino', 'femenino', 'floral', 'verano'
  name: string         // display: 'Masculino', 'Femenino', 'Floral', 'Verano'
  type: CategoryType   // agrupa categorías en la UI y en SQL
  emoji?: string       // ícono opcional para pills: '♂', '♀', '🌸'
  color?: string       // color hex para el badge: '#6d28d9' (opcional, usa default si undefined)
  sortOrder: number    // orden dentro del grupo
  createdAt: string
}

// TODO(PROVISIONAL-CATEGORY): Opción A — campo `category` para distinguir el TIPO de objeto
// (fragrancias, relojes, general). PROVISIONAL hasta migración a base de datos relacional (Fase 6).
// En Fase 6 se reemplaza por una Category de tipo 'product_kind' administrada dinámicamente.
// Ver: https://github.com/josediaz33/PerfumeriaERP — MIGRACIÓN FASE 6
export type ProductCategory = 'fragrance' | 'watch' | 'general'

export type Concentration = 'EDP' | 'EDT' | 'EDC' | 'EXP' | 'PARFUM' | 'OTHER'
export type OlfactiveFamily =
  | 'floral'
  | 'woody'
  | 'oriental'
  | 'fresh'
  | 'citrus'
  | 'aromatic'
  | 'gourmand'
  | 'chypre'
  | 'fougere'
  | 'other'

export interface Product {
  id?: number
  name: string
  brand: string

  // ── Clasificación dinámica (sistema de categorías v2.6) ──────────────────
  // categoryIds almacena slugs de Category. Es el sistema principal de
  // clasificación: género, estilo, colección, etc.
  // MultiEntry index en Dexie (*categoryIds) → tabla junction en SQL (Fase 6).
  categoryIds?: string[]   // ej. ['masculino', 'floral', 'verano']

  // ── Clasificación de tipo de objeto (provisional) ────────────────────────
  // TODO(PROVISIONAL-CATEGORY): en Fase 6 este campo pasa a ser una Category
  // de tipo 'product_kind', administrada desde Configuración como el resto.
  // Mientras tanto, undefined = 'fragrance' por retrocompatibilidad.
  category?: ProductCategory

  // ── Atributos específicos de fragancias (provisionales) ──────────────────
  // TODO(PROVISIONAL-CATEGORY): en Fase 6 estos campos pasan a tabla 'fragrances'
  // relacionada por product_id. Se mantienen aquí para no romper el flujo actual.
  olfactiveFamily?: OlfactiveFamily  // solo fragancias
  concentration?: Concentration      // solo fragancias
  sizeML?: number                    // solo fragancias (ml de la botella fuente)

  // ── Precios ──────────────────────────────────────────────────────────────
  costUSD: number
  exchangeRateUsed: number
  costPYG: number
  sellingPricePYG: number
  price3ML?: number
  price5ML?: number
  price10ML?: number
  price30ML?: number

  // ── Stock ─────────────────────────────────────────────────────────────────
  stockSealed: number
  stockOpenML: number
  minStock: number

  // ── Meta ──────────────────────────────────────────────────────────────────
  type: ProductType
  imageIds?: string[]
  catalogVisible?: boolean
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface ProductImage {
  id: string
  blob: Blob
  mime: 'image/jpeg' | 'image/png'
  createdAt: string
}

export interface StockEntry {
  id?: number
  productId: number
  supplierId?: number
  shipmentBatchId?: number
  orderId?: number
  quantity: number
  quantityRemaining?: number
  costUSD: number
  exchangeRate: number
  costPYG: number
  type: ProductType
  date: string
  notes?: string
  createdAt: string
}

export interface ShipmentBatch {
  id?: number
  supplierId?: number
  date: string
  description?: string
  exchangeRate: number
  totalShippingPYG: number
  notes?: string
  createdAt: string
}

export type SupplyType = '3ml' | '5ml' | '10ml' | '30ml' | 'cap' | 'label' | 'packaging' | 'gift_wrap' | 'other'

export interface Supply {
  id?: number
  name: string
  type: SupplyType
  sizeML?: number
  costPYG: number
  stock: number
  minStock: number
  createdAt: string
  updatedAt: string
}

export interface DecantBatch {
  id?: number
  productId: number
  sizeML: number
  quantity: number
  supplyId: number
  costPerDecant: number
  sellingPricePYG: number
  mlUsed: number
  stockRemaining: number
  date: string
  notes?: string
  sourceType?: 'manual' | 'sale' | 'local_order'
  sourceId?: number
  createdAt: string
}

export type SaleItemType = 'sealed' | 'tester' | 'decant' | 'partial' | 'supply'

export interface SaleItem {
  id?: number
  saleId: number
  productId: number
  supplyId?: number
  type: SaleItemType
  sizeML?: number
  quantity: number
  unitCost: number
  unitPrice: number
  profit: number
}

export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'qr' | 'other'

export interface Sale {
  id?: number
  items: SaleItem[]
  totalAmount: number
  totalCost: number
  totalProfit: number
  commission?: number
  paymentMethod: PaymentMethod
  accountId: number
  customerId?: number
  customerName?: string
  referenceType?: 'local_order'
  referenceId?: number
  date: string
  notes?: string
  createdAt: string
}

export interface Customer {
  id?: number
  name: string
  ci?: string
  phone?: string
  address?: string
  notes?: string
  createdAt: string
}

export interface Supplier {
  id?: number
  name: string
  country: string
  website?: string
  paymentTerms?: string
  estimatedDeliveryDays?: number
  notes?: string
  createdAt: string
}

export interface SupplierPrice {
  id?: number
  supplierId: number
  productName: string
  brand: string
  sizeML: number
  priceUSD: number
  updatedAt: string
}

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'received' | 'cancelled'

export interface OrderItem {
  productName: string
  brand: string
  // TODO(PROVISIONAL-CATEGORY): sizeML es opcional para productos no-fragancia (ej. relojes)
  sizeML?: number
  quantity: number
  unitPriceUSD: number
  type?: ProductType
  category?: ProductCategory  // propagado del producto al crear la orden
}

export interface Order {
  id?: number
  supplierId: number
  items: OrderItem[]
  totalUSD: number
  exchangeRate: number
  totalPYG: number
  shippingTotalPYG?: number
  prepaidAmount?: number
  localCurrency?: boolean
  status: OrderStatus
  orderDate: string
  estimatedArrival?: string
  notes?: string
  createdAt: string
}

export type LocalOrderStatus = 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled'

export interface LocalOrderItem {
  productId: number
  supplyId?: number
  type: SaleItemType
  sizeML?: number
  quantity: number
  unitPrice: number
  sobrePedido?: boolean
}

export interface LocalOrderSupply {
  supplyId: number
  quantity: number
  unitCost: number
}

export interface AdvancePayment {
  amount: number
  date: string
  method: PaymentMethod
  accountId: number
  commission?: number
  notes?: string
  movementId?: number  // ID del movimiento contable asociado — permite navegar desde Logística
}

export interface LocalOrder {
  id?: number
  customerId?: number
  customerName: string
  customerPhone?: string
  customerAddress?: string
  items: LocalOrderItem[]
  supplies: LocalOrderSupply[]
  shippingCost: number
  shippingPaidBy: 'customer' | 'business'
  totalAmount: number
  totalCost: number
  status: LocalOrderStatus
  isPreOrder?: boolean
  advancePayments?: AdvancePayment[]
  budgetId?: number
  orderDate: string
  estimatedDelivery?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface BudgetItem {
  productId: number
  description: string
  type: SaleItemType
  sizeML?: number
  quantity: number
  unitPrice: number
  subtotal: number
  descuentoPct?: number
  sobrePedido?: boolean
  costoEstimado?: number
}

export type BudgetStatus = 'draft' | 'sent' | 'accepted' | 'rejected'

export interface Budget {
  id?: number
  customerId?: number
  customerName: string
  customerPhone?: string
  items: BudgetItem[]
  subtotal: number
  discount: number
  total: number
  notes?: string
  status: BudgetStatus
  validUntil?: string
  localOrderId?: number
  esMayorista?: boolean
  descuentoMayoristaBase?: number
  createdAt: string
  updatedAt: string
}

export interface UtilityDistribution {
  id?: number
  periodLabel: string
  startDate: string
  endDate: string
  grossProfit: number
  restockPercent: number
  reinvestPercent: number
  personalPercent: number
  restockAmount: number
  reinvestAmount: number
  personalAmount: number
  personalWithdrawn: number
  createdAt: string
}

export interface AppConfig {
  id?: number
  key: string
  value: string
}

export type ExchangeRate = {
  id?: number
  rate: number
  date: string
  source: 'manual' | 'api'
}

// ─── SOURCE — Comparador de proveedores ───────────────────────────────────────

export type SourcingStatus = 'draft' | 'quoting' | 'decided' | 'ordered' | 'closed'
export type SourcingDestination = 'stock' | 'client'

export interface SourcingRequest {
  id?: number
  status: SourcingStatus
  notes?: string
  chosenQuoteId?: number
  createdAt: string
  updatedAt: string
}

export interface SourcingLine {
  id?: number
  requestId: number
  productId?: number
  productName: string
  brand: string
  isFreeText: boolean
  quantity: number
  destination: SourcingDestination
  customerId?: number
  customerName?: string
  expectedSalePricePYG?: number
}

export interface SupplierQuoteLineItem {
  lineId: number
  priceUSD: number
}

export interface SupplierQuote {
  id?: number
  requestId: number
  supplierId: number
  estimatedShippingPYG: number
  exchangeRate: number
  lineItems: SupplierQuoteLineItem[]
  createdAt: string
  updatedAt: string
}
