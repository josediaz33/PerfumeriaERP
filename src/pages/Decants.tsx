import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Droplets, FlaskConical, Package, Edit2, Trash2 } from 'lucide-react'
import { db } from '../db/db'
import type { DecantBatch } from '../db/types'
import { fmtPYG, fmtDate, today, nowISO } from '../lib/format'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Input, Select, Textarea } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'

const DECANT_SIZES = [3, 5, 10, 30]

export function Decants() {
  const allProducts = useLiveQuery(() => db.products.filter(p => p.type === 'decant_source').toArray()) ?? []
  const supplies = useLiveQuery(() => db.supplies.toArray()) ?? []
  const batches = useLiveQuery(() => db.decantBatches.orderBy('date').reverse().toArray()) ?? []

  const [showProduce, setShowProduce] = useState(false)
  const [showSupply, setShowSupply] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<number>(0)
  const [selectedSize, setSelectedSize] = useState<number>(5)
  const [qty, setQty] = useState('1')
  const [sellingPrice, setSellingPrice] = useState('')
  const [batchNotes, setBatchNotes] = useState('')
  const [batchDate, setBatchDate] = useState(today())

  const [supplyForm, setSupplyForm] = useState({ name: '', type: '5ml', sizeML: '5', costPYG: '', stock: '0', minStock: '10' })

  // Edit production
  const [editBatch, setEditBatch] = useState<DecantBatch | null>(null)
  const [editQty, setEditQty] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editNotes, setEditNotes] = useState('')

  const product = allProducts.find(p => p.id === selectedProduct)
  const costPerML = product ? product.costPYG / product.sizeML : 0
  const supplyForSize = supplies.find(s => s.sizeML === selectedSize)
  const supplyCost = supplyForSize?.costPYG ?? 0
  const decantCost = costPerML * selectedSize + supplyCost
  const maxDecants = product ? Math.floor(product.stockOpenML / selectedSize) : 0
  const quantityNum = parseInt(qty) || 0
  const totalMLNeeded = quantityNum * selectedSize
  const profit = sellingPrice ? (parseFloat(sellingPrice) - decantCost) * quantityNum : 0

  async function handleProduce() {
    if (!product || !quantityNum || !supplyForSize) return
    if (product.stockOpenML < totalMLNeeded) return

    const now = nowISO()
    await db.transaction('rw', db.products, db.decantBatches, db.supplies, async () => {
      await db.products.where('id').equals(product.id!).modify(p => {
        p.stockOpenML -= totalMLNeeded
      })
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

    if (mlDelta > 0 && prod.stockOpenML < mlDelta) return // not enough ml

    const supplyForSize = supplies.find(s => s.sizeML === editBatch.sizeML)

    await db.transaction('rw', db.products, db.decantBatches, db.supplies, async () => {
      await db.products.where('id').equals(prod.id!).modify(p => {
        p.stockOpenML = Math.max(0, p.stockOpenML - mlDelta)
      })
      if (supplyForSize && qtyDelta !== 0) {
        await db.supplies.where('id').equals(supplyForSize.id!).modify(s => {
          s.stock = Math.max(0, s.stock - qtyDelta)
        })
      }
      await db.decantBatches.update(editBatch.id!, {
        quantity: newQty,
        mlUsed: newMLUsed,
        sellingPricePYG: parseFloat(editPrice) || 0,
        date: editDate,
        notes: editNotes || undefined,
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

  async function handleDeleteSupply(id: number, name: string) {
    if (!confirm(`¿Eliminar "${name}"?`)) return
    await db.supplies.delete(id)
  }

  async function handleAddSupply() {
    if (!supplyForm.name || !supplyForm.costPYG) return
    const now = nowISO()
    await db.supplies.add({
      name: supplyForm.name,
      type: supplyForm.type as any,
      sizeML: parseFloat(supplyForm.sizeML) || undefined,
      costPYG: parseFloat(supplyForm.costPYG),
      stock: parseInt(supplyForm.stock) || 0,
      minStock: parseInt(supplyForm.minStock) || 10,
      createdAt: now, updatedAt: now,
    })
    setSupplyForm({ name: '', type: '5ml', sizeML: '5', costPYG: '', stock: '0', minStock: '10' })
    setShowSupply(false)
  }

  return (
    <div>
      <PageHeader
        title="Decants"
        subtitle="Cálculo de costos y producción de lotes"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Package size={15} />} onClick={() => setShowSupply(true)}>Gestionar insumos</Button>
            <Button icon={<Plus size={15} />} onClick={() => setShowProduce(true)}>Producir lote</Button>
          </div>
        }
      />

      {/* Calculadora por producto */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {allProducts.map(p => {
          const cpm = p.costPYG / p.sizeML
          return (
            <Card key={p.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{p.name}</p>
                    <p className="text-sm text-gray-500">{p.brand} · {p.sizeML}ml · {p.stockOpenML}ml disponibles</p>
                  </div>
                  <Badge color="violet">{fmtPYG(p.costPYG)}</Badge>
                </div>
              </CardHeader>
              <CardBody>
                <p className="text-xs text-gray-500 mb-3">Costo por ml: <span className="font-semibold text-gray-900">{fmtPYG(Math.round(cpm))}</span></p>
                <div className="grid grid-cols-4 gap-2">
                  {DECANT_SIZES.map(size => {
                    const sup = supplies.find(s => s.sizeML === size)
                    const cost = cpm * size + (sup?.costPYG ?? 0)
                    const canMake = Math.floor(p.stockOpenML / size)
                    return (
                      <div key={size} className="bg-gray-50 rounded-lg p-2.5 text-center">
                        <p className="text-xs font-medium text-violet-600">{size}ml</p>
                        <p className="text-sm font-bold text-gray-900 mt-1">{fmtPYG(Math.round(cost))}</p>
                        <p className="text-xs text-gray-400">frasco: {fmtPYG(sup?.costPYG ?? 0)}</p>
                        <p className="text-xs text-green-600 mt-1">{canMake} posibles</p>
                      </div>
                    )
                  })}
                </div>
              </CardBody>
            </Card>
          )
        })}
        {allProducts.length === 0 && (
          <div className="lg:col-span-2">
            <Card><CardBody className="text-center py-12">
              <FlaskConical size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-400">No hay botellas abiertas para decants</p>
              <p className="text-sm text-gray-400">Agrega productos de tipo "Para decants" en el inventario</p>
            </CardBody></Card>
          </div>
        )}
      </div>

      {/* Insumos */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Insumos (frascos)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {supplies.map(s => (
            <Card key={s.id}>
              <CardBody className="text-center">
                <p className="font-medium text-gray-900">{s.name}</p>
                <p className="text-lg font-bold text-violet-600 mt-1">{fmtPYG(s.costPYG)}</p>
                <p className={`text-sm mt-1 ${s.stock <= s.minStock ? 'text-orange-600' : 'text-gray-500'}`}>
                  Stock: {s.stock} u.
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>

      {/* Historial de lotes */}
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Historial de producción</h2>
      <Card>
        {batches.length === 0 ? (
          <CardBody className="text-center py-10">
            <Droplets size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400">Aún no hay lotes producidos</p>
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Fecha</th>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Perfume</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">Tamaño</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">Cantidad</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">Costo c/u</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">Precio venta</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">ML usados</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {batches.map(b => {
                  const p = allProducts.find(x => x.id === b.productId)
                  return (
                    <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-5 py-3 text-gray-500">{fmtDate(b.date)}</td>
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
                      <td className="px-5 py-3 text-right text-gray-600">{b.mlUsed}ml</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          {b.sourceType === 'sale' && (
                            <span className="text-xs text-blue-400 mr-1" title={`Venta #${b.sourceId}`}>V#{b.sourceId}</span>
                          )}
                          {b.sourceType === 'local_order' && (
                            <span className="text-xs text-orange-400 mr-1" title="Pedido local">P</span>
                          )}
                          <button
                            onClick={() => openEditBatch(b)}
                            className="p-1.5 rounded-lg text-gray-300 hover:bg-violet-50 hover:text-violet-500 transition-all cursor-pointer"
                            title="Editar producción"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteBatch(b)}
                            className="p-1.5 rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-500 transition-all cursor-pointer"
                            title="Eliminar producción"
                          >
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
              const p = allProducts.find(x => x.id === id)
              if (p) {
                const autoP = selectedSize === 3 ? p.price3ML : selectedSize === 5 ? p.price5ML : selectedSize === 10 ? p.price10ML : p.price30ML
                if (autoP) setSellingPrice(String(autoP))
              }
            }}
            options={[{ value: '0', label: 'Seleccionar...' }, ...allProducts.map(p => ({ value: String(p.id), label: `${p.brand} — ${p.name} (${p.stockOpenML}ml disponibles)` }))]}
          />
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Tamaño del decant</label>
            <div className="grid grid-cols-4 gap-2">
              {DECANT_SIZES.map(s => (
                <button
                  key={s}
                  onClick={() => {
                    setSelectedSize(s)
                    if (product) {
                      const autoP = s === 3 ? product.price3ML : s === 5 ? product.price5ML : s === 10 ? product.price10ML : product.price30ML
                      if (autoP) setSellingPrice(String(autoP))
                    }
                  }}
                  className={`py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors ${selectedSize === s ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {s}ml
                </button>
              ))}
            </div>
          </div>
          <Input label="Cantidad a producir" type="number" value={qty} onChange={e => setQty(e.target.value)} />

          {product && (
            <div className="bg-violet-50 rounded-xl p-4 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Costo por ml</span>
                <span className="font-semibold">{fmtPYG(Math.round(costPerML))}</span>
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
            <Button className="flex-1" onClick={handleProduce} disabled={!product || !quantityNum || totalMLNeeded > (product?.stockOpenML ?? 0)}>
              Producir
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal insumos */}
      <Modal isOpen={showSupply} onClose={() => setShowSupply(false)} title="Gestionar insumos">
        <div className="space-y-4">
          <h3 className="font-medium text-gray-900">Agregar insumo</h3>
          <Input label="Nombre" value={supplyForm.name} onChange={e => setSupplyForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Frasco 5ml con tapa" />
          <Select
            label="Tipo"
            value={supplyForm.type}
            onChange={e => setSupplyForm(f => ({ ...f, type: e.target.value }))}
            options={[
              { value: '3ml', label: 'Frasco 3ml' }, { value: '5ml', label: 'Frasco 5ml' },
              { value: '10ml', label: 'Frasco 10ml' }, { value: '30ml', label: 'Frasco 30ml' },
              { value: 'cap', label: 'Tapa' }, { value: 'label', label: 'Etiqueta' },
              { value: 'packaging', label: 'Packaging' }, { value: 'gift_wrap', label: 'Papel de regalo' },
              { value: 'other', label: 'Otro' },
            ]}
          />
          <Input label="Tamaño (ml, si aplica)" type="number" value={supplyForm.sizeML} onChange={e => setSupplyForm(f => ({ ...f, sizeML: e.target.value }))} />
          <Input label="Costo unitario (Gs.)" type="number" value={supplyForm.costPYG} onChange={e => setSupplyForm(f => ({ ...f, costPYG: e.target.value }))} />
          <Input label="Stock actual" type="number" value={supplyForm.stock} onChange={e => setSupplyForm(f => ({ ...f, stock: e.target.value }))} />
          <Button className="w-full" onClick={handleAddSupply}>Agregar insumo</Button>

          {supplies.length > 0 && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Insumos actuales</p>
              <div className="space-y-2">
                {supplies.map(s => (
                  <div key={s.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-gray-900">{s.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-violet-600 font-medium">{fmtPYG(s.costPYG)}</span>
                      <span className="text-gray-400">Stock:</span>
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
                        onClick={() => handleDeleteSupply(s.id!, s.name)}
                        className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 cursor-pointer transition-colors"
                        title="Eliminar insumo"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
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
                <Button className="flex-1" onClick={handleEditBatch} disabled={!newQtyNum || !hasEnoughML}>
                  Guardar cambios
                </Button>
              </div>
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}
