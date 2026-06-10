import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Truck, Globe, DollarSign, Package, ChevronDown, ChevronUp } from 'lucide-react'
import { db } from '../db/db'
import type { OrderStatus } from '../db/types'
import { fmtPYG, fmtUSD, fmtDate, today, nowISO } from '../lib/format'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Card, CardBody } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Input, Select, Textarea } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'

const statusColors: Record<OrderStatus, 'yellow' | 'blue' | 'violet' | 'green' | 'red'> = {
  pending: 'yellow', confirmed: 'blue', shipped: 'violet', received: 'green', cancelled: 'red',
}
const statusLabels: Record<OrderStatus, string> = {
  pending: 'Pendiente', confirmed: 'Confirmado', shipped: 'En camino', received: 'Recibido', cancelled: 'Cancelado',
}

export function Proveedores() {
  const suppliers = useLiveQuery(() => db.suppliers.toArray()) ?? []
  const orders = useLiveQuery(() => db.orders.orderBy('orderDate').reverse().toArray()) ?? []
  const products = useLiveQuery(() => db.products.toArray()) ?? []
  const [currentRate, setCurrentRate] = useState('7500')

  const [showSupplier, setShowSupplier] = useState(false)
  const [showOrder, setShowOrder] = useState(false)
  const [expandedSupplier, setExpandedSupplier] = useState<number | null>(null)

  const [sForm, setSForm] = useState({ name: '', country: 'Paraguay', website: '', paymentTerms: '', estimatedDeliveryDays: '7', notes: '' })
  const [oForm, setOForm] = useState({
    supplierId: '', exchangeRate: '7500', orderDate: today(),
    estimatedArrival: '', notes: '',
    items: [{ productName: '', brand: '', sizeML: '100', quantity: '1', unitPriceUSD: '' }],
  })

  async function handleCreateSupplier() {
    if (!sForm.name.trim()) return
    await db.suppliers.add({
      name: sForm.name, country: sForm.country, website: sForm.website,
      paymentTerms: sForm.paymentTerms, estimatedDeliveryDays: parseInt(sForm.estimatedDeliveryDays) || 7,
      notes: sForm.notes, createdAt: nowISO(),
    })
    setSForm({ name: '', country: 'Paraguay', website: '', paymentTerms: '', estimatedDeliveryDays: '7', notes: '' })
    setShowSupplier(false)
  }

  async function handleCreateOrder() {
    if (!oForm.supplierId) return
    const items = oForm.items.filter(i => i.productName && i.unitPriceUSD)
    if (!items.length) return
    const exchangeRate = parseFloat(oForm.exchangeRate) || 7500
    const totalUSD = items.reduce((s, i) => s + parseFloat(i.unitPriceUSD) * parseInt(i.quantity), 0)
    const now = nowISO()
    await db.orders.add({
      supplierId: parseInt(oForm.supplierId),
      items: items.map(i => ({
        productName: i.productName, brand: i.brand, sizeML: parseFloat(i.sizeML),
        quantity: parseInt(i.quantity), unitPriceUSD: parseFloat(i.unitPriceUSD),
      })),
      totalUSD, exchangeRate, totalPYG: totalUSD * exchangeRate,
      status: 'pending', orderDate: oForm.orderDate,
      estimatedArrival: oForm.estimatedArrival || undefined,
      notes: oForm.notes, createdAt: now,
    })
    setOForm({ supplierId: '', exchangeRate: '7500', orderDate: today(), estimatedArrival: '', notes: '', items: [{ productName: '', brand: '', sizeML: '100', quantity: '1', unitPriceUSD: '' }] })
    setShowOrder(false)
  }

  async function receiveOrder(orderId: number) {
    const order = orders.find(o => o.id === orderId)
    if (!order) return
    const now = nowISO()
    await db.orders.update(orderId, { status: 'received' })

    for (const item of order.items) {
      const existing = products.find(p => p.name.toLowerCase() === item.productName.toLowerCase() && p.brand.toLowerCase() === item.brand.toLowerCase())
      const costPYG = item.unitPriceUSD * order.exchangeRate
      if (existing) {
        await db.products.where('id').equals(existing.id!).modify(p => { p.stockSealed += item.quantity })
        await db.stockEntries.add({
          productId: existing.id!, supplierId: order.supplierId,
          quantity: item.quantity, costUSD: item.unitPriceUSD, exchangeRate: order.exchangeRate,
          costPYG, type: 'sealed', date: today(), createdAt: now,
        })
      } else {
        const id = await db.products.add({
          name: item.productName, brand: item.brand, olfactiveFamily: 'other',
          concentration: 'EDP', sizeML: item.sizeML,
          costUSD: item.unitPriceUSD, exchangeRateUsed: order.exchangeRate, costPYG,
          sellingPricePYG: 0, stockSealed: item.quantity, stockOpenML: 0,
          minStock: 1, type: 'sealed', createdAt: now, updatedAt: now,
        })
        await db.stockEntries.add({
          productId: id as number, supplierId: order.supplierId,
          quantity: item.quantity, costUSD: item.unitPriceUSD, exchangeRate: order.exchangeRate,
          costPYG, type: 'sealed', date: today(), createdAt: now,
        })
      }
    }
    alert('Pedido recibido e inventario actualizado.')
  }

  return (
    <div>
      <PageHeader
        title="Proveedores"
        subtitle="Gestión de proveedores y comparación de precios"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Package size={15} />} onClick={() => setShowOrder(true)}>Nuevo pedido</Button>
            <Button icon={<Plus size={15} />} onClick={() => setShowSupplier(true)}>Nuevo proveedor</Button>
          </div>
        }
      />

      {/* Cotización actual */}
      <Card className="mb-6">
        <CardBody className="flex items-center gap-4">
          <DollarSign size={20} className="text-violet-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-700">Cotización USD/PYG actual</p>
            <p className="text-xs text-gray-400">Usada para comparar precios en guaraníes</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={currentRate}
              onChange={e => setCurrentRate(e.target.value)}
              className="w-28 text-right"
            />
            <span className="text-sm text-gray-500">Gs. por USD</span>
          </div>
        </CardBody>
      </Card>

      {/* Proveedores */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Proveedores registrados</h2>
        {suppliers.length === 0 ? (
          <Card><CardBody className="text-center py-10">
            <Truck size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400">No hay proveedores registrados</p>
          </CardBody></Card>
        ) : (
          <div className="space-y-3">
            {suppliers.map(s => {
              const sOrders = orders.filter(o => o.supplierId === s.id)
              const totalSpent = sOrders.filter(o => o.status === 'received').reduce((sum, o) => sum + o.totalPYG, 0)
              const isExpanded = expandedSupplier === s.id
              return (
                <Card key={s.id}>
                  <CardBody>
                    <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedSupplier(isExpanded ? null : s.id!)}>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-violet-50"><Truck size={18} className="text-violet-600" /></div>
                        <div>
                          <p className="font-semibold text-gray-900">{s.name}</p>
                          <p className="text-sm text-gray-500">{s.country} · {s.estimatedDeliveryDays} días estimados</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {s.website && (
                          <a href={s.website} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-violet-600 hover:underline text-sm flex items-center gap-1">
                            <Globe size={14} /> Sitio web
                          </a>
                        )}
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-900">{fmtPYG(totalSpent)}</p>
                          <p className="text-xs text-gray-400">total gastado</p>
                        </div>
                        {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                      </div>
                    </div>
                    {isExpanded && s.notes && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-sm text-gray-500">{s.notes}</p>
                      </div>
                    )}
                  </CardBody>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Pedidos */}
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Pedidos</h2>
      <Card>
        {orders.length === 0 ? (
          <CardBody className="text-center py-10">
            <Package size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400">No hay pedidos registrados</p>
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Fecha</th>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Proveedor</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">Total USD</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">Total PYG</th>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Estado</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">Acción</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => {
                  const supplier = suppliers.find(s => s.id === o.supplierId)
                  return (
                    <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-5 py-3 text-gray-500">{fmtDate(o.orderDate)}</td>
                      <td className="px-5 py-3 font-medium text-gray-900">{supplier?.name ?? '—'}</td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-900">{fmtUSD(o.totalUSD)}</td>
                      <td className="px-5 py-3 text-right text-gray-600">{fmtPYG(o.totalPYG)}</td>
                      <td className="px-5 py-3"><Badge color={statusColors[o.status]}>{statusLabels[o.status]}</Badge></td>
                      <td className="px-5 py-3 text-right">
                        {o.status !== 'received' && o.status !== 'cancelled' && (
                          <Button size="sm" variant="secondary" onClick={() => receiveOrder(o.id!)}>
                            Recibir
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal proveedor */}
      <Modal isOpen={showSupplier} onClose={() => setShowSupplier(false)} title="Nuevo proveedor">
        <div className="space-y-4">
          <Input label="Nombre" value={sForm.name} onChange={e => setSForm(f => ({ ...f, name: e.target.value }))} />
          <Input label="País" value={sForm.country} onChange={e => setSForm(f => ({ ...f, country: e.target.value }))} />
          <Input label="Sitio web (opcional)" value={sForm.website} onChange={e => setSForm(f => ({ ...f, website: e.target.value }))} placeholder="https://..." />
          <Input label="Condiciones de pago" value={sForm.paymentTerms} onChange={e => setSForm(f => ({ ...f, paymentTerms: e.target.value }))} placeholder="Ej: Pago anticipado" />
          <Input label="Días de entrega estimados" type="number" value={sForm.estimatedDeliveryDays} onChange={e => setSForm(f => ({ ...f, estimatedDeliveryDays: e.target.value }))} />
          <Textarea label="Notas" value={sForm.notes} onChange={e => setSForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowSupplier(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleCreateSupplier}>Crear</Button>
          </div>
        </div>
      </Modal>

      {/* Modal pedido */}
      <Modal isOpen={showOrder} onClose={() => setShowOrder(false)} title="Nuevo pedido" size="xl">
        <div className="space-y-4">
          <Select
            label="Proveedor"
            value={oForm.supplierId}
            onChange={e => setOForm(f => ({ ...f, supplierId: e.target.value }))}
            options={[{ value: '', label: 'Seleccionar...' }, ...suppliers.map(s => ({ value: String(s.id), label: s.name }))]}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Cotización USD/PYG" type="number" value={oForm.exchangeRate} onChange={e => setOForm(f => ({ ...f, exchangeRate: e.target.value }))} />
            <Input label="Fecha del pedido" type="date" value={oForm.orderDate} onChange={e => setOForm(f => ({ ...f, orderDate: e.target.value }))} />
          </div>
          <Input label="Llegada estimada" type="date" value={oForm.estimatedArrival} onChange={e => setOForm(f => ({ ...f, estimatedArrival: e.target.value }))} />

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Productos del pedido</p>
            {oForm.items.map((item, i) => (
              <div key={i} className="grid grid-cols-5 gap-2 mb-2">
                <Input placeholder="Marca" value={item.brand} onChange={e => setOForm(f => ({ ...f, items: f.items.map((x, j) => j === i ? { ...x, brand: e.target.value } : x) }))} />
                <Input placeholder="Nombre" value={item.productName} onChange={e => setOForm(f => ({ ...f, items: f.items.map((x, j) => j === i ? { ...x, productName: e.target.value } : x) }))} />
                <Input placeholder="ml" type="number" value={item.sizeML} onChange={e => setOForm(f => ({ ...f, items: f.items.map((x, j) => j === i ? { ...x, sizeML: e.target.value } : x) }))} />
                <Input placeholder="Cant." type="number" value={item.quantity} onChange={e => setOForm(f => ({ ...f, items: f.items.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x) }))} />
                <Input placeholder="USD c/u" type="number" value={item.unitPriceUSD} onChange={e => setOForm(f => ({ ...f, items: f.items.map((x, j) => j === i ? { ...x, unitPriceUSD: e.target.value } : x) }))} />
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setOForm(f => ({ ...f, items: [...f.items, { productName: '', brand: '', sizeML: '100', quantity: '1', unitPriceUSD: '' }] }))}>
              + Agregar línea
            </Button>
          </div>

          {oForm.items.some(i => i.unitPriceUSD) && (
            <div className="bg-violet-50 rounded-lg p-3 text-sm">
              <span className="text-gray-500">Total estimado: </span>
              <span className="font-bold text-violet-700">{fmtUSD(oForm.items.reduce((s, i) => s + (parseFloat(i.unitPriceUSD) || 0) * (parseInt(i.quantity) || 0), 0))}</span>
              <span className="text-gray-400 ml-2">= {fmtPYG(oForm.items.reduce((s, i) => s + (parseFloat(i.unitPriceUSD) || 0) * (parseInt(i.quantity) || 0), 0) * parseFloat(oForm.exchangeRate))}</span>
            </div>
          )}

          <Textarea label="Notas" value={oForm.notes} onChange={e => setOForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowOrder(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleCreateOrder}>Crear pedido</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
