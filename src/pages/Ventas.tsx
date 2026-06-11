import { useState, Fragment } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, ShoppingCart, Search, X, TrendingUp, Edit2, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { db } from '../db/db'
import type { PaymentMethod, SaleItemType, Sale } from '../db/types'
import { fmtPYG, fmtDate, today, nowISO } from '../lib/format'
import { upsertCustomer } from '../lib/customers'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Card, CardBody } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Input, Select, Textarea } from '../components/ui/Input'
import { CustomerAutocomplete } from '../components/ui/CustomerAutocomplete'
import { Badge } from '../components/ui/Badge'

const paymentLabels: Record<PaymentMethod, string> = {
  cash: 'Efectivo', transfer: 'Transferencia', card: 'Tarjeta', other: 'Otro',
}

const paymentColors: Record<PaymentMethod, 'green' | 'blue' | 'violet' | 'gray'> = {
  cash: 'green', transfer: 'blue', card: 'violet', other: 'gray',
}

interface CartItem {
  productId: number
  type: SaleItemType
  sizeML?: number
  quantity: number
  unitCost: number
  unitPrice: number
  label: string
  lotInfo?: string
}

export function Ventas() {
  const accounts = useLiveQuery(() => db.accounts.filter(a => a.isActive !== false).toArray()) ?? []
  const products = useLiveQuery(() => db.products.toArray()) ?? []
  const batches = useLiveQuery(() => db.decantBatches.toArray()) ?? []
  const sales = useLiveQuery(() => db.sales.orderBy('date').reverse().limit(100).toArray()) ?? []
  const allSaleItems = useLiveQuery(() => db.saleItems.toArray()) ?? []
  const allStockEntries = useLiveQuery(() => db.stockEntries.orderBy('date').toArray()) ?? []
  const allSupplies = useLiveQuery(() => db.supplies.toArray()) ?? []
  const customers = useLiveQuery(() => db.customers.orderBy('name').toArray()) ?? []

  const [filterDate, setFilterDate] = useState(() => today().slice(0, 7))
  const [search, setSearch] = useState('')

  // Nueva venta / pedido
  const [showNew, setShowNew] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [saleDate, setSaleDate] = useState(today())
  const [saleNotes, setSaleNotes] = useState('')
  const [addType, setAddType] = useState<'sealed' | 'decant' | 'partial'>('sealed')
  const [addProduct, setAddProduct] = useState('0')
  const [addSize, setAddSize] = useState('5')
  const [addQty, setAddQty] = useState('1')
  const [addPrice, setAddPrice] = useState('')
  const [addPartialML, setAddPartialML] = useState('')

  // Expandir / editar / eliminar venta
  const [expandedSaleId, setExpandedSaleId] = useState<number | null>(null)
  const [editSale, setEditSale] = useState<Sale | null>(null)
  const [editSaleForm, setEditSaleForm] = useState({
    paymentMethod: 'cash' as PaymentMethod,
    accountId: '',
    date: today(),
    notes: '',
  })

  const filteredSales = sales.filter(s => {
    if (filterDate && !s.date.startsWith(filterDate)) return false
    return true
  })

  const today_sales = sales.filter(s => s.date === today())
  const month_sales = sales.filter(s => s.date.startsWith(today().slice(0, 7)))
  const totalToday = today_sales.reduce((sum, s) => sum + s.totalAmount, 0)
  const totalMonth = month_sales.reduce((sum, s) => sum + s.totalAmount, 0)
  const profitMonth = month_sales.reduce((sum, s) => sum + s.totalProfit, 0)

  // ── Nueva venta ──
  function addToCart() {
    const productId = parseInt(addProduct)
    const product = products.find(p => p.id === productId)
    if (!product) return
    if (addType === 'partial' && (!addPartialML || parseInt(addPartialML) <= 0)) return

    let unitCost = 0
    let label = ''
    let sizeML: number | undefined
    let lotInfo: string | undefined

    if (addType === 'sealed') {
      unitCost = product.costPYG
      label = `${product.brand} — ${product.name} ${product.sizeML}ml (sellado)`

      // Compute FIFO lot origin info
      const qty = parseInt(addQty) || 1
      const productLots = allStockEntries
        .filter(e => e.productId === productId)
        .sort((a, b) => a.date.localeCompare(b.date))

      let toAllocate = qty
      const lotsUsed: { date: string; cost: number }[] = []
      for (const lot of productLots) {
        if (toAllocate <= 0) break
        const available = lot.quantityRemaining !== undefined ? lot.quantityRemaining : lot.quantity
        if (available <= 0) continue
        lotsUsed.push({ date: lot.date, cost: lot.costPYG })
        toAllocate -= available
      }

      if (lotsUsed.length === 1) {
        lotInfo = `Lote ${fmtDate(lotsUsed[0].date)} — ${fmtPYG(Math.round(lotsUsed[0].cost))}/u.`
      } else if (lotsUsed.length > 1) {
        lotInfo = `${lotsUsed.length} lotes: ${lotsUsed.map(l => fmtDate(l.date)).join(', ')}`
      }
    } else if (addType === 'decant') {
      const size = parseInt(addSize)
      sizeML = size
      const cpm = product.type === 'decant_source' ? product.costPYG : product.costPYG / product.sizeML
      const batch = batches.find(b => b.productId === productId && b.sizeML === size)
      const supplyCost = batch ? (batch.costPerDecant - cpm * size) : 0
      unitCost = cpm * size + supplyCost
      label = `${product.brand} — ${product.name} ${size}ml (decant)`
    } else if (addType === 'partial') {
      const ml = parseInt(addPartialML)
      sizeML = ml
      const cpm = product.type === 'decant_source' ? product.costPYG : product.costPYG / product.sizeML
      unitCost = cpm * ml
      label = `${product.brand} — ${product.name} ${ml}ml (parcial)`
    }

    const qty = addType === 'partial' ? 1 : (parseInt(addQty) || 1)
    const existing = cart.findIndex(c => c.productId === productId && c.type === addType && c.sizeML === sizeML)
    if (existing >= 0 && addType !== 'partial') {
      setCart(c => c.map((item, i) => i === existing ? { ...item, quantity: item.quantity + qty } : item))
    } else {
      setCart(c => [...c, {
        productId, type: addType, sizeML,
        quantity: qty,
        unitCost: Math.round(unitCost),
        unitPrice: parseFloat(addPrice) || 0,
        label, lotInfo,
      }])
    }
    setAddPrice('')
    setAddQty('1')
    setAddPartialML('')
  }

  const cartTotal = cart.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const cartCost = cart.reduce((s, i) => s + i.quantity * i.unitCost, 0)
  const cartProfit = cartTotal - cartCost

  async function handleCreateOrder() {
    if (!cart.length || !customerName.trim()) return
    const now = nowISO()
    const customerId = await upsertCustomer(customerName, customerPhone)

    await db.localOrders.add({
      customerId,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || undefined,
      customerAddress: undefined,
      items: cart.map(item => ({
        productId: item.productId,
        type: item.type,
        sizeML: item.sizeML,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      supplies: [],
      shippingCost: 0,
      shippingPaidBy: 'customer',
      totalAmount: cartTotal,
      totalCost: 0,
      status: 'pending',
      orderDate: saleDate,
      notes: saleNotes || undefined,
      createdAt: now,
      updatedAt: now,
    })

    setCart([])
    setCustomerName('')
    setCustomerPhone('')
    setSaleNotes('')
    setShowNew(false)
  }

  // ── Editar venta ──
  function openEditSale(s: Sale) {
    setEditSale(s)
    setEditSaleForm({
      paymentMethod: s.paymentMethod,
      accountId: String(s.accountId),
      date: s.date,
      notes: s.notes ?? '',
    })
  }

  function closeEditSale() {
    setEditSale(null)
    setEditSaleForm({ paymentMethod: 'cash', accountId: '', date: today(), notes: '' })
  }

  async function handleEditSale() {
    if (!editSale) return
    const newAccountId = parseInt(editSaleForm.accountId)
    const oldAccountId = editSale.accountId

    if (newAccountId !== oldAccountId) {
      await db.accounts.where('id').equals(oldAccountId).modify(a => { a.balance -= editSale.totalAmount })
      await db.accounts.where('id').equals(newAccountId).modify(a => { a.balance += editSale.totalAmount })
    }

    await db.sales.update(editSale.id!, {
      paymentMethod: editSaleForm.paymentMethod,
      accountId: newAccountId,
      date: editSaleForm.date,
      notes: editSaleForm.notes,
    })

    // Update the related movement
    const allMovements = await db.movements.toArray()
    const saleMovement = allMovements.find(m => m.referenceId === editSale.id! && m.referenceType === 'sale')
    if (saleMovement?.id) {
      await db.movements.update(saleMovement.id, { accountId: newAccountId, date: editSaleForm.date })
    }

    closeEditSale()
  }

  // ── Eliminar venta ──
  async function handleDeleteSale(sale: Sale) {
    const msgExtra = sale.referenceType === 'local_order'
      ? 'El saldo de la cuenta será revertido. El stock NO se restaura (producto ya entregado).'
      : 'El stock y saldo de cuenta serán revertidos automáticamente.'
    if (!confirm(`¿Eliminar la venta de ${fmtPYG(sale.totalAmount)} del ${fmtDate(sale.date)}?\n${msgExtra}`)) return

    // Ventas provenientes de logística: revertir cobro + eliminar pedido completo
    if (sale.referenceType === 'local_order' && sale.referenceId) {
      const movement = await db.movements.where('referenceId').equals(sale.referenceId).filter(m => m.referenceType === 'local_order').first()
      await db.transaction('rw', [db.sales, db.saleItems, db.accounts, db.movements, db.localOrders], async () => {
        await db.accounts.where('id').equals(sale.accountId).modify(a => { a.balance -= sale.totalAmount })
        if (movement?.id) await db.movements.delete(movement.id)
        await db.saleItems.where('saleId').equals(sale.id!).delete()
        await db.sales.delete(sale.id!)
        await db.localOrders.delete(sale.referenceId!)
      })
      return
    }

    const items = await db.saleItems.where('saleId').equals(sale.id!).toArray()

    for (const item of items) {
      if (item.type === 'sealed') {
        // Restore product stock
        await db.products.where('id').equals(item.productId).modify(p => {
          p.stockSealed += item.quantity
        })

        // Reverse FIFO: add back to newest lots first (they were last deducted)
        const productLots = await db.stockEntries
          .where('productId').equals(item.productId)
          .toArray()
        const sortedDesc = productLots
          .filter(l => l.quantityRemaining !== undefined)
          .sort((a, b) => b.date.localeCompare(a.date))

        let toRestore = item.quantity
        for (const lot of sortedDesc) {
          if (toRestore <= 0) break
          const deducted = lot.quantity - lot.quantityRemaining!
          if (deducted <= 0) continue
          const restore = Math.min(deducted, toRestore)
          await db.stockEntries.update(lot.id!, { quantityRemaining: lot.quantityRemaining! + restore })
          toRestore -= restore
        }
      } else if (item.type === 'decant' && item.sizeML) {
        const sizeML = item.sizeML
        const mlToRestore = item.quantity * sizeML

        // Restore ML to source bottle
        await db.products.where('id').equals(item.productId).modify(p => {
          p.stockOpenML += mlToRestore
        })

        // Reverse FIFO: add ML back to newest lots first
        const productLots = await db.stockEntries
          .where('productId').equals(item.productId)
          .toArray()
        const sortedDesc = productLots
          .filter(l => l.quantityRemaining !== undefined)
          .sort((a, b) => b.date.localeCompare(a.date))

        let mlLeft = mlToRestore
        for (const lot of sortedDesc) {
          if (mlLeft <= 0) break
          const deducted = lot.quantity - lot.quantityRemaining!
          if (deducted <= 0) continue
          const restore = Math.min(deducted, mlLeft)
          await db.stockEntries.update(lot.id!, { quantityRemaining: lot.quantityRemaining! + restore })
          mlLeft -= restore
        }

        // Restore supply stock
        const supply = allSupplies.find(s => s.sizeML === sizeML)
        if (supply?.id) {
          await db.supplies.update(supply.id, { stock: supply.stock + item.quantity, updatedAt: nowISO() })
        }

        // Delete the linked DecantBatch record
        const linkedBatches = await db.decantBatches.where('productId').equals(item.productId).toArray()
        const match = linkedBatches.find(b => b.sourceType === 'sale' && b.sourceId === sale.id! && b.sizeML === sizeML)
        if (match?.id) await db.decantBatches.delete(match.id)
      }
    }

    // Reverse account balance
    await db.accounts.where('id').equals(sale.accountId).modify(a => { a.balance -= sale.totalAmount })

    // Delete accounting movement
    const allMovements = await db.movements.toArray()
    const saleMovement = allMovements.find(m => m.referenceId === sale.id! && m.referenceType === 'sale')
    if (saleMovement?.id) await db.movements.delete(saleMovement.id)

    await db.saleItems.where('saleId').equals(sale.id!).delete()
    await db.sales.delete(sale.id!)
  }

  const decantProducts = products.filter(p => p.stockOpenML > 0)
  const sealedProducts = products.filter(p => p.type === 'sealed' || p.type === 'tester')

  return (
    <div>
      <PageHeader
        title="Ventas"
        subtitle="Registro de ventas y análisis de ingresos"
        action={<Button icon={<Plus size={15} />} onClick={() => setShowNew(true)}>Nuevo pedido</Button>}
      />

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-500">Ventas hoy</p>
          <p className="text-2xl font-bold text-gray-900">{fmtPYG(totalToday)}</p>
          <p className="text-xs text-gray-400">{today_sales.length} venta{today_sales.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-500">Total del mes</p>
          <p className="text-2xl font-bold text-gray-900">{fmtPYG(totalMonth)}</p>
          <p className="text-xs text-gray-400">{month_sales.length} ventas</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
          <div className="flex items-center gap-1 text-green-600 mb-1">
            <TrendingUp size={14} />
            <span className="text-sm font-medium">Utilidad del mes</span>
          </div>
          <p className="text-2xl font-bold text-green-700">{fmtPYG(profitMonth)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-4">
        <input
          type="month"
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
          value={filterDate}
          onChange={e => setFilterDate(e.target.value)}
        />
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder="Buscar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Tabla ventas */}
      <Card>
        {filteredSales.length === 0 ? (
          <CardBody className="text-center py-12">
            <ShoppingCart size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400">No hay ventas registradas</p>
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Fecha</th>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Cliente</th>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Pago</th>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Notas</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">Total</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">Costo</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">Utilidad</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {filteredSales.map(s => {
                  const isExpanded = expandedSaleId === s.id
                  const saleItems = allSaleItems.filter(si => si.saleId === s.id)

                  return (
                    <Fragment key={s.id}>
                      <tr className={`border-b transition-colors ${isExpanded ? 'border-violet-100 bg-violet-50/30' : 'border-gray-50 hover:bg-gray-50'}`}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setExpandedSaleId(prev => prev === s.id ? null : s.id!)}
                              className="p-0.5 rounded text-gray-300 hover:text-violet-600 transition-colors cursor-pointer shrink-0"
                              title={isExpanded ? 'Ocultar detalle' : 'Ver productos'}
                            >
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                            <span className="text-gray-500">{fmtDate(s.date)}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-gray-700 max-w-36 truncate">{s.customerName || '—'}</td>
                        <td className="px-5 py-3">
                          <Badge color={paymentColors[s.paymentMethod]}>{paymentLabels[s.paymentMethod]}</Badge>
                        </td>
                        <td className="px-5 py-3 text-gray-500 max-w-36 truncate">{s.notes || '—'}</td>
                        <td className="px-5 py-3 text-right font-semibold text-gray-900">{fmtPYG(s.totalAmount)}</td>
                        <td className="px-5 py-3 text-right text-gray-500">{fmtPYG(s.totalCost)}</td>
                        <td className="px-5 py-3 text-right font-semibold text-green-600">{fmtPYG(s.totalProfit)}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditSale(s)}
                              className="p-1.5 rounded-lg text-gray-300 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
                              title="Editar venta"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteSale(s)}
                              className="p-1.5 rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors cursor-pointer"
                              title="Eliminar venta"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Detalle de productos vendidos */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} className="px-5 pb-3 pt-0 bg-violet-50/10">
                            <div className="rounded-xl border border-violet-100 bg-white overflow-hidden">
                              <div className="px-4 py-2 bg-violet-50 border-b border-violet-100">
                                <span className="text-xs font-semibold text-violet-700 uppercase tracking-wide">
                                  Productos vendidos · {saleItems.length} línea{saleItems.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                              {saleItems.length === 0 ? (
                                <p className="text-sm text-gray-400 px-4 py-3">Sin detalle disponible</p>
                              ) : (
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="text-xs border-b border-gray-100 bg-gray-50/60">
                                      <th className="px-4 py-2 text-left text-gray-400 font-medium">Producto</th>
                                      <th className="px-4 py-2 text-right text-gray-400 font-medium">Cant.</th>
                                      <th className="px-4 py-2 text-right text-gray-400 font-medium">Costo/u.</th>
                                      <th className="px-4 py-2 text-right text-gray-400 font-medium">Precio/u.</th>
                                      <th className="px-4 py-2 text-right text-gray-400 font-medium">Utilidad</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {saleItems.map(si => {
                                      const product = products.find(p => p.id === si.productId)
                                      const margin = si.unitPrice > 0
                                        ? Math.round((si.unitPrice - si.unitCost) / si.unitPrice * 100)
                                        : 0
                                      return (
                                        <tr key={si.id} className="border-b border-gray-50 last:border-0">
                                          <td className="px-4 py-2.5">
                                            <p className="text-gray-900 font-medium">
                                              {product ? `${product.brand} — ${product.name}` : `Producto #${si.productId}`}
                                            </p>
                                            <p className="text-xs text-gray-400">
                                              {si.type === 'sealed' ? 'Sellado' : si.type === 'partial' ? `Parcial ${si.sizeML}ml` : `Decant ${si.sizeML}ml`}
                                            </p>
                                          </td>
                                          <td className="px-4 py-2.5 text-right text-gray-700">{si.quantity} u.</td>
                                          <td className="px-4 py-2.5 text-right text-gray-500">{fmtPYG(si.unitCost)}</td>
                                          <td className="px-4 py-2.5 text-right text-gray-900 font-medium">{fmtPYG(si.unitPrice)}</td>
                                          <td className="px-4 py-2.5 text-right">
                                            <p className="font-semibold text-green-600">{fmtPYG(si.profit)}</p>
                                            <p className="text-xs text-gray-400">+{margin}%</p>
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                  <tfoot>
                                    <tr className="bg-gray-50 border-t border-gray-100">
                                      <td colSpan={3} className="px-4 py-2 text-xs text-gray-400">
                                        {s.notes && <span className="italic">"{s.notes}"</span>}
                                      </td>
                                      <td className="px-4 py-2 text-right text-sm font-bold text-gray-900">{fmtPYG(s.totalAmount)}</td>
                                      <td className="px-4 py-2 text-right text-sm font-bold text-green-600">{fmtPYG(s.totalProfit)}</td>
                                    </tr>
                                  </tfoot>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Modal nuevo pedido ── */}
      <Modal isOpen={showNew} onClose={() => { setShowNew(false); setCart([]) }} title="Nuevo pedido" size="xl">
        <div className="space-y-4">
          {/* Cliente */}
          <div className="grid grid-cols-2 gap-3">
            <CustomerAutocomplete
              label="Nombre del cliente"
              value={customerName}
              onChange={setCustomerName}
              onSelect={c => { setCustomerName(c.name); setCustomerPhone(c.phone ?? '') }}
              customers={customers}
            />
            <Input label="Teléfono (opcional)" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
          </div>
          {/* Agregar producto */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">Agregar producto</p>
            <div className="flex gap-2">
              {(['sealed', 'decant', 'partial'] as const).map(t => (
                <button key={t} onClick={() => { setAddType(t); setAddProduct('0'); setAddPartialML('') }} className={`flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer ${addType === t ? 'bg-violet-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
                  {t === 'sealed' ? 'Sellado' : t === 'decant' ? 'Decant' : 'Parcial'}
                </button>
              ))}
            </div>
            <Select
              label={addType === 'partial' ? 'Producto (frasco abierto)' : 'Producto'}
              value={addProduct}
              onChange={e => {
                setAddProduct(e.target.value)
                if (addType === 'partial') {
                  const prod = products.find(p => p.id === parseInt(e.target.value))
                  if (prod) setAddPartialML(String(prod.stockOpenML))
                }
              }}
              options={[
                { value: '0', label: 'Seleccionar...' },
                ...(addType === 'sealed' ? sealedProducts : decantProducts).map(p => ({
                  value: String(p.id),
                  label: addType === 'partial'
                    ? `${p.brand} — ${p.name} (${p.stockOpenML}ml disponibles)`
                    : `${p.brand} — ${p.name}`,
                })),
              ]}
            />
            {addType === 'decant' && (
              <Select
                label="Tamaño"
                value={addSize}
                onChange={e => setAddSize(e.target.value)}
                options={[3, 5, 10, 30].map(s => ({ value: String(s), label: `${s}ml` }))}
              />
            )}
            {addType === 'partial' && (
              <Input
                label="ML a vender"
                type="number"
                value={addPartialML}
                onChange={e => setAddPartialML(e.target.value)}
                placeholder="Ej: 40"
              />
            )}
            <div className={`grid gap-3 ${addType === 'partial' ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {addType !== 'partial' && (
                <Input label="Cantidad" type="number" value={addQty} onChange={e => setAddQty(e.target.value)} />
              )}
              <Input label={addType === 'partial' ? 'Precio total del parcial (Gs.)' : 'Precio unitario (Gs.)'} type="number" value={addPrice} onChange={e => setAddPrice(e.target.value)} />
            </div>
            <Button variant="secondary" className="w-full" onClick={addToCart} disabled={!addProduct || addProduct === '0'}>
              Agregar al carrito
            </Button>
          </div>

          {/* Carrito */}
          {cart.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Carrito ({cart.length})</p>
              {cart.map((item, i) => (
                <div key={i} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">{item.label}</p>
                    <p className="text-xs text-gray-500">Costo: {fmtPYG(item.unitCost)} · Precio: {fmtPYG(item.unitPrice)} · x{item.quantity}</p>
                    {item.lotInfo && (
                      <p className="text-xs text-violet-500 mt-0.5">↳ {item.lotInfo}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <span className="text-sm font-semibold text-gray-900">{fmtPYG(item.quantity * item.unitPrice)}</span>
                    <button onClick={() => setCart(c => c.filter((_, j) => j !== i))} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 cursor-pointer">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
              <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Total</span><span className="font-bold text-gray-900">{fmtPYG(cartTotal)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Costo</span><span className="text-gray-600">{fmtPYG(cartCost)}</span></div>
                <div className="flex justify-between"><span className="text-green-600 font-medium">Utilidad</span><span className="font-bold text-green-700">{fmtPYG(cartProfit)}</span></div>
              </div>
            </div>
          )}

          <Input label="Fecha del pedido" type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} />
          <Textarea label="Notas (opcional)" value={saleNotes} onChange={e => setSaleNotes(e.target.value)} rows={2} />
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleCreateOrder} disabled={!cart.length || !customerName.trim()}>
              Crear pedido — {fmtPYG(cartTotal)}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal editar venta ── */}
      <Modal isOpen={!!editSale} onClose={closeEditSale} title="Editar venta">
        {editSale && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
              <p className="font-medium text-gray-900">{fmtPYG(editSale.totalAmount)}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {allSaleItems.filter(si => si.saleId === editSale.id).length} producto(s) · Para modificar los productos, eliminá y volvé a registrar la venta.
              </p>
            </div>
            <Input
              label="Fecha"
              type="date"
              value={editSaleForm.date}
              onChange={e => setEditSaleForm(f => ({ ...f, date: e.target.value }))}
            />
            <Select
              label="Método de pago"
              value={editSaleForm.paymentMethod}
              onChange={e => setEditSaleForm(f => ({ ...f, paymentMethod: e.target.value as PaymentMethod }))}
              options={[{ value: 'cash', label: 'Efectivo' }, { value: 'transfer', label: 'Transferencia' }, { value: 'card', label: 'Tarjeta' }, { value: 'other', label: 'Otro' }]}
            />
            <Select
              label="Cuenta"
              value={editSaleForm.accountId}
              onChange={e => setEditSaleForm(f => ({ ...f, accountId: e.target.value }))}
              options={[{ value: '', label: 'Seleccionar...' }, ...accounts.map(a => ({ value: String(a.id), label: `${a.name} — ${fmtPYG(a.balance)}` }))]}
            />
            <Textarea
              label="Notas"
              value={editSaleForm.notes}
              onChange={e => setEditSaleForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
            />
            <div className="flex gap-2 pt-2">
              <Button variant="secondary" className="flex-1" onClick={closeEditSale}>Cancelar</Button>
              <Button className="flex-1" onClick={handleEditSale} disabled={!editSaleForm.accountId}>
                Guardar cambios
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
