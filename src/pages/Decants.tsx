import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Droplets, FlaskConical, Package, Edit2, Trash2, AlertTriangle, ShoppingCart, Search, X } from 'lucide-react'
import { db } from '../db/db'
import type { DecantBatch, Supply, SupplyType } from '../db/types'
import { fmtPYG, fmtDate, today, nowISO } from '../lib/format'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Input, Select, Textarea } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { Pagination } from '../components/ui/Pagination'

const DECANT_SIZES = [3, 5, 10, 30]

// sizeML implícito según el tipo de insumo
const TYPE_TO_ML: Partial<Record<SupplyType, number>> = {
  '3ml': 3, '5ml': 5, '10ml': 10, '30ml': 30,
}

// Busca el insumo para un tamaño: primero por sizeML, luego por tipo
function findSupplyForSize(supplies: Supply[], sizeML: number): Supply | undefined {
  return supplies.find(s => s.sizeML === sizeML)
    ?? supplies.find(s => s.type === `${sizeML}ml` as SupplyType)
}

export function Decants() {
  const allProducts = useLiveQuery(() => db.products.toArray()) ?? []
  const openProducts = allProducts.filter(p => p.stockOpenML > 0)
  const supplies = useLiveQuery(() => db.supplies.toArray()) ?? []
  const batches = useLiveQuery(() => db.decantBatches.orderBy('date').reverse().toArray()) ?? []
  const accounts = useLiveQuery(() => db.accounts.filter(a => a.isActive !== false).toArray()) ?? []

  const [showProduce, setShowProduce] = useState(false)
  const [showSupply, setShowSupply] = useState(false)

  // ── Compra de insumos ──
  const [showPurchase, setShowPurchase] = useState(false)
  const [purchaseLines, setPurchaseLines] = useState<{ supplyId: number; qty: string; unitCost: string }[]>([])
  const [purchaseAccountId, setPurchaseAccountId] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(today())
  const [purchaseNotes, setPurchaseNotes] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<number>(0)
  const [selectedSize, setSelectedSize] = useState<number>(5)
  const [qty, setQty] = useState('1')
  const [sellingPrice, setSellingPrice] = useState('')
  const [batchNotes, setBatchNotes] = useState('')
  const [batchDate, setBatchDate] = useState(today())

  const [supplyForm, setSupplyForm] = useState({
    name: '', type: '5ml' as SupplyType, sizeML: '5', costPYG: '', stock: '0', minStock: '10',
  })

  // Edición de insumo existente
  const [editSupply, setEditSupply] = useState<Supply | null>(null)
  const [editSupplyForm, setEditSupplyForm] = useState({
    name: '', type: '5ml' as SupplyType, sizeML: '', costPYG: '', stock: '', minStock: '',
  })

  // Edición de producción
  const [editBatch, setEditBatch] = useState<DecantBatch | null>(null)
  const [editQty, setEditQty] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editNotes, setEditNotes] = useState('')

  // Paginación de la calculadora (tabla de productos con stock abierto)
  const [calcPage, setCalcPage] = useState(1)
  const CALC_PAGE_SIZE = 10

  // Filtros + paginación del historial
  const [histSearch, setHistSearch] = useState('')
  const [histSize, setHistSize] = useState<number | 'all'>('all')
  const [histMonth, setHistMonth] = useState('')
  const [histPage, setHistPage] = useState(1)
  const HIST_PAGE_SIZE = 15

  // Calculadora paginada
  const totalCalcPages = Math.max(1, Math.ceil(openProducts.length / CALC_PAGE_SIZE))
  const safeCalcPage = Math.min(calcPage, totalCalcPages)
  const paginatedOpenProducts = openProducts.slice((safeCalcPage - 1) * CALC_PAGE_SIZE, safeCalcPage * CALC_PAGE_SIZE)

  // Batches filtrados + paginados
  const filteredBatches = batches.filter(b => {
    const p = allProducts.find(x => x.id === b.productId)
    if (histSearch) {
      const q = histSearch.toLowerCase()
      if (!p?.name.toLowerCase().includes(q) && !p?.brand.toLowerCase().includes(q)) return false
    }
    if (histSize !== 'all' && b.sizeML !== histSize) return false
    if (histMonth && !b.date.startsWith(histMonth)) return false
    return true
  })
  const totalHistPages = Math.max(1, Math.ceil(filteredBatches.length / HIST_PAGE_SIZE))
  const safeHistPage = Math.min(histPage, totalHistPages)
  const paginatedBatches = filteredBatches.slice((safeHistPage - 1) * HIST_PAGE_SIZE, safeHistPage * HIST_PAGE_SIZE)

  function setHistFilter(patch: { search?: string; size?: number | 'all'; month?: string }) {
    if (patch.search !== undefined) setHistSearch(patch.search)
    if (patch.size !== undefined) setHistSize(patch.size)
    if (patch.month !== undefined) setHistMonth(patch.month)
    setHistPage(1)
  }

  const product = openProducts.find(p => p.id === selectedProduct)
  const cpm = product
    ? (product.type === 'decant_source' ? product.costPYG : product.costPYG / product.sizeML)
    : 0
  const supplyForSize = findSupplyForSize(supplies, selectedSize)
  const supplyCost = supplyForSize?.costPYG ?? 0
  const decantCost = cpm * selectedSize + supplyCost
  const maxDecants = product ? Math.floor(product.stockOpenML / selectedSize) : 0
  const quantityNum = parseInt(qty) || 0
  const totalMLNeeded = quantityNum * selectedSize
  const profit = sellingPrice ? (parseFloat(sellingPrice) - decantCost) * quantityNum : 0

  async function handleProduce() {
    if (!product || !quantityNum || !supplyForSize) return
    if (product.stockOpenML < totalMLNeeded) return
    const now = nowISO()
    await db.transaction('rw', db.products, db.decantBatches, db.supplies, async () => {
      await db.products.where('id').equals(product.id!).modify(p => { p.stockOpenML -= totalMLNeeded })
      await db.supplies.where('id').equals(supplyForSize.id!).modify(s => {
        s.stock = Math.max(0, s.stock - quantityNum)
      })
      await db.decantBatches.add({
        productId: product.id!, sizeML: selectedSize, quantity: quantityNum,
        supplyId: supplyForSize.id!, costPerDecant: decantCost,
        sellingPricePYG: parseFloat(sellingPrice) || 0,
        mlUsed: totalMLNeeded, stockRemaining: product.stockOpenML - totalMLNeeded,
        date: batchDate, notes: batchNotes, createdAt: now,
      })
    })
    setShowProduce(false)
    setQty('1')
    setSellingPrice('')
    setBatchNotes('')
  }

  function openEditBatch(b: DecantBatch) {
    setEditBatch(b)
    setEditQty(String(b.quantity))
    setEditPrice(b.sellingPricePYG > 0 ? String(b.sellingPricePYG) : '')
    setEditDate(b.date)
    setEditNotes(b.notes ?? '')
  }

  async function handleEditBatch() {
    if (!editBatch) return
    const prod = allProducts.find(p => p.id === editBatch.productId)
    if (!prod) return
    const newQty = parseInt(editQty) || 0
    const qtyDelta = newQty - editBatch.quantity
    const newMLUsed = newQty * editBatch.sizeML
    const mlDelta = newMLUsed - editBatch.mlUsed
    if (mlDelta > 0 && prod.stockOpenML < mlDelta) return
    const supplyForSize = findSupplyForSize(supplies, editBatch.sizeML)
    await db.transaction('rw', db.products, db.decantBatches, db.supplies, async () => {
      await db.products.where('id').equals(prod.id!).modify(p => { p.stockOpenML = Math.max(0, p.stockOpenML - mlDelta) })
      if (supplyForSize && qtyDelta !== 0) {
        await db.supplies.where('id').equals(supplyForSize.id!).modify(s => { s.stock = Math.max(0, s.stock - qtyDelta) })
      }
      await db.decantBatches.update(editBatch.id!, {
        quantity: newQty, mlUsed: newMLUsed,
        sellingPricePYG: parseFloat(editPrice) || 0,
        date: editDate, notes: editNotes || undefined,
      })
    })
    setEditBatch(null)
  }

  async function handleDeleteBatch(batch: DecantBatch) {
    if (!confirm(`¿Eliminar este lote de ${batch.quantity} decants de ${batch.sizeML}ml? Se devolverán los ML y el frasco al stock.`)) return
    const prod = allProducts.find(p => p.id === batch.productId)
    if (!prod) return
    await db.transaction('rw', db.products, db.decantBatches, db.supplies, async () => {
      await db.products.where('id').equals(prod.id!).modify(p => { p.stockOpenML += batch.mlUsed })
      if (batch.supplyId) {
        await db.supplies.where('id').equals(batch.supplyId).modify(s => { s.stock += batch.quantity })
      }
      await db.decantBatches.delete(batch.id!)
    })
  }

  async function handleAddSupply() {
    if (!supplyForm.name || !supplyForm.costPYG) return
    const now = nowISO()
    await db.supplies.add({
      name: supplyForm.name, type: supplyForm.type,
      sizeML: parseFloat(supplyForm.sizeML) || undefined,
      costPYG: parseFloat(supplyForm.costPYG),
      stock: parseInt(supplyForm.stock) || 0,
      minStock: parseInt(supplyForm.minStock) || 10,
      createdAt: now, updatedAt: now,
    })
    setSupplyForm({ name: '', type: '5ml', sizeML: '5', costPYG: '', stock: '0', minStock: '10' })
  }

  function openEditSupply(s: Supply) {
    setEditSupply(s)
    setEditSupplyForm({
      name: s.name, type: s.type as SupplyType,
      sizeML: s.sizeML != null ? String(s.sizeML) : '',
      costPYG: String(s.costPYG), stock: String(s.stock), minStock: String(s.minStock),
    })
  }

  async function handleSaveSupply() {
    if (!editSupply?.id) return
    await db.supplies.update(editSupply.id, {
      name: editSupplyForm.name,
      type: editSupplyForm.type,
      sizeML: parseFloat(editSupplyForm.sizeML) || undefined,
      costPYG: parseFloat(editSupplyForm.costPYG) || editSupply.costPYG,
      stock: parseInt(editSupplyForm.stock) || 0,
      minStock: parseInt(editSupplyForm.minStock) || 10,
      updatedAt: nowISO(),
    })
    setEditSupply(null)
  }

  async function handleDeleteSupply(id: number, name: string) {
    if (!confirm(`¿Eliminar "${name}"?`)) return
    await db.supplies.delete(id)
  }

  // ── Compra de insumos ──
  function openPurchase() {
    setPurchaseLines(supplies.map(s => ({ supplyId: s.id!, qty: '', unitCost: String(s.costPYG) })))
    setPurchaseAccountId('')
    setPurchaseDate(today())
    setPurchaseNotes('')
    setShowPurchase(true)
  }

  async function handlePurchase() {
    const activeLines = purchaseLines.filter(l => parseInt(l.qty) > 0)
    const accountId = parseInt(purchaseAccountId)
    if (!activeLines.length || !accountId) return

    const total = activeLines.reduce((sum, l) => sum + (parseInt(l.qty) || 0) * (parseFloat(l.unitCost) || 0), 0)
    if (total <= 0) return

    const now = nowISO()
    await db.transaction('rw', db.supplies, db.movements, db.accounts, async () => {
      for (const line of activeLines) {
        const qty = parseInt(line.qty)
        const unitCost = parseFloat(line.unitCost) || 0
        await db.supplies.where('id').equals(line.supplyId).modify(s => {
          s.stock += qty
          if (unitCost > 0) s.costPYG = unitCost
          s.updatedAt = now
        })
      }
      await db.accounts.where('id').equals(accountId).modify(a => { a.balance -= total })
      const names = activeLines.map(l => {
        const s = supplies.find(x => x.id === l.supplyId)
        return `${s?.name ?? 'Insumo'} ×${l.qty}`
      }).join(', ')
      await db.movements.add({
        type: 'expense',
        category: 'supplies',
        amount: total,
        accountId,
        description: purchaseNotes.trim() || `Compra de insumos: ${names}`,
        date: purchaseDate,
        createdAt: now,
      })
    })
    setShowPurchase(false)
  }

  return (
    <div>
      <PageHeader
        title="Decants"
        subtitle="Cálculo de costos y producción de lotes"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Package size={15} />} onClick={() => setShowSupply(true)}>Gestionar insumos</Button>
            <Button variant="secondary" icon={<ShoppingCart size={15} />} onClick={openPurchase} disabled={supplies.length === 0}>Registrar compra</Button>
            <Button icon={<Plus size={15} />} onClick={() => setShowProduce(true)}>Producir lote</Button>
          </div>
        }
      />

      {/* Calculadora por producto — tabla compacta */}
      <Card className="mb-6">
        {openProducts.length === 0 ? (
          <CardBody className="text-center py-12">
            <FlaskConical size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400">No hay botellas abiertas para decants</p>
            <p className="text-sm text-gray-400">Agrega productos de tipo "Para decants" en el inventario</p>
          </CardBody>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-left px-5 py-2.5 text-gray-500 font-medium">Perfume</th>
                  <th className="text-right px-4 py-2.5 text-gray-400 font-medium text-xs">Gs/ml</th>
                  {DECANT_SIZES.map(size => (
                    <th key={size} className="text-right px-4 py-2.5 text-violet-600 font-semibold">{size}ml</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedOpenProducts.map(p => {
                  const cpm = p.costPYG
                  return (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-violet-50/20 last:border-0 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-semibold text-gray-900">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.brand} · <span className="text-violet-500 font-medium">{p.stockOpenML}ml disp.</span></p>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400 text-xs whitespace-nowrap">{fmtPYG(p.costPYG)}</td>
                      {DECANT_SIZES.map(size => {
                        const sup = findSupplyForSize(supplies, size)
                        const cost = cpm * size + (sup?.costPYG ?? 0)
                        const canMake = Math.floor(p.stockOpenML / size)
                        return (
                          <td key={size} className={`px-4 py-3 text-right whitespace-nowrap ${!sup ? 'bg-orange-50/50' : ''}`}>
                            <p className="font-semibold text-gray-900">{fmtPYG(Math.round(cost))}</p>
                            <p className={`text-xs ${canMake === 0 ? 'text-gray-300' : 'text-green-600'}`}>
                              {!sup ? <span className="text-orange-400">sin frasco</span> : `${canMake} pos.`}
                            </p>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={safeCalcPage}
            totalPages={totalCalcPages}
            onPageChange={setCalcPage}
            total={openProducts.length}
            pageSize={CALC_PAGE_SIZE}
          />
          </>
        )}
      </Card>

      {/* Insumos */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Insumos (frascos)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {supplies.map(s => {
            const linked = s.sizeML != null
              ? s.sizeML
              : TYPE_TO_ML[s.type as SupplyType]
            return (
              <Card key={s.id}>
                <CardBody className="text-center">
                  <p className="font-medium text-gray-900 text-sm">{s.name}</p>
                  {linked && (
                    <p className="text-xs text-violet-500 mt-0.5">{linked}ml</p>
                  )}
                  <p className="text-lg font-bold text-violet-600 mt-1">{fmtPYG(s.costPYG)}</p>
                  <p className={`text-sm mt-1 ${s.stock <= s.minStock ? 'text-orange-600' : 'text-gray-500'}`}>
                    Stock: {s.stock} u.
                  </p>
                  {!linked && (
                    <p className="text-xs text-orange-500 mt-1 flex items-center justify-center gap-1">
                      <AlertTriangle size={10} /> Sin ML asignado
                    </p>
                  )}
                  <button
                    onClick={() => openEditSupply(s)}
                    className="mt-2 text-xs text-gray-400 hover:text-violet-600 flex items-center gap-1 mx-auto"
                  >
                    <Edit2 size={10} /> Editar
                  </button>
                </CardBody>
              </Card>
            )
          })}
          {supplies.length === 0 && (
            <div className="col-span-4 text-center py-8 text-gray-400 text-sm">
              No hay insumos registrados. Agregá frascos para empezar a producir decants.
            </div>
          )}
        </div>
      </div>

      {/* Historial de lotes — header + filtros */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h2 className="text-lg font-semibold text-gray-900">Historial de producción</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Búsqueda */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
            <input
              className="pl-8 pr-7 py-1.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent w-44 placeholder:text-gray-300"
              placeholder="Buscar perfume..."
              value={histSearch}
              onChange={e => setHistFilter({ search: e.target.value })}
            />
            {histSearch && (
              <button onClick={() => setHistFilter({ search: '' })} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 cursor-pointer">
                <X size={11} />
              </button>
            )}
          </div>
          {/* Tamaño */}
          <div className="flex gap-1">
            {(['all', 3, 5, 10, 30] as const).map(s => (
              <button
                key={s}
                onClick={() => setHistFilter({ size: s })}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${histSize === s ? 'bg-violet-600 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-violet-300'}`}
              >
                {s === 'all' ? 'Todos' : `${s}ml`}
              </button>
            ))}
          </div>
          {/* Mes */}
          <div className="relative">
            <input
              type="month"
              className="py-1.5 px-2.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-gray-600 cursor-pointer"
              value={histMonth}
              onChange={e => setHistFilter({ month: e.target.value })}
            />
            {histMonth && (
              <button onClick={() => setHistFilter({ month: '' })} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-violet-500 text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-violet-700">
                <X size={8} />
              </button>
            )}
          </div>
        </div>
      </div>

      <Card>
        {batches.length === 0 ? (
          <CardBody className="text-center py-10">
            <Droplets size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400">Aún no hay lotes producidos</p>
          </CardBody>
        ) : filteredBatches.length === 0 ? (
          <CardBody className="text-center py-10">
            <Search size={28} className="mx-auto text-gray-200 mb-3" />
            <p className="text-gray-400 text-sm">Sin resultados para esos filtros</p>
            <button onClick={() => { setHistFilter({ search: '', size: 'all', month: '' }) }} className="mt-2 text-xs text-violet-500 hover:underline cursor-pointer">Limpiar filtros</button>
          </CardBody>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-gray-500 font-medium">Fecha</th>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium">Perfume</th>
                    <th className="text-right px-5 py-3 text-gray-500 font-medium">Tamaño</th>
                    <th className="text-right px-5 py-3 text-gray-500 font-medium">Cant.</th>
                    <th className="text-right px-5 py-3 text-gray-500 font-medium">Costo c/u</th>
                    <th className="text-right px-5 py-3 text-gray-500 font-medium">Precio venta</th>
                    <th className="text-right px-5 py-3 text-gray-500 font-medium">ML usados</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {paginatedBatches.map(b => {
                    const p = allProducts.find(x => x.id === b.productId)
                    return (
                      <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{fmtDate(b.date)}</td>
                        <td className="px-5 py-3">
                          <p className="font-medium text-gray-900">{p?.name ?? '—'}</p>
                          <p className="text-xs text-gray-500">{p?.brand}</p>
                        </td>
                        <td className="px-5 py-3 text-right"><Badge color="violet">{b.sizeML}ml</Badge></td>
                        <td className="px-5 py-3 text-right font-semibold text-gray-900">{b.quantity}</td>
                        <td className="px-5 py-3 text-right text-gray-600">{fmtPYG(Math.round(b.costPerDecant))}</td>
                        <td className="px-5 py-3 text-right">
                          {b.sellingPricePYG > 0 ? (
                            <div>
                              <span className="font-semibold text-gray-900">{fmtPYG(b.sellingPricePYG)}</span>
                              <p className="text-xs text-green-600">+{fmtPYG(Math.round(b.sellingPricePYG - b.costPerDecant))}</p>
                            </div>
                          ) : '—'}
                        </td>
                        <td className="px-5 py-3 text-right text-gray-600 whitespace-nowrap">{b.mlUsed}ml</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            {b.sourceType === 'local_order' && (
                              <span className="text-xs text-orange-400 mr-1" title="Pedido local">P</span>
                            )}
                            <button onClick={() => openEditBatch(b)} className="p-1.5 rounded-lg text-gray-300 hover:bg-violet-50 hover:text-violet-500 transition-all cursor-pointer" title="Editar producción">
                              <Edit2 size={13} />
                            </button>
                            <button onClick={() => handleDeleteBatch(b)} className="p-1.5 rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-500 transition-all cursor-pointer" title="Eliminar producción">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              page={safeHistPage}
              totalPages={totalHistPages}
              onPageChange={setHistPage}
              total={filteredBatches.length}
              pageSize={HIST_PAGE_SIZE}
            />
          </>
        )}
      </Card>

      {/* Modal producir lote */}
      <Modal isOpen={showProduce} onClose={() => setShowProduce(false)} title="Producir lote de decants" size="lg">
        <div className="space-y-4">
          <Select
            label="Botella origen"
            value={String(selectedProduct)}
            onChange={e => {
              const id = parseInt(e.target.value)
              setSelectedProduct(id)
              const p = openProducts.find(x => x.id === id)
              if (p) {
                const autoP = selectedSize === 3 ? p.price3ML : selectedSize === 5 ? p.price5ML : selectedSize === 10 ? p.price10ML : p.price30ML
                if (autoP) setSellingPrice(String(autoP))
              }
            }}
            options={[{ value: '0', label: 'Seleccionar...' }, ...openProducts.map(p => ({
              value: String(p.id),
              label: `${p.brand} — ${p.name} (${p.stockOpenML}ml disponibles)${p.type === 'tester' ? ' · TESTER' : p.type === 'sealed' ? ' · SELLADO ABIERTO' : ''}`,
            }))]}
          />
          {product && product.type !== 'decant_source' && (
            <div className="flex items-center gap-2 text-xs bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-orange-700">
              <AlertTriangle size={13} className="shrink-0" />
              Este producto es un <strong>{product.type === 'tester' ? 'tester' : 'sellado'}</strong> abierto para decants. CPM calculado: {fmtPYG(Math.round(product.costPYG / product.sizeML))}/ml
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Tamaño del decant</label>
            <div className="grid grid-cols-4 gap-2">
              {DECANT_SIZES.map(s => {
                const sup = findSupplyForSize(supplies, s)
                return (
                  <button
                    key={s}
                    onClick={() => {
                      setSelectedSize(s)
                      if (product) {
                        const autoP = s === 3 ? product.price3ML : s === 5 ? product.price5ML : s === 10 ? product.price10ML : product.price30ML
                        if (autoP) setSellingPrice(String(autoP))
                      }
                    }}
                    className={`py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors ${selectedSize === s ? 'bg-violet-600 text-white' : sup ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-orange-50 text-orange-600 border border-orange-200'}`}
                    title={sup ? `Frasco: ${sup.name}` : 'Sin frasco registrado para este tamaño'}
                  >
                    {s}ml
                    {!sup && <span className="block text-xs mt-0.5">sin frasco</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Frasco que se usará */}
          {supplyForSize ? (
            <div className="flex items-center justify-between bg-violet-50 rounded-lg px-3 py-2 text-sm">
              <span className="text-gray-500">Frasco a usar:</span>
              <div className="flex items-center gap-3">
                <span className="font-medium text-gray-800">{supplyForSize.name}</span>
                <span className={`text-xs ${supplyForSize.stock < quantityNum ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                  Stock: {supplyForSize.stock} u.
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-sm text-orange-700">
              <AlertTriangle size={14} className="shrink-0" />
              No hay frasco registrado para {selectedSize}ml. Agregá uno en "Gestionar insumos".
            </div>
          )}

          <Input label="Cantidad a producir" type="number" value={qty} onChange={e => setQty(e.target.value)} />

          {product && (
            <div className="bg-violet-50 rounded-xl p-4 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Costo por ml</span>
                <span className="font-semibold">{fmtPYG(Math.round(cpm))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Costo del frasco ({selectedSize}ml)</span>
                <span className="font-semibold">{fmtPYG(supplyCost)}</span>
              </div>
              <div className="flex justify-between border-t border-violet-200 pt-1.5">
                <span className="text-gray-700 font-medium">Costo por decant</span>
                <span className="font-bold text-violet-700">{fmtPYG(Math.round(decantCost))}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>ML necesarios: {totalMLNeeded}ml</span>
                <span className={totalMLNeeded > product.stockOpenML ? 'text-red-500' : 'text-green-600'}>
                  Disponible: {product.stockOpenML}ml (máx. {maxDecants} decants)
                </span>
              </div>
            </div>
          )}

          <Input label="Precio de venta sugerido (Gs.)" type="number" value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} />
          {sellingPrice && decantCost > 0 && (
            <div className={`text-sm rounded-lg p-3 ${profit > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              Utilidad total del lote: <span className="font-bold">{fmtPYG(Math.round(profit))}</span>
              {' '}({quantityNum} × {fmtPYG(Math.round(parseFloat(sellingPrice) - decantCost))})
            </div>
          )}
          <Input label="Fecha" type="date" value={batchDate} onChange={e => setBatchDate(e.target.value)} />
          <Textarea label="Notas" value={batchNotes} onChange={e => setBatchNotes(e.target.value)} rows={2} />
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowProduce(false)}>Cancelar</Button>
            <Button
              className="flex-1"
              onClick={handleProduce}
              disabled={!product || !quantityNum || !supplyForSize || totalMLNeeded > (product?.stockOpenML ?? 0) || (supplyForSize?.stock ?? 0) < quantityNum}
            >
              Producir
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal gestionar insumos */}
      <Modal isOpen={showSupply} onClose={() => setShowSupply(false)} title="Gestionar insumos" size="lg">
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Agregar insumo</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Nombre"
                  value={supplyForm.name}
                  onChange={e => setSupplyForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Frasco 5ml premium"
                />
                <Select
                  label="Tipo"
                  value={supplyForm.type}
                  onChange={e => {
                    const newType = e.target.value as SupplyType
                    const autoML = TYPE_TO_ML[newType]
                    setSupplyForm(f => ({ ...f, type: newType, sizeML: autoML ? String(autoML) : f.sizeML }))
                  }}
                  options={[
                    { value: '3ml', label: 'Frasco 3ml' }, { value: '5ml', label: 'Frasco 5ml' },
                    { value: '10ml', label: 'Frasco 10ml' }, { value: '30ml', label: 'Frasco 30ml' },
                    { value: 'cap', label: 'Tapa' }, { value: 'label', label: 'Etiqueta' },
                    { value: 'packaging', label: 'Packaging' }, { value: 'gift_wrap', label: 'Papel de regalo' },
                    { value: 'other', label: 'Otro' },
                  ]}
                />
              </div>
              {(() => {
                const isDecantVial = ['3ml','5ml','10ml','30ml'].includes(supplyForm.type)
                return (
                  <div className={`grid gap-3 ${isDecantVial ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    {isDecantVial && (
                      <div>
                        <Input
                          label="Tamaño (ml)"
                          type="number"
                          value={supplyForm.sizeML}
                          onChange={e => setSupplyForm(f => ({ ...f, sizeML: e.target.value }))}
                          placeholder="Ej: 5"
                        />
                        <p className="text-xs text-gray-400 mt-1">Para asociar al decant correcto</p>
                      </div>
                    )}
                    <Input label="Costo unitario (Gs.)" type="number" value={supplyForm.costPYG} onChange={e => setSupplyForm(f => ({ ...f, costPYG: e.target.value }))} />
                    <Input label="Stock actual" type="number" value={supplyForm.stock} onChange={e => setSupplyForm(f => ({ ...f, stock: e.target.value }))} />
                  </div>
                )
              })()}
              <Button className="w-full" onClick={handleAddSupply} disabled={!supplyForm.name || !supplyForm.costPYG}>
                Agregar insumo
              </Button>
            </div>
          </div>

          {supplies.length > 0 && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Insumos registrados</p>
              <div className="space-y-2">
                {supplies.map(s => {
                  const linkedML = s.sizeML ?? TYPE_TO_ML[s.type as SupplyType]
                  return (
                    <div key={s.id} className="flex items-center gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{s.name}</p>
                        <p className="text-xs text-gray-400">
                          {linkedML ? <span className="text-violet-600">{linkedML}ml · </span> : <span className="text-orange-500">Sin ML · </span>}
                          {fmtPYG(s.costPYG)} c/u
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-400">Stock:</span>
                        <input
                          type="number"
                          className="w-16 text-sm border border-gray-200 rounded px-2 py-0.5 text-center"
                          defaultValue={s.stock}
                          onBlur={async e => {
                            const val = parseInt(e.target.value)
                            if (!isNaN(val) && s.id) await db.supplies.update(s.id, { stock: val, updatedAt: nowISO() })
                          }}
                        />
                        <button
                          onClick={() => openEditSupply(s)}
                          className="p-1.5 rounded text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                          title="Editar insumo"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteSupply(s.id!, s.name)}
                          className="p-1.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 cursor-pointer transition-colors"
                          title="Eliminar insumo"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal editar insumo */}
      <Modal isOpen={!!editSupply} onClose={() => setEditSupply(null)} title="Editar insumo">
        {editSupply && (
          <div className="space-y-4">
            <Input label="Nombre" value={editSupplyForm.name} onChange={e => setEditSupplyForm(f => ({ ...f, name: e.target.value }))} />
            <Select
              label="Tipo"
              value={editSupplyForm.type}
              onChange={e => {
                const newType = e.target.value as SupplyType
                const autoML = TYPE_TO_ML[newType]
                setEditSupplyForm(f => ({ ...f, type: newType, sizeML: autoML ? String(autoML) : f.sizeML }))
              }}
              options={[
                { value: '3ml', label: 'Frasco 3ml' }, { value: '5ml', label: 'Frasco 5ml' },
                { value: '10ml', label: 'Frasco 10ml' }, { value: '30ml', label: 'Frasco 30ml' },
                { value: 'cap', label: 'Tapa' }, { value: 'label', label: 'Etiqueta' },
                { value: 'packaging', label: 'Packaging' }, { value: 'gift_wrap', label: 'Papel de regalo' },
                { value: 'other', label: 'Otro' },
              ]}
            />
            <div>
              <Input
                label="Tamaño en ML (para asociar al decant correcto)"
                type="number"
                value={editSupplyForm.sizeML}
                onChange={e => setEditSupplyForm(f => ({ ...f, sizeML: e.target.value }))}
                placeholder="Ej: 10"
              />
              <p className="text-xs text-gray-400 mt-1">
                Este valor determina en qué tamaño de decant se usa este frasco. Si dice "Sin frasco" en la calculadora, revisá este campo.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Costo unitario (Gs.)" type="number" value={editSupplyForm.costPYG} onChange={e => setEditSupplyForm(f => ({ ...f, costPYG: e.target.value }))} />
              <Input label="Stock actual" type="number" value={editSupplyForm.stock} onChange={e => setEditSupplyForm(f => ({ ...f, stock: e.target.value }))} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="secondary" className="flex-1" onClick={() => setEditSupply(null)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleSaveSupply}>Guardar</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal registrar compra de insumos */}
      <Modal isOpen={showPurchase} onClose={() => setShowPurchase(false)} title="Registrar compra de insumos" size="lg">
        {(() => {
          const activeLines = purchaseLines.filter(l => parseInt(l.qty) > 0)
          const total = activeLines.reduce((sum, l) => sum + (parseInt(l.qty) || 0) * (parseFloat(l.unitCost) || 0), 0)
          return (
            <div className="space-y-4">
              {/* Tabla de insumos */}
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Insumo</th>
                      <th className="text-right px-3 py-2.5 text-gray-500 font-medium w-24">Cantidad</th>
                      <th className="text-right px-3 py-2.5 text-gray-500 font-medium w-32">Costo unit. (Gs.)</th>
                      <th className="text-right px-4 py-2.5 text-gray-500 font-medium w-28">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseLines.map((line, i) => {
                      const supply = supplies.find(s => s.id === line.supplyId)
                      const qty = parseInt(line.qty) || 0
                      const cost = parseFloat(line.unitCost) || 0
                      const subtotal = qty * cost
                      const active = qty > 0
                      return (
                        <tr key={line.supplyId} className={`border-b border-gray-50 ${active ? 'bg-violet-50' : ''}`}>
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-gray-900">{supply?.name}</p>
                            <p className="text-xs text-gray-400">Stock actual: {supply?.stock ?? 0} u.</p>
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={line.qty}
                              onChange={e => setPurchaseLines(ls => ls.map((l, j) => j === i ? { ...l, qty: e.target.value } : l))}
                              className="w-full text-right text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="number"
                              min="0"
                              value={line.unitCost}
                              onChange={e => setPurchaseLines(ls => ls.map((l, j) => j === i ? { ...l, unitCost: e.target.value } : l))}
                              className="w-full text-right text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                            {active ? fmtPYG(subtotal) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Total */}
              {total > 0 && (
                <div className="flex items-center justify-between bg-violet-50 rounded-xl px-4 py-3">
                  <span className="text-sm font-medium text-gray-700">Total a descontar</span>
                  <span className="text-lg font-bold text-violet-700">{fmtPYG(total)}</span>
                </div>
              )}

              {/* Cuenta + Fecha */}
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Pagar desde cuenta"
                  value={purchaseAccountId}
                  onChange={e => setPurchaseAccountId(e.target.value)}
                  options={[
                    { value: '', label: 'Seleccionar cuenta...' },
                    ...accounts.map(a => ({ value: String(a.id), label: `${a.name} — ${fmtPYG(a.balance)}` })),
                  ]}
                />
                <Input
                  label="Fecha"
                  type="date"
                  value={purchaseDate}
                  onChange={e => setPurchaseDate(e.target.value)}
                />
              </div>

              <Input
                label="Descripción (opcional)"
                placeholder="Ej: Compra en ferretería, pedido a proveedor..."
                value={purchaseNotes}
                onChange={e => setPurchaseNotes(e.target.value)}
              />

              <div className="flex gap-2 pt-2">
                <Button variant="secondary" className="flex-1" onClick={() => setShowPurchase(false)}>Cancelar</Button>
                <Button
                  className="flex-1"
                  onClick={handlePurchase}
                  disabled={activeLines.length === 0 || !purchaseAccountId || total <= 0}
                >
                  Registrar compra — {total > 0 ? fmtPYG(total) : '—'}
                </Button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* Modal editar producción */}
      <Modal isOpen={!!editBatch} onClose={() => setEditBatch(null)} title="Editar producción">
        {editBatch && (() => {
          const editProd = allProducts.find(p => p.id === editBatch.productId)
          const newQtyNum = parseInt(editQty) || 0
          const mlDelta = (newQtyNum - editBatch.quantity) * editBatch.sizeML
          const hasEnoughML = mlDelta <= 0 || (editProd ? editProd.stockOpenML >= mlDelta : false)
          const editPriceNum = parseFloat(editPrice) || 0
          const editProfit = editPriceNum > 0 ? (editPriceNum - editBatch.costPerDecant) * newQtyNum : 0
          return (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-3 text-sm grid grid-cols-2 gap-x-4 gap-y-1">
                <span className="text-gray-500">Perfume:</span>
                <span className="font-medium text-gray-900">{editProd?.name} — {editBatch.sizeML}ml</span>
                <span className="text-gray-500">Costo / decant:</span>
                <span className="font-medium text-gray-900">{fmtPYG(Math.round(editBatch.costPerDecant))}</span>
                <span className="text-gray-500">ML disponibles:</span>
                <span className={`font-medium ${!hasEnoughML ? 'text-red-600' : 'text-gray-900'}`}>
                  {editProd?.stockOpenML ?? 0}ml
                  {mlDelta > 0 && <span className="text-orange-500 text-xs ml-1">(necesita +{mlDelta}ml)</span>}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Fecha" type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
                <div>
                  <Input label="Cantidad" type="number" value={editQty} onChange={e => setEditQty(e.target.value)} />
                  {newQtyNum !== editBatch.quantity && (
                    <p className="text-xs mt-1 text-orange-500">
                      {mlDelta > 0 ? `+${mlDelta}ml usados` : `devuelve ${Math.abs(mlDelta)}ml`}
                    </p>
                  )}
                </div>
              </div>
              <Input label="Precio de venta (Gs.)" type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} />
              {editPriceNum > 0 && editBatch.costPerDecant > 0 && (
                <div className={`text-sm rounded-lg p-3 ${editProfit > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  Utilidad total: <span className="font-bold">{fmtPYG(Math.round(editProfit))}</span>
                  {' '}({newQtyNum} × {fmtPYG(Math.round(editPriceNum - editBatch.costPerDecant))})
                </div>
              )}
              <Input label="Notas" value={editNotes} onChange={e => setEditNotes(e.target.value)} />
              <div className="flex gap-2 pt-2">
                <Button variant="secondary" className="flex-1" onClick={() => setEditBatch(null)}>Cancelar</Button>
                <Button className="flex-1" onClick={handleEditBatch} disabled={!newQtyNum || !hasEnoughML}>Guardar cambios</Button>
              </div>
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}
