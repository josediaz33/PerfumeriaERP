import { useState, Fragment } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Package, Search, AlertTriangle, Edit2, Trash2, Info, ChevronDown, ChevronRight, Truck, X } from 'lucide-react'
import { db } from '../db/db'
import type { Concentration, OlfactiveFamily, ProductType, StockEntry } from '../db/types'
import { fmtPYG, fmtUSD, fmtDate, today, nowISO } from '../lib/format'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Card, CardBody } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Input, Select, Textarea } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'

const concentrations: Concentration[] = ['EDP', 'EDT', 'EDC', 'EXP', 'PARFUM', 'OTHER']
const families: { value: OlfactiveFamily; label: string }[] = [
  { value: 'floral', label: 'Floral' }, { value: 'woody', label: 'Amaderado' },
  { value: 'oriental', label: 'Oriental' }, { value: 'fresh', label: 'Fresco' },
  { value: 'citrus', label: 'Cítrico' }, { value: 'aromatic', label: 'Aromático' },
  { value: 'gourmand', label: 'Gourmand' }, { value: 'chypre', label: 'Chypre' },
  { value: 'fougere', label: 'Fougère' }, { value: 'other', label: 'Otro' },
]

const emptyDefForm = {
  name: '', brand: '', olfactiveFamily: 'floral' as OlfactiveFamily,
  concentration: 'EDP' as Concentration, sizeML: '100',
  type: 'sealed' as ProductType, sellingPricePYG: '', minStock: '1', notes: '',
  costPYG: '0', stockSealed: '0', stockOpenML: '0',
  price3ML: '', price5ML: '', price10ML: '', price30ML: '',
}

interface BatchFormItem {
  productId: number
  bottles: string
  costUSD: string
}
const emptyBatchItem = (): BatchFormItem => ({ productId: 0, bottles: '', costUSD: '' })

const emptyStockForm = {
  productId: 0, type: 'sealed' as ProductType,
  quantity: '', costUSD: '', exchangeRate: '7500', shippingCostPYG: '0',
  supplierId: '', date: today(),
  registerPayment: false, paymentAccountId: '',
  localCurrency: false,
}

