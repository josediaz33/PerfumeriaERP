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
  olfactiveFamily: OlfactiveFamily
  concentration: Concentration
  sizeML: number
  costUSD: number
  exchangeRateUsed: number
  costPYG: number
  sellingPricePYG: number
  price3ML?: number
  price5ML?: number
  price10ML?: number
  price30ML?: number
  stockSealed: number
  stockOpenML: number
  minStock: number
  type: ProductType
  imageUrl?: string
  notes?: string
  createdAt: string
  updatedAt: string
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

export type SaleItemType = 'sealed' | 'decant' | 'partial'

export interface SaleItem {
  id?: number
  saleId: number
  productId: number
  type: SaleItemType
  sizeML?: number
  quantity: number
  unitCost: number
  unitPrice: number
  profit: number
}

export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'other'

export interface Sale {
  id?: number
  items: SaleItem[]
  totalAmount: number
  totalCost: number
  totalProfit: number
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
  sizeML: number
  quantity: number
  unitPriceUSD: number
}

export interface Order {
  id?: number
  supplierId: number
  items: OrderItem[]
  totalUSD: number
  exchangeRate: number
  totalPYG: number
  shippingTotalPYG?: number
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
  type: SaleItemType
  sizeML?: number
  quantity: number
  unitPrice: number
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
  notes?: string
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