export function Inventario() {
  const suppliers = useLiveQuery(() => db.suppliers.toArray()) ?? []
  const accounts = useLiveQuery(() => db.accounts.filter(a => a.isActive !== false).toArray()) ?? []
  const products = useLiveQuery(() => db.products.orderBy('brand').toArray()) ?? []
  const allEntries = useLiveQuery(() => db.stockEntries.orderBy('date').toArray()) ?? []

  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | ProductType>('all')
  const [filterFamily, setFilterFamily] = useState<string>('all')
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyDefForm)

  const [showStock, setShowStock] = useState(false)
  const [stockForm, setStockForm] = useState(emptyStockForm)

  // Modal lote de envío (multi-producto)
  const [showBatch, setShowBatch] = useState(false)
  const [batchDate, setBatchDate] = useState(today())
  const [batchSupplierId, setBatchSupplierId] = useState('')
  const [batchRate, setBatchRate] = useState('7500')
  const [batchShipping, setBatchShipping] = useState('')
  const [batchNotes, setBatchNotes] = useState('')
  const [batchItems, setBatchItems] = useState<BatchFormItem[]>([emptyBatchItem()])
  const [batchLocalCurrency, setBatchLocalCurrency] = useState(false)

  // Modal editar lote
  const [editLote, setEditLote] = useState<StockEntry | null>(null)
  const [editLoteIsLocal, setEditLoteIsLocal] = useState(false)
  const [editLoteForm, setEditLoteForm] = useState({
    date: '', quantity: '', costUSD: '', exchangeRate: '7500', shippingCostPYG: '0',
  })

  const filtered = products.filter(p => {
    if (filterType !== 'all' && p.type !== filterType) return false
    if (filterFamily !== 'all' && p.olfactiveFamily !== filterFamily) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.brand.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function toggleExpand(id: number) {
    setExpandedProductId(prev => prev === id ? null : id)
  }

  function openNew() {
    setEditId(null)
    setForm(emptyDefForm)
    setShowForm(true)
  }

  function openEdit(p: typeof products[0]) {
    setEditId(p.id!)
    setForm({
      name: p.name, brand: p.brand, olfactiveFamily: p.olfactiveFamily,
      concentration: p.concentration, sizeML: String(p.sizeML),
      type: p.type, sellingPricePYG: String(p.sellingPricePYG),
      minStock: String(p.minStock), notes: p.notes ?? '',
      costPYG: String(Math.round(p.costPYG)),
      stockSealed: String(p.stockSealed),
      stockOpenML: String(p.stockOpenML),
      price3ML: p.price3ML ? String(p.price3ML) : '',
      price5ML: p.price5ML ? String(p.price5ML) : '',
      price10ML: p.price10ML ? String(p.price10ML) : '',
      price30ML: p.price30ML ? String(p.price30ML) : '',
    })
    setShowForm(true)
  }

  function openIngresar(productId?: number) {
    const product = productId ? products.find(p => p.id === productId) : undefined
    setStockForm({ ...emptyStockForm, productId: productId ?? 0, type: product?.type ?? 'sealed' })
    setShowStock(true)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.brand.trim()) return
    const now = nowISO()
    const decantPrices = form.type === 'decant_source' ? {
      price3ML: parseFloat(form.price3ML) || undefined,
      price5ML: parseFloat(form.price5ML) || undefined,
      price10ML: parseFloat(form.price10ML) || undefined,
      price30ML: parseFloat(form.price30ML) || undefined,
    } : {}
    if (editId) {
      const oldProduct = products.find(p => p.id === editId)
      const newStockSealed = parseInt(form.stockSealed) || 0
      const newStockOpenML = parseFloat(form.stockOpenML) || 0

      await db.transaction('rw', db.products, db.stockEntries, async () => {
        await db.products.update(editId, {
          name: form.name, brand: form.brand, olfactiveFamily: form.olfactiveFamily,
          concentration: form.concentration, sizeML: parseFloat(form.sizeML),
          type: form.type, sellingPricePYG: parseFloat(form.sellingPricePYG) || 0,
          minStock: parseInt(form.minStock) || 1, notes: form.notes,
          costPYG: parseFloat(form.costPYG) || 0,
          stockSealed: newStockSealed,
          stockOpenML: newStockOpenML,
          updatedAt: now, ...decantPrices,
        })

        // Sync quantityRemaining on lots using FIFO when stock was manually corrected
        if (oldProduct) {
          if (newStockSealed !== oldProduct.stockSealed) {
            const entries = (await db.stockEntries.where('productId').equals(editId).toArray())
              .filter(e => e.type === 'sealed')
              .sort((a, b) => b.date.localeCompare(a.date)) // newest first (FIFO: oldest consumed first)
            let left = newStockSealed
            for (const e of entries) {
              const rem = Math.max(0, Math.min(e.quantity, left))
              await db.stockEntries.update(e.id!, { quantityRemaining: rem })
              left = Math.max(0, left - rem)
            }
          }
          if (newStockOpenML !== oldProduct.stockOpenML) {
            const entries = (await db.stockEntries.where('productId').equals(editId).toArray())
              .filter(e => e.type === 'decant_source')
              .sort((a, b) => b.date.localeCompare(a.date)) // newest first
            let left = newStockOpenML
            for (const e of entries) {
              const rem = Math.max(0, Math.min(e.quantity, left))
              await db.stockEntries.update(e.id!, { quantityRemaining: rem })
              left = Math.max(0, left - rem)
            }
          }
        }
      })
    } else {
      await db.products.add({
        name: form.name, brand: form.brand, olfactiveFamily: form.olfactiveFamily,
        concentration: form.concentration, sizeML: parseFloat(form.sizeML),
        type: form.type, sellingPricePYG: parseFloat(form.sellingPricePYG) || 0,
        minStock: parseInt(form.minStock) || 1, notes: form.notes,
        costPYG: 0, costUSD: 0, exchangeRateUsed: 7500,
        stockSealed: 0, stockOpenML: 0,
        createdAt: now, updatedAt: now, ...decantPrices,
      })
    }
    setShowForm(false)
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este producto? También se eliminarán todos sus lotes de stock.')) return
    await db.transaction('rw', db.products, db.stockEntries, async () => {
      await db.stockEntries.where('productId').equals(id).delete()
      await db.products.delete(id)
    })
  }

  function openEditLote(entry: StockEntry) {
    const prod = products.find(p => p.id === entry.productId)
    const isDecant = entry.type === 'decant_source'
    const isLocal = entry.exchangeRate === 1
    const sizeML = prod?.sizeML ?? 1
    // Display in user-friendly units: bottles for decant, units for sealed
    const displayQty = isDecant ? entry.quantity / sizeML : entry.quantity
    // For local purchases: costUSD stores the PYG value directly (exchangeRate=1)
    const displayCost = isDecant ? entry.costUSD * sizeML : entry.costUSD
    const impliedTotalShipping = Math.max(0, Math.round(
      (entry.costPYG - entry.costUSD * entry.exchangeRate) * entry.quantity
    ))
    setEditLote(entry)
    setEditLoteIsLocal(isLocal)
    setEditLoteForm({
      date: entry.date,
      quantity: String(displayQty),
      costUSD: String(displayCost),
      exchangeRate: String(entry.exchangeRate),
      shippingCostPYG: String(impliedTotalShipping),
    })
  }

  async function handleEditLote() {
    if (!editLote) return
    const product = products.find(p => p.id === editLote.productId)
    if (!product) return

    const isDecant = editLote.type === 'decant_source'
    const sizeML = product.sizeML || 1
    const formQty = parseFloat(editLoteForm.quantity) // bottles or units
    const formCostUSD = parseFloat(editLoteForm.costUSD) // per bottle or per unit
    const newExchangeRate = parseFloat(editLoteForm.exchangeRate) || 7500
    const newShippingTotal = parseFloat(editLoteForm.shippingCostPYG) || 0

    // Convert back to stored units
    const newStoredQty = isDecant ? formQty * sizeML : formQty
    const newCostUSD = isDecant ? formCostUSD / sizeML : formCostUSD
    const shippingPerBottle = formQty > 0 ? newShippingTotal / formQty : 0
    const shippingPerStoredUnit = isDecant ? shippingPerBottle / sizeML : shippingPerBottle
    const newBatchCostPYG = newCostUSD * newExchangeRate + shippingPerStoredUnit

    const qtyDelta = newStoredQty - editLote.quantity
    const oldRemaining = editLote.quantityRemaining ?? editLote.quantity
    const newRemaining = Math.max(0, Math.min(newStoredQty, oldRemaining + qtyDelta))

    // Recalculate CPP from all lots with this one updated
    const allProductLots = await db.stockEntries.where('productId').equals(editLote.productId).toArray()
    const updatedLots = allProductLots.map(l =>
      l.id === editLote.id ? { ...l, quantity: newStoredQty, costPYG: newBatchCostPYG, costUSD: newCostUSD } : l
    )
    const totalQty = updatedLots.reduce((s, l) => s + l.quantity, 0)
    const newCPP = totalQty > 0 ? updatedLots.reduce((s, l) => s + l.costPYG * l.quantity, 0) / totalQty : 0
    const newCostUSDAvg = totalQty > 0 ? updatedLots.reduce((s, l) => s + l.costUSD * l.quantity, 0) / totalQty : 0

    const now = nowISO()
    await db.transaction('rw', db.products, db.stockEntries, async () => {
      await db.stockEntries.update(editLote.id!, {
        quantity: newStoredQty,
        quantityRemaining: newRemaining,
        costUSD: newCostUSD,
        exchangeRate: newExchangeRate,
        costPYG: newBatchCostPYG,
        date: editLoteForm.date,
      })
      await db.products.where('id').equals(editLote.productId).modify(p => {
        if (editLote.type === 'sealed') p.stockSealed = Math.max(0, p.stockSealed + qtyDelta)
        else p.stockOpenML = Math.max(0, p.stockOpenML + qtyDelta)
        p.costPYG = newCPP
        p.costUSD = newCostUSDAvg
        p.exchangeRateUsed = newExchangeRate
        p.updatedAt = now
      })
    })
    setEditLote(null)
  }

  async function handleDeleteLote(entry: StockEntry) {
    const product = products.find(p => p.id === entry.productId)
    if (!product) return
    const unit = entry.type === 'sealed' ? 'u.' : 'ml'
    if (!confirm(`¿Eliminar el lote de ${entry.quantity} ${unit} ingresado el ${fmtDate(entry.date)}?\nEl stock se ajustará y el CPP se recalculará con los lotes restantes.`)) return

    const remaining = allEntries.filter(e => e.id !== entry.id && e.productId === entry.productId)
    const totalQty = remaining.reduce((s, e) => s + e.quantity, 0)
    const newCPP = totalQty > 0
      ? remaining.reduce((s, e) => s + e.costPYG * e.quantity, 0) / totalQty
      : 0
    const newCostUSD = totalQty > 0
      ? remaining.reduce((s, e) => s + e.costUSD * e.quantity, 0) / totalQty
      : 0
    const lastEntry = remaining[remaining.length - 1]

    await db.transaction('rw', db.products, db.stockEntries, async () => {
      await db.products.where('id').equals(entry.productId).modify(p => {
        if (entry.type === 'sealed') p.stockSealed = Math.max(0, p.stockSealed - entry.quantity)
        else p.stockOpenML = Math.max(0, p.stockOpenML - entry.quantity)
        p.costPYG = newCPP
        p.costUSD = newCostUSD
        if (lastEntry) p.exchangeRateUsed = lastEntry.exchangeRate
      })
      await db.stockEntries.delete(entry.id!)
    })
  }

  async function handleCreateBatch() {
    const validItems = batchItems.filter(i => i.productId && i.bottles && i.costUSD)
    if (validItems.length === 0) return

    const rate = batchLocalCurrency ? 1 : (parseFloat(batchRate) || 7500)
    const totalShipping = parseFloat(batchShipping) || 0
    const now = nowISO()

    const computed = validItems.map(item => {
      const prod = products.find(p => p.id === item.productId)!
      const isDecant = prod.type === 'decant_source'
      const sizeML = prod.sizeML || 1
      const formQty = parseFloat(item.bottles)
      const costUSD_input = parseFloat(item.costUSD)
      const actualQty = isDecant ? formQty * sizeML : formQty
      const costUSD = isDecant ? costUSD_input / sizeML : costUSD_input
      const usdValue = costUSD_input * formQty
      return { prod, isDecant, sizeML, formQty, actualQty, costUSD, usdValue }
    })

    const totalUSDValue = computed.reduce((s, i) => s + i.usdValue, 0)

    await db.transaction('rw', db.products, db.stockEntries, db.shipmentBatches, async () => {
      const batchId = await db.shipmentBatches.add({
        supplierId: batchSupplierId ? parseInt(batchSupplierId) : undefined,
        date: batchDate,
        description: `Lote de ${validItems.length} producto(s)`,
        exchangeRate: rate,
        totalShippingPYG: totalShipping,
        notes: batchNotes || undefined,
        createdAt: now,
      })

      for (const item of computed) {
        const { prod, isDecant, sizeML, formQty, actualQty, costUSD } = item
        const itemShipping = totalUSDValue > 0 ? totalShipping * (item.usdValue / totalUSDValue) : 0
        const shippingPerBottle = formQty > 0 ? itemShipping / formQty : 0
        const shippingPerStoredUnit = isDecant ? shippingPerBottle / sizeML : shippingPerBottle
        const batchCostPYG = costUSD * rate + shippingPerStoredUnit

        const existingQty = isDecant ? prod.stockOpenML : prod.stockSealed
        const newAvgCostPYG = existingQty > 0
          ? (existingQty * prod.costPYG + actualQty * batchCostPYG) / (existingQty + actualQty)
          : batchCostPYG

        await db.products.where('id').equals(prod.id!).modify(p => {
          if (isDecant) p.stockOpenML += actualQty
          else p.stockSealed += actualQty
          p.costPYG = newAvgCostPYG
          p.costUSD = costUSD
          p.exchangeRateUsed = rate
          p.updatedAt = now
        })
        await db.stockEntries.add({
          productId: prod.id!,
          supplierId: batchSupplierId ? parseInt(batchSupplierId) : undefined,
          shipmentBatchId: batchId as number,
          quantity: actualQty,
          quantityRemaining: actualQty,
          costUSD,
          exchangeRate: rate,
          costPYG: batchCostPYG,
          type: prod.type,
          date: batchDate,
          createdAt: now,
        })
      }
    })

    setShowBatch(false)
    setBatchItems([emptyBatchItem()])
    setBatchShipping('')
    setBatchNotes('')
    setBatchLocalCurrency(false)
  }

  async function handleAddStock() {
    const product = products.find(p => p.id === stockForm.productId)
    if (!product || !stockForm.quantity || !stockForm.costUSD) return

    const isDecant = product.type === 'decant_source'
    const isLocal = stockForm.localCurrency
    const sizeML = product.sizeML || 1
    const formQty = parseFloat(stockForm.quantity) // bottles for decant, units for sealed
    const costInput = parseFloat(stockForm.costUSD) // per bottle/unit (PYG if local, USD if not)
    const exchangeRate = isLocal ? 1 : (parseFloat(stockForm.exchangeRate) || 7500)
    const shippingTotal = parseFloat(stockForm.shippingCostPYG) || 0

    // Convert to stored units (ML for decant, units for sealed)
    const qty = isDecant ? formQty * sizeML : formQty
    // For local: costUSD field stores PYG per bottle, so stored costUSD = costPYG/sizeML (rate=1 makes math identical)
    const costUSD = isDecant ? costInput / sizeML : costInput
    const shippingPerBottle = formQty > 0 ? shippingTotal / formQty : 0
    const shippingPerStoredUnit = isDecant ? shippingPerBottle / sizeML : shippingPerBottle
    const batchCostPYG = costUSD * exchangeRate + shippingPerStoredUnit

    const existingQty = isDecant ? product.stockOpenML : product.stockSealed
    const newAvgCostPYG = existingQty > 0
      ? (existingQty * product.costPYG + qty * batchCostPYG) / (existingQty + qty)
      : batchCostPYG

    const now = nowISO()
    const payAccount = stockForm.registerPayment && stockForm.paymentAccountId
      ? parseInt(stockForm.paymentAccountId)
      : null
    const totalPayment = Math.round(qty * batchCostPYG)

    if (payAccount) {
      await db.transaction('rw', db.products, db.stockEntries, db.movements, db.accounts, async () => {
        await db.products.where('id').equals(product.id!).modify(p => {
          if (stockForm.type === 'sealed') p.stockSealed += qty
          else p.stockOpenML += qty
          p.costPYG = newAvgCostPYG
          p.costUSD = costUSD
          p.exchangeRateUsed = exchangeRate
        })
        const entryId = await db.stockEntries.add({
          productId: product.id!, supplierId: stockForm.supplierId ? parseInt(stockForm.supplierId) : undefined,
          quantity: qty, quantityRemaining: qty, costUSD, exchangeRate, costPYG: batchCostPYG,
          type: stockForm.type, date: stockForm.date, createdAt: now,
        })
        await db.movements.add({
          type: 'expense', category: 'restock', amount: totalPayment,
          accountId: payAccount,
          description: `Compra de stock: ${product.name} (${qty} ${stockForm.type === 'sealed' ? 'u.' : 'ml'})`,
          referenceId: entryId as number, referenceType: 'stock_entry',
          date: stockForm.date, createdAt: now,
        })
        await db.accounts.where('id').equals(payAccount).modify(a => { a.balance -= totalPayment })
      })
    } else {
      await db.transaction('rw', db.products, db.stockEntries, async () => {
        await db.products.where('id').equals(product.id!).modify(p => {
          if (stockForm.type === 'sealed') p.stockSealed += qty
          else p.stockOpenML += qty
          p.costPYG = newAvgCostPYG
          p.costUSD = costUSD
          p.exchangeRateUsed = exchangeRate
        })
        await db.stockEntries.add({
          productId: product.id!, supplierId: stockForm.supplierId ? parseInt(stockForm.supplierId) : undefined,
          quantity: qty, quantityRemaining: qty, costUSD, exchangeRate, costPYG: batchCostPYG,
          type: stockForm.type, date: stockForm.date, createdAt: now,
        })
      })
    }
    setStockForm(emptyStockForm)
    setShowStock(false)
  }

  // Real-time CPP preview
  const stockProduct = products.find(p => p.id === stockForm.productId)
  const isDecantStock = stockProduct?.type === 'decant_source'
  const decantSizeML = stockProduct?.sizeML || 1
  const stockQty = parseFloat(stockForm.quantity) || 0  // bottles or units (user input)
  const stockCostUSD = parseFloat(stockForm.costUSD) || 0  // per bottle or per unit (PYG if localCurrency)
  const stockRate = stockForm.localCurrency ? 1 : (parseFloat(stockForm.exchangeRate) || 7500)
  const stockShipping = parseFloat(stockForm.shippingCostPYG) || 0
  // Per-stored-unit cost (per ML for decant, per unit for sealed)
  const stockCostUSDStored = isDecantStock ? stockCostUSD / decantSizeML : stockCostUSD
  const stockShippingPerBottle = stockQty > 0 ? stockShipping / stockQty : 0
  const stockShippingPerStoredUnit = isDecantStock ? stockShippingPerBottle / decantSizeML : stockShippingPerBottle
  const stockBatchCostPYG = stockCostUSDStored * stockRate + stockShippingPerStoredUnit  // per ML or per unit
  const stockActualQty = isDecantStock ? stockQty * decantSizeML : stockQty  // actual stored qty
  const existingQty = stockProduct ? (isDecantStock ? stockProduct.stockOpenML : stockProduct.stockSealed) : 0
  const stockNewAvgCost = existingQty > 0 && stockActualQty > 0
    ? (existingQty * (stockProduct?.costPYG ?? 0) + stockActualQty * stockBatchCostPYG) / (existingQty + stockActualQty)
    : stockBatchCostPYG

  // Real-time margin preview for edit modal
  const editCostPYG = parseFloat(form.costPYG) || 0
  const editSellPrice = parseFloat(form.sellingPricePYG) || 0
  const editMargin = editSellPrice > 0 && editCostPYG > 0
    ? ((editSellPrice - editCostPYG) / editSellPrice * 100) : 0

  // Real-time cost preview for edit lote modal (values are in user-facing units: bottles/units)
  const editLoteProduct = editLote ? products.find(p => p.id === editLote.productId) : null
  const isDecantEditLote = editLote?.type === 'decant_source'
  const editLoteSizeML = editLoteProduct?.sizeML || 1
  const editLoteQty = parseFloat(editLoteForm.quantity) || 0
  const editLoteCostUSD = parseFloat(editLoteForm.costUSD) || 0  // per bottle or unit
  const editLoteRate = parseFloat(editLoteForm.exchangeRate) || 7500
  const editLoteShipping = parseFloat(editLoteForm.shippingCostPYG) || 0
  const editLoteShippingPerUnit = editLoteQty > 0 ? editLoteShipping / editLoteQty : 0
  const editLoteCostUSDStored = isDecantEditLote ? editLoteCostUSD / editLoteSizeML : editLoteCostUSD
  const editLoteShippingStored = isDecantEditLote ? editLoteShippingPerUnit / editLoteSizeML : editLoteShippingPerUnit
  const editLoteBatchCostPYG = editLoteCostUSDStored * editLoteRate + editLoteShippingStored  // per ML or per unit

  return (
    <div>
      <PageHeader
        title="Inventario"
        subtitle="Perfumes sellados y botellas para decants"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Truck size={15} />} onClick={() => setShowBatch(true)}>Lote de envío</Button>
            <Button variant="secondary" icon={<Plus size={15} />} onClick={() => openIngresar()}>Ingresar stock</Button>
            <Button icon={<Plus size={15} />} onClick={openNew}>Nuevo producto</Button>
          </div>
        }
      />

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-500">Total productos</p>
          <p className="text-2xl font-bold text-gray-900">{products.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-500">Sellados en stock</p>
          <p className="text-2xl font-bold text-gray-900">{products.reduce((s, p) => s + p.stockSealed, 0)} u.</p>
        </div>
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
          <p className="text-sm text-orange-600">Stock bajo</p>
          <p className="text-2xl font-bold text-orange-700">{products.filter(p => p.stockSealed > 0 && p.stockSealed <= p.minStock).length}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder="Buscar por nombre o marca..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500" value={filterType} onChange={e => setFilterType(e.target.value as typeof filterType)}>
          <option value="all">Todos los tipos</option>
          <option value="sealed">Sellados</option>
          <option value="decant_source">Para decants</option>
        </select>
        <select className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500" value={filterFamily} onChange={e => setFilterFamily(e.target.value)}>
          <option value="all">Todas las familias</option>
          {families.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>

      {/* Tabla */}
      <Card>
        {filtered.length === 0 ? (
          <CardBody className="text-center py-12">
            <Package size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400">No hay productos que coincidan</p>
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Producto</th>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Tipo</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">Costo CPP</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">Precio venta</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">Stock</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const lowStock = p.stockSealed > 0 && p.stockSealed <= p.minStock
                  const noStock = p.type === 'sealed' ? p.stockSealed === 0 : p.stockOpenML === 0
                  const isExpanded = expandedProductId === p.id
                  const productEntries = allEntries.filter(e => e.productId === p.id)
                  const totalEntriesQty = productEntries.reduce((s, e) => s + e.quantity, 0)

                  // FIFO remaining: fill from NEWEST lot backward (oldest depleted first)
                  // If quantityRemaining is stored (set by Ventas), use it; otherwise calculate FIFO
                  const allHaveRemaining = productEntries.length > 0 && productEntries.every(e => e.quantityRemaining !== undefined)
                  const lotRemainingMap = new Map<number, number>()
                  if (allHaveRemaining) {
                    productEntries.forEach(e => lotRemainingMap.set(e.id!, e.quantityRemaining!))
                  } else {
                    const currentStock = p.type === 'sealed' ? p.stockSealed : p.stockOpenML
                    const sortedAsc = [...productEntries].sort((a, b) => a.date.localeCompare(b.date))
                    let stockLeft = currentStock
                    for (let i = sortedAsc.length - 1; i >= 0; i--) {
                      const e = sortedAsc[i]
                      const rem = Math.min(e.quantity, stockLeft)
                      lotRemainingMap.set(e.id!, rem)
                      stockLeft -= rem
                    }
                  }

                  return (
                    <Fragment key={p.id}>
                      {/* ── Product row ── */}
                      <tr className={`border-b transition-colors ${isExpanded ? 'border-violet-100 bg-violet-50/40' : 'border-gray-50 hover:bg-gray-50'}`}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleExpand(p.id!)}
                              className="p-0.5 rounded text-gray-300 hover:text-violet-600 transition-colors cursor-pointer shrink-0"
                              title={isExpanded ? 'Ocultar lotes' : 'Ver lotes'}
                            >
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                            <div>
                              <p className="font-medium text-gray-900">{p.name}</p>
                              <p className="text-xs text-gray-500">{p.brand} · {p.concentration} · {p.sizeML}ml</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <Badge color={p.type === 'sealed' ? 'blue' : 'violet'}>
                            {p.type === 'sealed' ? 'Sellado' : 'Para decants'}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-right">
                          {p.costPYG > 0 ? (
                            <>
                              <p className="text-gray-900">{fmtPYG(Math.round(p.costPYG))}</p>
                              <p className="text-xs text-gray-400">
                                {productEntries.length} lote{productEntries.length !== 1 ? 's' : ''}
                              </p>
                            </>
                          ) : (
                            <button
                              onClick={() => openIngresar(p.id)}
                              className="text-xs text-violet-500 hover:text-violet-700 underline cursor-pointer"
                            >
                              Sin costo — ingresar lote
                            </button>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <p className="font-semibold text-gray-900">{fmtPYG(p.sellingPricePYG)}</p>
                          {p.costPYG > 0 && p.sellingPricePYG > 0 && (
                            <p className="text-xs text-green-600">
                              +{Math.round((p.sellingPricePYG - p.costPYG) / p.sellingPricePYG * 100)}%
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {lowStock && <AlertTriangle size={14} className="text-orange-500" />}
                            <span className={`${lowStock ? 'text-orange-600 font-semibold' : noStock ? 'text-gray-400' : 'text-gray-900'}`}>
                              {p.type === 'sealed' ? `${p.stockSealed} u.` : `${p.stockOpenML} ml`}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openIngresar(p.id)} className="p-1.5 rounded-lg hover:bg-violet-50 text-gray-300 hover:text-violet-600 cursor-pointer" title="Ingresar lote">
                              <Plus size={14} />
                            </button>
                            <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-300 hover:text-gray-700 cursor-pointer" title="Editar producto">
                              <Edit2 size={14} />
                            </button>
                            <button onClick={() => handleDelete(p.id!)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 cursor-pointer" title="Eliminar producto">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* ── Expanded: Lotes de stock ── */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="px-5 pb-4 pt-0 bg-violet-50/20">
                            <div className="rounded-xl border border-violet-100 bg-white overflow-hidden shadow-sm">
                              {/* Lotes header */}
                              <div className="flex items-center justify-between px-4 py-2.5 bg-violet-50 border-b border-violet-100">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-violet-700 uppercase tracking-wide">
                                    Lotes de stock
                                  </span>
                                  {productEntries.length > 0 && (
                                    <span className="text-xs bg-violet-200 text-violet-700 rounded-full px-2 py-0.5 font-medium">
                                      {productEntries.length}
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => openIngresar(p.id)}
                                  className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-white hover:bg-violet-600 font-medium px-2.5 py-1.5 rounded-lg border border-violet-200 hover:border-violet-600 transition-colors cursor-pointer"
                                >
                                  <Plus size={11} />
                                  Ingresar lote
                                </button>
                              </div>

                              {productEntries.length === 0 ? (
                                <div className="flex items-center gap-2 px-4 py-5 text-sm text-gray-400">
                                  <Info size={14} className="shrink-0" />
                                  <span>Sin lotes registrados. Usá <strong className="text-gray-500">+ Ingresar lote</strong> para cargar el primer lote con su costo.</span>
                                </div>
                              ) : (
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="text-xs border-b border-gray-100 bg-gray-50/60">
                                      <th className="px-4 py-2 text-left text-gray-400 font-medium">Fecha</th>
                                      <th className="px-4 py-2 text-right text-gray-400 font-medium">Recibido</th>
                                      <th className="px-4 py-2 text-right text-gray-400 font-medium">Disponible</th>
                                      <th className="px-4 py-2 text-right text-gray-400 font-medium">USD / u.</th>
                                      <th className="px-4 py-2 text-right text-gray-400 font-medium">Cotiz.</th>
                                      <th className="px-4 py-2 text-right text-gray-400 font-medium">Total / u.</th>
                                      <th className="px-4 py-2 text-right text-gray-400 font-medium">Peso CPP</th>
                                      <th className="px-4 py-2" />
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {productEntries.map((entry, i) => {
                                      const remaining = lotRemainingMap.get(entry.id!) ?? entry.quantity
                                      const isAgotado = remaining === 0
                                      const isParcial = remaining > 0 && remaining < entry.quantity
                                      const unit = entry.type === 'sealed' ? 'u.' : 'ml'
                                      const pct = totalEntriesQty > 0 ? entry.quantity / totalEntriesQty * 100 : 0
                                      const baseCostPYG = entry.costUSD * entry.exchangeRate
                                      const shippingPerUnit = Math.round(entry.costPYG - baseCostPYG)
                                      return (
                                        <tr key={entry.id} className={`border-b border-gray-50 ${isAgotado ? 'opacity-50' : ''} ${i % 2 !== 0 ? 'bg-gray-50/40' : ''}`}>
                                          <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{fmtDate(entry.date)}</td>
                                          <td className="px-4 py-2.5 text-right text-gray-500">
                                            {entry.quantity} {unit}
                                          </td>
                                          <td className="px-4 py-2.5 text-right">
                                            {isAgotado ? (
                                              <span className="text-xs bg-red-100 text-red-600 rounded-full px-2 py-0.5 font-medium">agotado</span>
                                            ) : isParcial ? (
                                              <span className="text-orange-600 font-semibold">{remaining} {unit}</span>
                                            ) : (
                                              <span className="text-green-600 font-medium">{remaining} {unit}</span>
                                            )}
                                          </td>
                                          <td className="px-4 py-2.5 text-right text-gray-500">{fmtUSD(entry.costUSD)}</td>
                                          <td className="px-4 py-2.5 text-right text-gray-500">
                                            {entry.exchangeRate.toLocaleString('es-PY')}
                                          </td>
                                          <td className="px-4 py-2.5 text-right">
                                            <p className="font-semibold text-gray-900">{fmtPYG(Math.round(entry.costPYG))}</p>
                                            {shippingPerUnit > 100 && (
                                              <p className="text-xs text-gray-400">{fmtPYG(Math.round(baseCostPYG))} + {fmtPYG(shippingPerUnit)} envío</p>
                                            )}
                                          </td>
                                          <td className="px-4 py-2.5">
                                            <div className="flex items-center justify-end gap-2">
                                              <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                                <div
                                                  className="bg-violet-400 h-1.5 rounded-full"
                                                  style={{ width: `${pct}%` }}
                                                />
                                              </div>
                                              <span className="text-xs text-gray-400 w-7 text-right">{Math.round(pct)}%</span>
                                            </div>
                                          </td>
                                          <td className="px-3 py-2.5">
                                            <div className="flex items-center gap-1 justify-end">
                                              <button
                                                onClick={() => openEditLote(entry)}
                                                className="p-1 rounded text-gray-200 hover:text-violet-500 hover:bg-violet-50 transition-colors cursor-pointer"
                                                title="Editar lote"
                                              >
                                                <Edit2 size={13} />
                                              </button>
                                              <button
                                                onClick={() => handleDeleteLote(entry)}
                                                className="p-1 rounded text-gray-200 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                                                title="Eliminar lote"
                                              >
                                                <Trash2 size={13} />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                  {/* CPP formula footer */}
                                  {productEntries.length >= 1 && (
                                    <tfoot>
                                      <tr className="bg-violet-50 border-t border-violet-100">
                                        <td colSpan={6} className="px-4 py-2.5 text-xs text-violet-600 font-medium">
                                          {productEntries.length === 1
                                            ? 'CPP = costo único (1 lote)'
                                            : productEntries.length <= 3
                                              ? `CPP = (${productEntries.map(e => `${fmtPYG(Math.round(e.costPYG))} × ${e.quantity}`).join(' + ')}) ÷ ${totalEntriesQty}`
                                              : `CPP = promedio ponderado de ${productEntries.length} lotes ÷ ${totalEntriesQty} unidades`
                                          }
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-bold text-violet-800">
                                          {fmtPYG(Math.round(p.costPYG))}
                                        </td>
                                        <td colSpan={2} />
                                      </tr>
                                    </tfoot>
                                  )}
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

      {/* ── Modal Nuevo / Editar Producto ── */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editId ? 'Editar producto' : 'Nuevo producto'} size="xl">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Nombre" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Baccarat Rouge 540" />
          <Input label="Marca" value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="Ej: Maison Francis Kurkdjian" />
          <Select label="Concentración" value={form.concentration} onChange={e => setForm(f => ({ ...f, concentration: e.target.value as Concentration }))} options={concentrations.map(c => ({ value: c, label: c }))} />
          <Select label="Familia olfativa" value={form.olfactiveFamily} onChange={e => setForm(f => ({ ...f, olfactiveFamily: e.target.value as OlfactiveFamily }))} options={families.map(f => ({ value: f.value, label: f.label }))} />
          <Input label="Tamaño (ml)" type="number" value={form.sizeML} onChange={e => setForm(f => ({ ...f, sizeML: e.target.value }))} />
          <Select label="Tipo" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as ProductType }))} options={[{ value: 'sealed', label: 'Sellado para venta' }, { value: 'decant_source', label: 'Abierto para decants' }]} />
          {form.type === 'decant_source' ? (
            <div className="col-span-2">
              <p className="text-sm font-medium text-gray-700 mb-2">Precios de venta por tamaño (Gs.)</p>
              <div className="grid grid-cols-4 gap-3">
                {([['3ml', 'price3ML'], ['5ml', 'price5ML'], ['10ml', 'price10ML'], ['30ml', 'price30ML']] as const).map(([label, key]) => (
                  <Input key={key} label={label} type="number" value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder="0" />
                ))}
              </div>
            </div>
          ) : (
            <Input label="Precio de venta (Gs.)" type="number" value={form.sellingPricePYG} onChange={e => setForm(f => ({ ...f, sellingPricePYG: e.target.value }))} />
          )}
          <Input label="Stock mínimo (alerta)" type="number" value={form.minStock} onChange={e => setForm(f => ({ ...f, minStock: e.target.value }))} />
          <div className="col-span-2">
            <Textarea label="Notas olfativas" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Familia, notas de salida / corazón / fondo..." />
          </div>

          {!editId && (
            <div className="col-span-2 flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3">
              <Info size={15} className="text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                El costo y stock inicial se cargan desde <strong>Ingresar Stock</strong> una vez creado el producto. El sistema calculará el <strong>Costo Promedio Ponderado (CPP)</strong> automáticamente con cada lote.
              </p>
            </div>
          )}

          {editId && (
            <div className="col-span-2 border-t border-gray-100 pt-4">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Corrección directa de datos</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Input label="Costo CPP (Gs.)" type="number" value={form.costPYG} onChange={e => setForm(f => ({ ...f, costPYG: e.target.value }))} />
                  {editSellPrice > 0 && editCostPYG > 0 && (
                    <p className={`text-xs mt-1 ${editMargin > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      Margen: {editMargin.toFixed(1)}% · Utilidad: {fmtPYG(Math.round(editSellPrice - editCostPYG))}
                    </p>
                  )}
                </div>
                {form.type === 'sealed' ? (
                  <Input
                    label="Stock sellado (u.)"
                    type="number"
                    value={form.stockSealed}
                    onChange={e => setForm(f => ({ ...f, stockSealed: e.target.value }))}
                  />
                ) : (
                  <div>
                    <Input
                      label="Stock abierto (ml)"
                      type="number"
                      value={form.stockOpenML}
                      onChange={e => setForm(f => ({ ...f, stockOpenML: e.target.value }))}
                    />
                    <p className="text-xs text-blue-500 mt-1">Ajusta los ML disponibles en los lotes automáticamente</p>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-2">Usá estos campos solo para corregir errores. Para nuevos lotes, usá "Ingresar Stock" desde la tabla.</p>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-6">
          <Button variant="secondary" className="flex-1" onClick={() => setShowForm(false)}>Cancelar</Button>
          <Button className="flex-1" onClick={handleSave}>{editId ? 'Guardar cambios' : 'Crear producto'}</Button>
        </div>
      </Modal>

      {/* ── Modal Editar Lote ── */}
      <Modal isOpen={!!editLote} onClose={() => setEditLote(null)} title="Editar lote de stock">
        {editLote && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Fecha de recepción"
                type="date"
                value={editLoteForm.date}
                onChange={e => setEditLoteForm(f => ({ ...f, date: e.target.value }))}
              />
              <div>
                <Input
                  label={isDecantEditLote ? 'Botellas' : 'Cantidad (u.)'}
                  type="number"
                  value={editLoteForm.quantity}
                  onChange={e => setEditLoteForm(f => ({ ...f, quantity: e.target.value }))}
                />
                {isDecantEditLote && editLoteQty > 0 && (
                  <p className="text-xs text-blue-500 mt-1">{editLoteQty} × {editLoteSizeML}ml = {editLoteQty * editLoteSizeML}ml</p>
                )}
              </div>
              <Input
                label={isDecantEditLote
                  ? (editLoteIsLocal ? 'Costo Gs. por botella' : 'Costo USD por botella')
                  : (editLoteIsLocal ? 'Costo Gs. por unidad' : 'Costo USD por unidad')}
                type="number"
                value={editLoteForm.costUSD}
                onChange={e => setEditLoteForm(f => ({ ...f, costUSD: e.target.value }))}
              />
              {!editLoteIsLocal && (
                <Input
                  label="Cotización USD/PYG"
                  type="number"
                  value={editLoteForm.exchangeRate}
                  onChange={e => setEditLoteForm(f => ({ ...f, exchangeRate: e.target.value }))}
                />
              )}
              <div>
                <Input
                  label="Envío total del lote (Gs.)"
                  type="number"
                  value={editLoteForm.shippingCostPYG}
                  onChange={e => setEditLoteForm(f => ({ ...f, shippingCostPYG: e.target.value }))}
                  placeholder="0"
                />
                {editLoteShipping > 0 && editLoteQty > 0 && (
                  <p className="text-xs text-violet-600 mt-1">
                    +{fmtPYG(Math.round(isDecantEditLote ? editLoteShippingPerUnit : editLoteShippingStored))} por {isDecantEditLote ? 'botella' : 'u.'}
                    {isDecantEditLote && <span className="text-gray-400"> ({fmtPYG(Math.round(editLoteShippingStored))}/ml)</span>}
                  </p>
                )}
              </div>
              <div className="col-span-2" />
            </div>

            {editLoteQty > 0 && editLoteCostUSD > 0 && (
              <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 space-y-1.5">
                <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide mb-2">Vista previa del costo</p>
                <div className="grid grid-cols-2 gap-x-6 text-sm">
                  <span className="text-gray-500">Costo base:</span>
                  <span className="text-gray-700 text-right">
                    {editLoteIsLocal
                      ? <>{fmtPYG(Math.round(editLoteCostUSD))}{isDecantEditLote && <span className="text-gray-400 text-xs"> / bot.</span>}</>
                      : <>{fmtUSD(editLoteCostUSD)} × {editLoteRate.toLocaleString('es-PY')} = {fmtPYG(Math.round(editLoteCostUSD * editLoteRate))}{isDecantEditLote && <span className="text-gray-400 text-xs"> / bot.</span>}</>
                    }
                  </span>
                  {editLoteShipping > 0 && (
                    <>
                      <span className="text-gray-500">Envío por {isDecantEditLote ? 'botella' : 'unidad'}:</span>
                      <span className="text-gray-700 text-right">+{fmtPYG(Math.round(editLoteShippingPerUnit))}</span>
                    </>
                  )}
                  <span className="text-violet-700 font-semibold border-t border-violet-200 pt-1.5 mt-1">
                    Costo / {isDecantEditLote ? 'ml' : 'u.'}:
                  </span>
                  <span className="font-bold text-violet-800 text-right border-t border-violet-200 pt-1.5 mt-1">
                    {fmtPYG(Math.round(editLoteBatchCostPYG))}
                    {isDecantEditLote && <span className="text-gray-500 font-normal text-xs ml-1">({fmtPYG(Math.round(editLoteBatchCostPYG * editLoteSizeML))} / botella)</span>}
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="secondary" className="flex-1" onClick={() => setEditLote(null)}>Cancelar</Button>
              <Button
                className="flex-1"
                onClick={handleEditLote}
                disabled={!editLoteForm.quantity || !editLoteForm.costUSD}
              >
                Guardar cambios
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal Lote de Envío (multi-producto) ── */}
      <Modal isOpen={showBatch} onClose={() => setShowBatch(false)} title="Nuevo lote de envío" size="xl">
        <div className="space-y-4">
          {/* Toggle moneda */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => setBatchLocalCurrency(v => !v)}
              className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${batchLocalCurrency ? 'bg-green-500' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${batchLocalCurrency ? 'translate-x-5' : ''}`} />
            </div>
            <p className="text-sm font-medium text-gray-700">Compra en Guaraníes (proveedor local)</p>
          </label>

          <div className={`grid gap-4 ${batchLocalCurrency ? 'grid-cols-2' : 'grid-cols-3'}`}>
            <Input label="Fecha" type="date" value={batchDate} onChange={e => setBatchDate(e.target.value)} />
            {!batchLocalCurrency && (
              <Input label="Cotización USD/PYG" type="number" value={batchRate} onChange={e => setBatchRate(e.target.value)} />
            )}
            <Select
              label="Proveedor (opcional)"
              value={batchSupplierId}
              onChange={e => setBatchSupplierId(e.target.value)}
              options={[{ value: '', label: 'Sin especificar' }, ...suppliers.map(s => ({ value: String(s.id), label: s.name }))]}
            />
          </div>
          <Input label="Envío total del lote (Gs.)" type="number" value={batchShipping} onChange={e => setBatchShipping(e.target.value)} placeholder="0" />

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">Productos incluidos</p>
              <button
                onClick={() => setBatchItems(items => [...items, emptyBatchItem()])}
                className="text-xs text-violet-600 hover:text-violet-700 font-medium cursor-pointer"
              >
                + Agregar producto
              </button>
            </div>
            <div className="space-y-2">
              {batchItems.map((item, idx) => {
                const itemProd = products.find(p => p.id === item.productId)
                const isDecantItem = itemProd?.type === 'decant_source'
                const itemFormQty = parseFloat(item.bottles) || 0
                const itemCostUSD = parseFloat(item.costUSD) || 0
                const itemRate = batchLocalCurrency ? 1 : (parseFloat(batchRate) || 7500)
                const totalShip = parseFloat(batchShipping) || 0
                // Compute proportional shipping preview for this item
                const allValid = batchItems.filter(i => i.productId && i.bottles && i.costUSD)
                const totalUSD = allValid.reduce((s, i) =>
                  s + (parseFloat(i.costUSD) || 0) * (parseFloat(i.bottles) || 0)
                , 0)
                const myUSD = itemCostUSD * itemFormQty
                const myShipping = totalUSD > 0 ? totalShip * (myUSD / totalUSD) : 0
                const shippingPerBottle = itemFormQty > 0 ? myShipping / itemFormQty : 0
                const sizeML = itemProd?.sizeML || 1
                const shippingStored = isDecantItem ? shippingPerBottle / sizeML : shippingPerBottle
                const costStored = isDecantItem ? itemCostUSD / sizeML : itemCostUSD
                const itemCostPYG = costStored * itemRate + shippingStored
                return (
                  <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2.5">
                    <div className="flex-1 min-w-0">
                      <select
                        className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                        value={item.productId}
                        onChange={e => setBatchItems(items => items.map((it, i) => i === idx ? { ...it, productId: parseInt(e.target.value) } : it))}
                      >
                        <option value={0}>Seleccionar producto...</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.brand} — {p.name} ({p.sizeML}ml)</option>)}
                      </select>
                    </div>
                    <input
                      type="number"
                      placeholder={isDecantItem ? 'Botellas' : 'Unidades'}
                      className="w-20 text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-violet-500"
                      value={item.bottles}
                      onChange={e => setBatchItems(items => items.map((it, i) => i === idx ? { ...it, bottles: e.target.value } : it))}
                    />
                    <input
                      type="number"
                      placeholder={batchLocalCurrency ? `Gs./${isDecantItem ? 'bot.' : 'u.'}` : `USD/${isDecantItem ? 'bot.' : 'u.'}`}
                      className="w-24 text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-violet-500"
                      value={item.costUSD}
                      onChange={e => setBatchItems(items => items.map((it, i) => i === idx ? { ...it, costUSD: e.target.value } : it))}
                    />
                    {itemProd && itemFormQty > 0 && itemCostUSD > 0 && (
                      <div className="text-xs text-right text-gray-500 w-28 shrink-0">
                        <p className="font-semibold text-gray-800">{fmtPYG(Math.round(itemCostPYG))}/{isDecantItem ? 'ml' : 'u.'}</p>
                        {isDecantItem && <p className="text-gray-400">{fmtPYG(Math.round(itemCostPYG * sizeML))}/bot.</p>}
                        {myShipping > 0 && <p className="text-violet-500">+{fmtPYG(Math.round(myShipping))} envío</p>}
                      </div>
                    )}
                    {batchItems.length > 1 && (
                      <button
                        onClick={() => setBatchItems(items => items.filter((_, i) => i !== idx))}
                        className="p-1 text-gray-300 hover:text-red-500 cursor-pointer shrink-0"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <Input label="Notas (opcional)" value={batchNotes} onChange={e => setBatchNotes(e.target.value)} placeholder="Descripción del envío..." />
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowBatch(false)}>Cancelar</Button>
            <Button
              className="flex-1"
              onClick={handleCreateBatch}
              disabled={batchItems.every(i => !i.productId || !i.bottles || !i.costUSD)}
            >
              Crear lote de envío
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal Ingresar Stock (CPP) ── */}
      <Modal isOpen={showStock} onClose={() => setShowStock(false)} title="Ingresar lote de stock">
        <div className="space-y-4">
          <Select
            label="Producto"
            value={String(stockForm.productId)}
            onChange={e => {
              const pid = parseInt(e.target.value)
              const prod = products.find(p => p.id === pid)
              setStockForm(f => ({ ...f, productId: pid, type: prod?.type ?? f.type }))
            }}
            options={[{ value: '0', label: 'Seleccionar producto...' }, ...products.map(p => ({ value: String(p.id), label: `${p.brand} — ${p.name} (${p.sizeML}ml)` }))]}
          />
          {stockProduct ? (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1.5">Tipo</p>
              <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm">
                <span className="text-gray-700">{stockProduct.type === 'sealed' ? 'Sellado (unidades)' : 'Para decants (ml)'}</span>
                <span className="text-xs text-gray-400 ml-auto">automático</span>
              </div>
            </div>
          ) : (
            <Select
              label="Tipo"
              value={stockForm.type}
              onChange={e => setStockForm(f => ({ ...f, type: e.target.value as ProductType }))}
              options={[{ value: 'sealed', label: 'Sellado (unidades)' }, { value: 'decant_source', label: 'Para decants (ml)' }]}
            />
          )}

          {/* Toggle moneda */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => setStockForm(f => ({ ...f, localCurrency: !f.localCurrency }))}
              className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${stockForm.localCurrency ? 'bg-green-500' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${stockForm.localCurrency ? 'translate-x-5' : ''}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Compra en Guaraníes (proveedor local)</p>
              {stockForm.localCurrency && <p className="text-xs text-green-600">Ingresá el precio directamente en Gs., sin tipo de cambio.</p>}
            </div>
          </label>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input
                label={isDecantStock ? 'Botellas recibidas' : 'Cantidad (u.)'}
                type="number"
                value={stockForm.quantity}
                onChange={e => setStockForm(f => ({ ...f, quantity: e.target.value }))}
                placeholder="0"
              />
              {isDecantStock && stockQty > 0 && (
                <p className="text-xs text-blue-500 mt-1">{stockQty} × {decantSizeML}ml = {stockQty * decantSizeML}ml totales</p>
              )}
            </div>
            <Input
              label={isDecantStock
                ? (stockForm.localCurrency ? 'Costo Gs. por botella' : 'Costo USD por botella')
                : (stockForm.localCurrency ? 'Costo Gs. por unidad' : 'Costo USD por unidad')}
              type="number" value={stockForm.costUSD}
              onChange={e => setStockForm(f => ({ ...f, costUSD: e.target.value }))}
              placeholder="0"
            />
            {!stockForm.localCurrency && (
              <Input label="Cotización USD/PYG" type="number" value={stockForm.exchangeRate} onChange={e => setStockForm(f => ({ ...f, exchangeRate: e.target.value }))} />
            )}
            <div className={stockForm.localCurrency ? 'col-span-2' : ''}>
              <Input label="Envío total del lote (Gs.)" type="number" value={stockForm.shippingCostPYG} onChange={e => setStockForm(f => ({ ...f, shippingCostPYG: e.target.value }))} placeholder="0" />
              {stockShipping > 0 && stockQty > 0 && (
                <p className="text-xs text-violet-600 mt-1">
                  +{fmtPYG(Math.round(isDecantStock ? stockShippingPerBottle : stockShippingPerStoredUnit))} por {isDecantStock ? 'botella' : 'u.'}
                  {isDecantStock && <span className="text-gray-400"> ({fmtPYG(Math.round(stockShippingPerStoredUnit))}/ml)</span>}
                </p>
              )}
            </div>
          </div>

          {/* Preview CPP */}
          {stockProduct && stockQty > 0 && stockCostUSD > 0 && (
            <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Vista previa del costo</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                <span className="text-gray-500">Costo de este lote:</span>
                <span className="font-semibold text-gray-900 text-right">
                  {fmtPYG(Math.round(stockBatchCostPYG))} / {isDecantStock ? 'ml' : 'u.'}
                  {isDecantStock && <span className="text-gray-400 text-xs ml-1">({fmtPYG(Math.round(stockBatchCostPYG * decantSizeML))} / botella)</span>}
                </span>
                {existingQty > 0 && (
                  <>
                    <span className="text-gray-500">Stock actual ({existingQty} {isDecantStock ? 'ml' : 'u.'} a {fmtPYG(Math.round(stockProduct.costPYG))}):</span>
                    <span className="text-gray-600 text-right">{fmtPYG(Math.round(existingQty * stockProduct.costPYG))}</span>
                    <span className="text-violet-700 font-medium border-t border-violet-200 pt-1.5">CPP resultante:</span>
                    <span className="font-bold text-violet-800 text-right border-t border-violet-200 pt-1.5">{fmtPYG(Math.round(stockNewAvgCost))} / {isDecantStock ? 'ml' : 'u.'}</span>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Proveedor (opcional)"
              value={stockForm.supplierId}
              onChange={e => setStockForm(f => ({ ...f, supplierId: e.target.value }))}
              options={[{ value: '', label: 'Sin especificar' }, ...suppliers.map(s => ({ value: String(s.id), label: s.name }))]}
            />
            <Input label="Fecha" type="date" value={stockForm.date} onChange={e => setStockForm(f => ({ ...f, date: e.target.value }))} />
          </div>

          {/* Pago del lote */}
          <div className="border-t border-gray-100 pt-4">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={stockForm.registerPayment}
                onChange={e => setStockForm(f => ({ ...f, registerPayment: e.target.checked, paymentAccountId: '' }))}
                className="w-4 h-4 rounded border-gray-300 text-violet-600 cursor-pointer"
              />
              <span className="text-sm font-medium text-gray-700">Registrar pago de este lote</span>
            </label>
            {stockForm.registerPayment && (
              <div className="mt-3 space-y-2">
                <Select
                  label="Debitar de cuenta"
                  value={stockForm.paymentAccountId}
                  onChange={e => setStockForm(f => ({ ...f, paymentAccountId: e.target.value }))}
                  options={[{ value: '', label: 'Seleccionar cuenta...' }, ...accounts.map(a => ({ value: String(a.id), label: `${a.name} — ${fmtPYG(a.balance)}` }))]}
                />
                {stockQty > 0 && stockCostUSD > 0 && (
                  <p className="text-xs text-orange-600 flex items-center gap-1">
                    Se debitarán <strong>{fmtPYG(Math.round(stockActualQty * stockBatchCostPYG))}</strong> de la cuenta seleccionada y se registrará como egreso en Contabilidad
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowStock(false)}>Cancelar</Button>
            <Button
              className="flex-1"
              onClick={handleAddStock}
              disabled={!stockForm.productId || !stockForm.quantity || !stockForm.costUSD || (stockForm.registerPayment && !stockForm.paymentAccountId)}
            >
              {stockForm.registerPayment ? `Ingresar y pagar ${stockQty > 0 && stockCostUSD > 0 ? fmtPYG(Math.round(stockActualQty * stockBatchCostPYG)) : ''}` : 'Ingresar lote'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
