import { useState, Fragment } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Truck, Globe, DollarSign, Package, ChevronDown, ChevronUp, Trash2, X as XIcon, Edit2 } from 'lucide-react'
import { db } from '../db/db'
import type { Order, OrderStatus } from '../db/types'
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
  const accounts = useLiveQuery(() => db.accounts.filter(a => a.isActive !== false).toArray()) ?? []
  const [currentRate, setCurrentRate] = useState('7500')

  const [showSupplier, setShowSupplier] = useState(false)
  const [showOrder, setShowOrder] = useState(false)
  const [expandedSupplier, setExpandedSupplier] = useState<number | null>(null)
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null)

  // Receive modal
  const [showReceive, setShowReceive] = useState(false)
  const [receivingOrderId, setReceivingOrderId] = useState<number | null>(null)
  const [receiveShipping, setReceiveShipping] = useState('0')
  const [receiveDate, setReceiveDate] = useState(today())
  const [receiveRegisterPayment, setReceiveRegisterPayment] = useState(false)
  const [receiveAccountId, setReceiveAccountId] = useState('')

  // Pay order upfront modal
  const [showPayOrder, setShowPayOrder] = useState(false)
  const [payingOrder, setPayingOrder] = useState<Order | null>(null)
  const [payOrderAccountId, setPayOrderAccountId] = useState('')

  // Edit received order modal
  const [editOrder, setEditOrder] = useState<Order | null>(null)
  const [editOrderForm, setEditOrderForm] = useState({
    exchangeRate: '7500',
    shippingTotal: '0',
    items: [] as { productName: string; brand: string; sizeML: number; quantity: number; unitPriceUSD: string }[],
  })

  const [sForm, setSForm] = useState({
    name: '', country: 'Paraguay', website: '', paymentTerms: '', estimatedDeliveryDays: '7', notes: '',
  })
  const [oForm, setOForm] = useState({
    supplierId: '', exchangeRate: '7500', orderDate: today(), estimatedArrival: '', notes: '',
    localCurrency: false,
    registerPayment: false, paymentAccountId: '',
    items: [{ productName: '', brand: '', sizeML: '100', quantity: '1', unitPriceUSD: '' }],
  })
  const [activeItemSearch, setActiveItemSearch] = useState<number | null>(null)

  const receivingOrder = receivingOrderId != null ? orders.find(o => o.id === receivingOrderId) : null

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
    const isLocal = oForm.localCurrency
    const exchangeRate = isLocal ? 1 : (parseFloat(oForm.exchangeRate) || 7500)
    const totalUSD = items.reduce((s, i) => s + parseFloat(i.unitPriceUSD) * parseInt(i.quantity), 0)
    const totalPYG = Math.round(totalUSD * exchangeRate)
    const shouldPay = !!(oForm.registerPayment && oForm.paymentAccountId)
    const accId = shouldPay ? parseInt(oForm.paymentAccountId) : null
    const supplierName = suppliers.find(s => s.id === parseInt(oForm.supplierId))?.name ?? 'Proveedor'
    const now = nowISO()
    const orderData = {
      supplierId: parseInt(oForm.supplierId),
      items: items.map(i => ({
        productName: i.productName, brand: i.brand, sizeML: parseFloat(i.sizeML),
        quantity: parseInt(i.quantity), unitPriceUSD: parseFloat(i.unitPriceUSD),
      })),
      totalUSD, exchangeRate, totalPYG,
      localCurrency: isLocal || undefined,
      status: 'pending' as const,
      orderDate: oForm.orderDate,
      estimatedArrival: oForm.estimatedArrival || undefined,
      notes: oForm.notes || undefined,
      prepaidAmount: shouldPay ? totalPYG : undefined,
      createdAt: now,
    }
    async function preCreateProducts() {
      for (const item of items) {
        const exists = products.find(
          p => p.name.toLowerCase() === item.productName.toLowerCase() &&
               p.brand.toLowerCase() === item.brand.toLowerCase()
        )
        if (!exists) {
          await db.products.add({
            name: item.productName, brand: item.brand,
            olfactiveFamily: 'other', concentration: 'EDP',
            sizeML: parseFloat(item.sizeML),
            costUSD: parseFloat(item.unitPriceUSD),
            exchangeRateUsed: exchangeRate,
            costPYG: Math.round(parseFloat(item.unitPriceUSD) * exchangeRate),
            sellingPricePYG: 0,
            stockSealed: 0, stockOpenML: 0,
            minStock: 1, type: 'sealed',
            createdAt: now, updatedAt: now,
          })
        }
      }
    }

    if (shouldPay && accId) {
      await db.transaction('rw', [db.orders, db.movements, db.accounts, db.products], async () => {
        await preCreateProducts()
        const orderId = await db.orders.add(orderData)
        await db.movements.add({
          type: 'expense', category: 'restock', amount: totalPYG, accountId: accId,
          description: `Pago anticipado — ${supplierName} (${items.length} producto(s))`,
          referenceId: orderId as number, referenceType: 'order',
          date: oForm.orderDate, createdAt: now,
        })
        await db.accounts.where('id').equals(accId).modify(a => { a.balance -= totalPYG })
      })
    } else {
      await db.transaction('rw', [db.orders, db.products], async () => {
        await preCreateProducts()
        await db.orders.add(orderData)
      })
    }
    setOForm({
      supplierId: '', exchangeRate: '7500', orderDate: today(), estimatedArrival: '', notes: '',
      localCurrency: false, registerPayment: false, paymentAccountId: '',
      items: [{ productName: '', brand: '', sizeML: '100', quantity: '1', unitPriceUSD: '' }],
    })
    setShowOrder(false)
  }

  async function handlePayOrder() {
    if (!payingOrder || !payOrderAccountId) return
    const accId = parseInt(payOrderAccountId)
    const totalPYG = payingOrder.totalPYG
    const supplierName = suppliers.find(s => s.id === payingOrder.supplierId)?.name ?? 'Proveedor'
    const now = nowISO()
    await db.transaction('rw', [db.orders, db.movements, db.accounts], async () => {
      await db.movements.add({
        type: 'expense', category: 'restock', amount: totalPYG, accountId: accId,
        description: `Pago anticipado — ${supplierName} (${payingOrder.items.length} producto(s))`,
        referenceId: payingOrder.id, referenceType: 'order',
        date: today(), createdAt: now,
      })
      await db.accounts.where('id').equals(accId).modify(a => { a.balance -= totalPYG })
      await db.orders.update(payingOrder.id!, { prepaidAmount: totalPYG })
    })
    setShowPayOrder(false)
    setPayingOrder(null)
  }

  async function handleAdvanceStatus(orderId: number, from: OrderStatus) {
    const next: Partial<Record<OrderStatus, OrderStatus>> = { pending: 'confirmed', confirmed: 'shipped' }
    const nextStatus = next[from]
    if (nextStatus) await db.orders.update(orderId, { status: nextStatus })
  }

  function openReceive(orderId: number) {
    setReceivingOrderId(orderId)
    setReceiveShipping('0')
    setReceiveDate(today())
    setReceiveRegisterPayment(false)
    setReceiveAccountId(accounts[0] ? String(accounts[0].id) : '')
    setShowReceive(true)
  }

  async function handleReceiveOrder() {
    if (receivingOrderId == null || !receivingOrder) return
    const order = receivingOrder
    const exchangeRate = order.exchangeRate
    const shippingTotal = parseFloat(receiveShipping) || 0
    const totalUSD = order.totalUSD
    const now = nowISO()

    const batchId = await db.shipmentBatches.add({
      supplierId: order.supplierId,
      date: receiveDate,
      description: `Pedido #${receivingOrderId}`,
      exchangeRate,
      totalShippingPYG: shippingTotal,
      createdAt: now,
    })

    await db.transaction('rw', [db.orders, db.products, db.stockEntries, db.movements, db.accounts], async () => {
      for (const item of order.items) {
        const existing = products.find(
          p => p.name.toLowerCase() === item.productName.toLowerCase() &&
               p.brand.toLowerCase() === item.brand.toLowerCase()
        )

        const isDecant = existing?.type === 'decant_source'
        const sizeML = isDecant && existing?.sizeML ? existing.sizeML : item.sizeML

        // For decant_source: qty = total ML, costUSD = per ML
        const qty = isDecant ? item.quantity * sizeML : item.quantity
        const costUSD = isDecant ? item.unitPriceUSD / sizeML : item.unitPriceUSD

        // Distribute shipping proportionally by USD value
        const myUSD = item.unitPriceUSD * item.quantity
        const myShippingPYG = totalUSD > 0 ? shippingTotal * (myUSD / totalUSD) : 0
        const shippingPerUnit = qty > 0 ? myShippingPYG / qty : 0
        const batchCostPYG = costUSD * exchangeRate + shippingPerUnit

        if (existing) {
          const existingQty = isDecant ? existing.stockOpenML : existing.stockSealed
          const newCPP = existingQty > 0
            ? (existingQty * existing.costPYG + qty * batchCostPYG) / (existingQty + qty)
            : batchCostPYG

          await db.products.where('id').equals(existing.id!).modify(p => {
            if (isDecant) p.stockOpenML += qty
            else p.stockSealed += qty
            p.costPYG = newCPP
            p.costUSD = costUSD
            p.exchangeRateUsed = exchangeRate
            p.updatedAt = now
          })
          await db.stockEntries.add({
            productId: existing.id!, supplierId: order.supplierId,
            orderId: receivingOrderId, shipmentBatchId: batchId as number,
            quantity: qty, quantityRemaining: qty,
            costUSD, exchangeRate, costPYG: batchCostPYG,
            type: existing.type, date: receiveDate, createdAt: now,
          })
        } else {
          const productId = await db.products.add({
            name: item.productName, brand: item.brand, olfactiveFamily: 'other',
            concentration: 'EDP', sizeML: item.sizeML,
            costUSD: item.unitPriceUSD, exchangeRateUsed: exchangeRate,
            costPYG: batchCostPYG, sellingPricePYG: 0,
            stockSealed: item.quantity, stockOpenML: 0,
            minStock: 1, type: 'sealed', createdAt: now, updatedAt: now,
          })
          await db.stockEntries.add({
            productId: productId as number, supplierId: order.supplierId,
            orderId: receivingOrderId, shipmentBatchId: batchId as number,
            quantity: item.quantity, quantityRemaining: item.quantity,
            costUSD: item.unitPriceUSD, exchangeRate,
            costPYG: batchCostPYG, type: 'sealed', date: receiveDate, createdAt: now,
          })
        }
      }

      await db.orders.update(receivingOrderId, { status: 'received', shippingTotalPYG: shippingTotal })

      if (receiveRegisterPayment && receiveAccountId) {
        const isPrepaid = (order.prepaidAmount ?? 0) > 0
        const amountToPay = isPrepaid ? shippingTotal : (order.totalPYG + shippingTotal)
        if (amountToPay > 0) {
          const supplierName = suppliers.find(s => s.id === order.supplierId)?.name ?? 'Proveedor'
          await db.movements.add({
            type: 'expense', category: 'restock',
            amount: amountToPay,
            accountId: parseInt(receiveAccountId),
            description: isPrepaid
              ? `Envío — Pedido a ${supplierName}`
              : `Pedido a ${supplierName} — ${order.items.length} producto(s)`,
            referenceId: receivingOrderId, referenceType: 'order',
            date: receiveDate, createdAt: now,
          })
          await db.accounts.where('id').equals(parseInt(receiveAccountId)).modify(a => { a.balance -= amountToPay })
        }
      }
    })

    setShowReceive(false)
    setReceivingOrderId(null)
  }

  function openEditReceivedOrder(order: Order) {
    setEditOrder(order)
    setEditOrderForm({
      exchangeRate: String(order.exchangeRate),
      shippingTotal: String(order.shippingTotalPYG ?? 0),
      items: order.items.map(i => ({
        productName: i.productName,
        brand: i.brand,
        sizeML: i.sizeML,
        quantity: i.quantity,
        unitPriceUSD: String(i.unitPriceUSD),
      })),
    })
  }

  async function handleEditReceivedOrder() {
    if (!editOrder) return
    const isLocal = editOrder.localCurrency ?? false
    const newRate = isLocal ? 1 : (parseFloat(editOrderForm.exchangeRate) || 7500)
    const newShipping = parseFloat(editOrderForm.shippingTotal) || 0
    const newItems = editOrderForm.items.map((fi, idx) => ({
      ...editOrder.items[idx],
      unitPriceUSD: parseFloat(fi.unitPriceUSD) || 0,
    }))
    const newTotalUSD = newItems.reduce((s, i) => s + i.unitPriceUSD * i.quantity, 0)
    const newTotalPYG = Math.round(newTotalUSD * newRate + newShipping)

    // Compute old total to derive account delta
    const oldTotalPYG = editOrder.totalPYG + (editOrder.shippingTotalPYG ?? 0)
    const costDelta = newTotalPYG - oldTotalPYG

    const now = nowISO()
    const entries = await db.stockEntries.where('orderId').equals(editOrder.id!).toArray()

    await db.transaction('rw', [db.orders, db.stockEntries, db.products, db.movements, db.accounts], async () => {
      // Update the order record
      await db.orders.update(editOrder.id!, {
        items: newItems,
        totalUSD: newTotalUSD,
        exchangeRate: newRate,
        totalPYG: Math.round(newTotalUSD * newRate),
        shippingTotalPYG: newShipping,
      })

      // Update each stock entry cost and recalculate product CPP
      const affectedProductIds = new Set<number>()
      for (const entry of entries) {
        const product = products.find(p => p.id === entry.productId)
        if (!product) continue
        // Find matching order item by product name/brand
        const matchedItem = newItems.find(
          i => i.productName.toLowerCase() === product.name.toLowerCase() &&
               i.brand.toLowerCase() === product.brand.toLowerCase()
        )
        if (!matchedItem) continue

        const isDecant = product.type === 'decant_source'
        const sizeML = product.sizeML || matchedItem.sizeML
        const itemQty = matchedItem.quantity
        const myUSD = matchedItem.unitPriceUSD * itemQty
        const myShippingPYG = newTotalUSD > 0 ? newShipping * (myUSD / (newTotalUSD)) : 0
        const shippingPerUnit = (isDecant ? itemQty * sizeML : itemQty) > 0
          ? myShippingPYG / (isDecant ? itemQty * sizeML : itemQty)
          : 0
        const costUSD = isDecant ? matchedItem.unitPriceUSD / sizeML : matchedItem.unitPriceUSD
        const newCostPYG = costUSD * newRate + shippingPerUnit

        await db.stockEntries.update(entry.id!, { costUSD, exchangeRate: newRate, costPYG: newCostPYG })
        affectedProductIds.add(product.id!)
      }

      // Recalculate CPP for each affected product
      for (const pid of affectedProductIds) {
        const allLots = await db.stockEntries.where('productId').equals(pid).toArray()
        const totalQty = allLots.reduce((s, l) => s + l.quantity, 0)
        if (totalQty > 0) {
          const newCPP = allLots.reduce((s, l) => s + l.costPYG * l.quantity, 0) / totalQty
          const newCostUSD = allLots.reduce((s, l) => s + l.costUSD * l.quantity, 0) / totalQty
          await db.products.where('id').equals(pid).modify(p => {
            p.costPYG = newCPP
            p.costUSD = newCostUSD
            p.exchangeRateUsed = newRate
            p.updatedAt = now
          })
        }
      }

      // Cascade to accounting movement + account balance
      if (Math.abs(costDelta) > 0) {
        const movement = await db.movements.filter(
          m => m.referenceType === 'order' && m.referenceId === editOrder.id
        ).first()
        if (movement) {
          const newAmount = Math.max(0, movement.amount + costDelta)
          await db.movements.update(movement.id!, { amount: newAmount })
          await db.accounts.where('id').equals(movement.accountId).modify(a => { a.balance -= costDelta })
        }
      }
    })

    setEditOrder(null)
  }

  async function handleDeleteOrder(order: (typeof orders)[0]) {
    const isReceived = order.status === 'received'
    const supplierName = suppliers.find(s => s.id === order.supplierId)?.name ?? 'proveedor'
    const msg = isReceived
      ? `¿Eliminar el pedido recibido de ${supplierName}?\n\nEsto eliminará los lotes de stock ingresados y revertirá el inventario.`
      : `¿Eliminar el pedido a ${supplierName}?`
    if (!confirm(msg)) return

    if (!isReceived) {
      await db.orders.delete(order.id!)
      return
    }

    const entries = await db.stockEntries.where('orderId').equals(order.id!).toArray()

    await db.transaction('rw', [db.orders, db.stockEntries, db.products, db.movements, db.accounts, db.shipmentBatches], async () => {
      // Revert stock
      for (const entry of entries) {
        await db.products.where('id').equals(entry.productId).modify(p => {
          if (entry.type === 'decant_source') p.stockOpenML = Math.max(0, p.stockOpenML - entry.quantity)
          else p.stockSealed = Math.max(0, p.stockSealed - entry.quantity)
          p.updatedAt = nowISO()
        })
      }
      // Recalculate CPP per affected product
      const affectedIds = [...new Set(entries.map(e => e.productId))]
      for (const pid of affectedIds) {
        const entryIds = new Set(entries.filter(e => e.productId === pid).map(e => e.id!))
        const remaining = (await db.stockEntries.where('productId').equals(pid).toArray()).filter(e => !entryIds.has(e.id!))
        const totalQty = remaining.reduce((s, e) => s + e.quantity, 0)
        if (totalQty > 0) {
          const newCPP = remaining.reduce((s, e) => s + e.costPYG * e.quantity, 0) / totalQty
          const newCostUSD = remaining.reduce((s, e) => s + e.costUSD * e.quantity, 0) / totalQty
          await db.products.where('id').equals(pid).modify(p => { p.costPYG = newCPP; p.costUSD = newCostUSD })
        }
      }
      // Delete stock entries
      await db.stockEntries.bulkDelete(entries.map(e => e.id!))
      // Delete shipment batch created for this order
      const batchId = entries[0]?.shipmentBatchId
      if (batchId) await db.shipmentBatches.delete(batchId)
      // Reverse payment movement if any
      const movement = await db.movements.where('referenceId').equals(order.id!).filter(m => m.referenceType === 'order').first()
      if (movement?.id) {
        await db.accounts.where('id').equals(movement.accountId).modify(a => { a.balance += movement.amount })
        await db.movements.delete(movement.id)
      }
      await db.orders.delete(order.id!)
    })
  }

  return (
    <div>
      <PageHeader
        title="Proveedores"
        subtitle="Gestión de proveedores y pedidos internacionales"
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
            <Input type="number" value={currentRate} onChange={e => setCurrentRate(e.target.value)} className="w-28 text-right" />
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
              const totalSpent = sOrders.filter(o => o.status === 'received').reduce((sum, o) => sum + o.totalPYG + (o.shippingTotalPYG ?? 0), 0)
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
                          <p className="text-xs text-gray-400">total gastado (con envío)</p>
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
                  <th className="w-8 px-3 py-3"></th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Fecha</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Proveedor</th>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium">Total USD</th>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium">Total PYG</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Estado</th>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => {
                  const supplier = suppliers.find(s => s.id === o.supplierId)
                  const isExpanded = expandedOrder === o.id
                  return (
                    <Fragment key={o.id}>
                      <tr className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-3 py-3">
                          <button
                            onClick={() => setExpandedOrder(isExpanded ? null : o.id!)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{fmtDate(o.orderDate)}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{supplier?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                          {o.localCurrency ? <span className="text-xs text-green-600 font-medium">Local</span> : fmtUSD(o.totalUSD)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">{fmtPYG(o.totalPYG)}</td>
                        <td className="px-4 py-3"><Badge color={statusColors[o.status]}>{statusLabels[o.status]}</Badge></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {(o.prepaidAmount ?? 0) > 0 && o.status !== 'received' && (
                              <span className="text-xs text-green-600 font-semibold px-2 py-0.5 bg-green-50 rounded-full">Prepagado</span>
                            )}
                            {o.status !== 'received' && !(o.prepaidAmount) && (
                              <Button size="sm" variant="secondary" onClick={() => { setPayingOrder(o); setPayOrderAccountId(accounts[0] ? String(accounts[0].id) : ''); setShowPayOrder(true) }}>
                                Pagar
                              </Button>
                            )}
                            {o.status === 'pending' && (
                              <Button size="sm" variant="secondary" onClick={() => handleAdvanceStatus(o.id!, 'pending')}>
                                Confirmar
                              </Button>
                            )}
                            {o.status === 'confirmed' && (
                              <Button size="sm" variant="secondary" onClick={() => handleAdvanceStatus(o.id!, 'confirmed')}>
                                Enviado
                              </Button>
                            )}
                            {o.status === 'shipped' && (
                              <Button size="sm" onClick={() => openReceive(o.id!)}>
                                Recibir
                              </Button>
                            )}
                            {o.status === 'received' && (
                              <button
                                onClick={() => openEditReceivedOrder(o)}
                                className="p-1.5 rounded text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                                title="Editar precios del pedido recibido"
                              >
                                <Edit2 size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteOrder(o)}
                              className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              title="Eliminar pedido"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <td colSpan={7} className="px-8 py-4">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Detalle del pedido</p>
                            <table className="w-full text-sm mb-2">
                              <thead>
                                <tr>
                                  <th className="text-left pb-2 text-gray-400 font-normal">Marca</th>
                                  <th className="text-left pb-2 text-gray-400 font-normal">Nombre</th>
                                  <th className="text-right pb-2 text-gray-400 font-normal">Tamaño</th>
                                  <th className="text-right pb-2 text-gray-400 font-normal">Cant.</th>
                                  <th className="text-right pb-2 text-gray-400 font-normal">P. Unit.</th>
                                  <th className="text-right pb-2 text-gray-400 font-normal">Subtotal</th>
                                  <th className="text-left pb-2 text-gray-400 font-normal pl-4">Inventario</th>
                                </tr>
                              </thead>
                              <tbody>
                                {o.items.map((item, idx) => {
                                  const matched = products.find(
                                    p => p.name.toLowerCase() === item.productName.toLowerCase() &&
                                         p.brand.toLowerCase() === item.brand.toLowerCase()
                                  )
                                  return (
                                    <tr key={idx} className="border-t border-gray-100">
                                      <td className="py-1.5 text-gray-700">{item.brand}</td>
                                      <td className="py-1.5 text-gray-700">{item.productName}</td>
                                      <td className="py-1.5 text-right text-gray-500">{item.sizeML}ml</td>
                                      <td className="py-1.5 text-right text-gray-700 font-medium">×{item.quantity}</td>
                                      <td className="py-1.5 text-right text-gray-700">
                                        {o.localCurrency ? fmtPYG(item.unitPriceUSD) : fmtUSD(item.unitPriceUSD)}
                                      </td>
                                      <td className="py-1.5 text-right font-semibold text-gray-900">
                                        {o.localCurrency ? fmtPYG(item.unitPriceUSD * item.quantity) : fmtUSD(item.unitPriceUSD * item.quantity)}
                                      </td>
                                      <td className="py-1.5 pl-4">
                                        {matched ? (
                                          <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                                            En stock ({matched.type === 'decant_source' ? `${matched.stockOpenML}ml` : `${matched.stockSealed} uds`})
                                          </span>
                                        ) : (
                                          <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full">
                                            Producto nuevo
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                            {o.shippingTotalPYG != null && o.shippingTotalPYG > 0 && (
                              <p className="text-xs text-gray-500">Envío registrado: <span className="font-medium">{fmtPYG(o.shippingTotalPYG)}</span></p>
                            )}
                            {o.estimatedArrival && (
                              <p className="text-xs text-gray-400 mt-1">Llegada estimada: {fmtDate(o.estimatedArrival)}</p>
                            )}
                            {o.notes && <p className="text-xs text-gray-400 italic mt-1">{o.notes}</p>}
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
      <Modal isOpen={showOrder} onClose={() => { setShowOrder(false); setActiveItemSearch(null) }} title="Nuevo pedido" size="xl">
        <div className="space-y-4">
          <Select
            label="Proveedor"
            value={oForm.supplierId}
            onChange={e => setOForm(f => ({ ...f, supplierId: e.target.value }))}
            options={[{ value: '', label: 'Seleccionar...' }, ...suppliers.map(s => ({ value: String(s.id), label: s.name }))]}
          />

          {/* Toggle moneda local */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => setOForm(f => ({ ...f, localCurrency: !f.localCurrency }))}
              className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${oForm.localCurrency ? 'bg-green-500' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${oForm.localCurrency ? 'translate-x-5' : ''}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Compra en Guaraníes (proveedor local)</p>
              {oForm.localCurrency && <p className="text-xs text-green-600">Los precios se ingresan directamente en Gs. sin tipo de cambio.</p>}
            </div>
          </label>

          <div className={`grid gap-4 ${oForm.localCurrency ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {!oForm.localCurrency && (
              <Input label="Cotización USD/PYG" type="number" value={oForm.exchangeRate} onChange={e => setOForm(f => ({ ...f, exchangeRate: e.target.value }))} />
            )}
            <Input label="Fecha del pedido" type="date" value={oForm.orderDate} onChange={e => setOForm(f => ({ ...f, orderDate: e.target.value }))} />
          </div>
          <Input label="Llegada estimada (opcional)" type="date" value={oForm.estimatedArrival} onChange={e => setOForm(f => ({ ...f, estimatedArrival: e.target.value }))} />

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Productos del pedido</p>
            {oForm.items.map((item, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_80px_72px_100px_28px] gap-2 mb-2 items-start">
                <Input placeholder="Marca" value={item.brand} onChange={e => setOForm(f => ({ ...f, items: f.items.map((x, j) => j === i ? { ...x, brand: e.target.value } : x) }))} />
                {/* Nombre con autocomplete */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Nombre"
                    value={item.productName}
                    onChange={e => {
                      setOForm(f => ({ ...f, items: f.items.map((x, j) => j === i ? { ...x, productName: e.target.value } : x) }))
                      setActiveItemSearch(i)
                    }}
                    onFocus={() => setActiveItemSearch(i)}
                    onBlur={() => setTimeout(() => setActiveItemSearch(null), 150)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                    autoComplete="off"
                  />
                  {activeItemSearch === i && item.productName.length >= 1 && (() => {
                    const matches = products.filter(p =>
                      p.name.toLowerCase().includes(item.productName.toLowerCase()) ||
                      p.brand.toLowerCase().includes(item.productName.toLowerCase())
                    ).slice(0, 6)
                    return matches.length > 0 ? (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                        {matches.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onMouseDown={() => {
                              setOForm(f => ({ ...f, items: f.items.map((x, j) => j === i ? { ...x, productName: p.name, brand: p.brand, sizeML: String(p.sizeML) } : x) }))
                              setActiveItemSearch(null)
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-violet-50 text-left text-sm border-b border-gray-50 last:border-0"
                          >
                            <span className="text-gray-400 text-xs shrink-0">{p.brand}</span>
                            <span className="font-medium text-gray-900 flex-1 truncate">{p.name}</span>
                            <span className="text-xs text-gray-400 shrink-0">{p.sizeML}ml</span>
                          </button>
                        ))}
                      </div>
                    ) : null
                  })()}
                </div>
                <Input placeholder="ml" type="number" value={item.sizeML} onChange={e => setOForm(f => ({ ...f, items: f.items.map((x, j) => j === i ? { ...x, sizeML: e.target.value } : x) }))} />
                <Input placeholder="Cant." type="number" value={item.quantity} onChange={e => setOForm(f => ({ ...f, items: f.items.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x) }))} />
                <Input placeholder={oForm.localCurrency ? 'Gs. c/u' : 'USD c/u'} type="number" value={item.unitPriceUSD} onChange={e => setOForm(f => ({ ...f, items: f.items.map((x, j) => j === i ? { ...x, unitPriceUSD: e.target.value } : x) }))} />
                <button
                  onClick={() => setOForm(f => ({ ...f, items: f.items.filter((_, j) => j !== i) }))}
                  disabled={oForm.items.length <= 1}
                  className="text-gray-400 hover:text-red-500 disabled:opacity-30 transition-colors mt-2"
                >
                  <XIcon size={14} />
                </button>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setOForm(f => ({ ...f, items: [...f.items, { productName: '', brand: '', sizeML: '100', quantity: '1', unitPriceUSD: '' }] }))}>
              + Agregar línea
            </Button>
          </div>

          {oForm.items.some(i => i.unitPriceUSD) && (
            <div className="bg-violet-50 rounded-lg p-3 text-sm">
              <span className="text-gray-500">Total estimado: </span>
              {oForm.localCurrency ? (
                <span className="font-bold text-violet-700">
                  {fmtPYG(oForm.items.reduce((s, i) => s + (parseFloat(i.unitPriceUSD) || 0) * (parseInt(i.quantity) || 0), 0))}
                </span>
              ) : (
                <>
                  <span className="font-bold text-violet-700">
                    {fmtUSD(oForm.items.reduce((s, i) => s + (parseFloat(i.unitPriceUSD) || 0) * (parseInt(i.quantity) || 0), 0))}
                  </span>
                  <span className="text-gray-400 ml-2">
                    = {fmtPYG(oForm.items.reduce((s, i) => s + (parseFloat(i.unitPriceUSD) || 0) * (parseInt(i.quantity) || 0), 0) * parseFloat(oForm.exchangeRate))}
                  </span>
                </>
              )}
            </div>
          )}

          <Textarea label="Notas (opcional)" value={oForm.notes} onChange={e => setOForm(f => ({ ...f, notes: e.target.value }))} rows={2} />

          <div className="border-t border-gray-100 pt-4 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => setOForm(f => ({ ...f, registerPayment: !f.registerPayment, paymentAccountId: f.paymentAccountId || (accounts[0] ? String(accounts[0].id) : '') }))}
                className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${oForm.registerPayment ? 'bg-violet-600' : 'bg-gray-200'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${oForm.registerPayment ? 'translate-x-5' : ''}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Registrar pago anticipado al proveedor</p>
                {oForm.registerPayment && <p className="text-xs text-violet-600">Se descontará el total de productos de la cuenta seleccionada.</p>}
              </div>
            </label>
            {oForm.registerPayment && (
              <Select
                label="Cuenta de débito"
                value={oForm.paymentAccountId}
                onChange={e => setOForm(f => ({ ...f, paymentAccountId: e.target.value }))}
                options={[{ value: '', label: 'Seleccionar...' }, ...accounts.map(a => ({ value: String(a.id), label: `${a.name} (${fmtPYG(a.balance)})` }))]}
              />
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowOrder(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleCreateOrder} disabled={oForm.registerPayment && !oForm.paymentAccountId}>Crear pedido</Button>
          </div>
        </div>
      </Modal>

      {/* Modal recibir pedido */}
      {receivingOrder && (
        <Modal isOpen={showReceive} onClose={() => setShowReceive(false)} title="Recibir pedido">
          <div className="space-y-4">
            {/* Resumen */}
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-800">{suppliers.find(s => s.id === receivingOrder.supplierId)?.name}</p>
                {receivingOrder.localCurrency && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">Compra local Gs.</span>}
              </div>
              <p className="text-gray-500 mt-0.5">
                {receivingOrder.items.length} producto(s) · {receivingOrder.localCurrency ? fmtPYG(receivingOrder.totalPYG) : `${fmtUSD(receivingOrder.totalUSD)} · TC ${fmtPYG(receivingOrder.exchangeRate)}`}
              </p>
            </div>

            {/* Vista previa de ítems */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Productos a ingresar</p>
              <div className="space-y-1.5">
                {receivingOrder.items.map((item, i) => {
                  const matched = products.find(
                    p => p.name.toLowerCase() === item.productName.toLowerCase() &&
                         p.brand.toLowerCase() === item.brand.toLowerCase()
                  )
                  return (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{item.brand} — {item.productName} {item.sizeML}ml ×{item.quantity}
                        {receivingOrder.localCurrency && <span className="text-gray-400 ml-1">· {fmtPYG(item.unitPriceUSD)}/u.</span>}
                      </span>
                      {matched ? (
                        <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full ml-3 shrink-0">
                          {matched.type === 'decant_source' ? 'Suma ML al stock' : 'Suma unidades al stock'}
                        </span>
                      ) : (
                        <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full ml-3 shrink-0">
                          Producto nuevo
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Fecha de recepción"
                type="date"
                value={receiveDate}
                onChange={e => setReceiveDate(e.target.value)}
              />
              <Input
                label="Costo de envío (Gs.)"
                type="number"
                value={receiveShipping}
                onChange={e => setReceiveShipping(e.target.value)}
                placeholder="0"
              />
            </div>

            {parseFloat(receiveShipping) > 0 && (
              <p className="text-xs text-gray-400 -mt-2">
                El envío se distribuye proporcionalmente entre los productos por valor USD y se suma al CPP de cada uno.
              </p>
            )}

            {/* Total */}
            <div className="bg-violet-50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between text-gray-600">
                <span>Productos</span>
                <div className="flex items-center gap-2">
                  <span>{fmtPYG(receivingOrder.totalPYG)}</span>
                  {(receivingOrder.prepaidAmount ?? 0) > 0 && (
                    <span className="text-xs text-green-600 font-semibold bg-green-50 px-1.5 py-0.5 rounded-full">Prepagado</span>
                  )}
                </div>
              </div>
              {parseFloat(receiveShipping) > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Envío</span>
                  <span>{fmtPYG(parseFloat(receiveShipping))}</span>
                </div>
              )}
              <div className="flex justify-between font-bold pt-1 border-t border-violet-200 text-violet-700">
                <span>{(receivingOrder.prepaidAmount ?? 0) > 0 ? 'Pendiente de pago' : 'Total'}</span>
                <span>
                  {(receivingOrder.prepaidAmount ?? 0) > 0
                    ? fmtPYG(parseFloat(receiveShipping) || 0)
                    : fmtPYG(receivingOrder.totalPYG + (parseFloat(receiveShipping) || 0))}
                </span>
              </div>
            </div>

            {/* Opción de pago */}
            {(receivingOrder.prepaidAmount ?? 0) > 0 ? (
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-sm text-green-700">
                  Productos pagados por adelantado: <span className="font-semibold">{fmtPYG(receivingOrder.prepaidAmount!)}</span>
                </div>
                {parseFloat(receiveShipping) > 0 && (
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
                      <input type="checkbox" checked={receiveRegisterPayment} onChange={e => setReceiveRegisterPayment(e.target.checked)} className="rounded border-gray-300" />
                      <span className="text-gray-700">Registrar pago de envío ({fmtPYG(parseFloat(receiveShipping))})</span>
                    </label>
                    {receiveRegisterPayment && (
                      <Select className="mt-3" label="Cuenta de débito" value={receiveAccountId} onChange={e => setReceiveAccountId(e.target.value)}
                        options={accounts.map(a => ({ value: String(a.id), label: `${a.name} (${fmtPYG(a.balance)})` }))} />
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
                  <input type="checkbox" checked={receiveRegisterPayment} onChange={e => setReceiveRegisterPayment(e.target.checked)} className="rounded border-gray-300" />
                  <span className="text-gray-700">Registrar pago en finanzas</span>
                </label>
                {receiveRegisterPayment && (
                  <Select className="mt-3" label="Cuenta de débito" value={receiveAccountId} onChange={e => setReceiveAccountId(e.target.value)}
                    options={accounts.map(a => ({ value: String(a.id), label: `${a.name} (${fmtPYG(a.balance)})` }))} />
                )}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="secondary" className="flex-1" onClick={() => setShowReceive(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleReceiveOrder}>Confirmar recepción</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal pago anticipado standalone */}
      <Modal isOpen={showPayOrder} onClose={() => { setShowPayOrder(false); setPayingOrder(null) }} title="Registrar pago anticipado">
        {payingOrder && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Proveedor</span>
                <span className="font-medium text-gray-900">{suppliers.find(s => s.id === payingOrder.supplierId)?.name ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total a pagar</span>
                <span className="font-bold text-gray-900">{fmtPYG(payingOrder.totalPYG)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Productos</span>
                <span className="text-gray-600">{payingOrder.items.length} ítem(s)</span>
              </div>
            </div>
            <Select
              label="Cuenta de débito"
              value={payOrderAccountId}
              onChange={e => setPayOrderAccountId(e.target.value)}
              options={[{ value: '', label: 'Seleccionar...' }, ...accounts.map(a => ({ value: String(a.id), label: `${a.name} (${fmtPYG(a.balance)})` }))]}
            />
            <div className="flex gap-2 pt-2">
              <Button variant="secondary" className="flex-1" onClick={() => { setShowPayOrder(false); setPayingOrder(null) }}>Cancelar</Button>
              <Button className="flex-1" onClick={handlePayOrder} disabled={!payOrderAccountId}>Registrar pago</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal editar pedido recibido */}
      <Modal isOpen={!!editOrder} onClose={() => setEditOrder(null)} title="Editar pedido recibido" size="lg">
        {editOrder && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              Los cambios actualizarán los costos de stock, el CPP de cada producto y el movimiento en Contabilidad.
            </div>

            {!editOrder.localCurrency && (
              <Input
                label="Cotización USD/PYG"
                type="number"
                value={editOrderForm.exchangeRate}
                onChange={e => setEditOrderForm(f => ({ ...f, exchangeRate: e.target.value }))}
              />
            )}
            <Input
              label="Costo de envío (Gs.)"
              type="number"
              value={editOrderForm.shippingTotal}
              onChange={e => setEditOrderForm(f => ({ ...f, shippingTotal: e.target.value }))}
            />

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Precios por producto</p>
              <div className="space-y-2">
                {editOrderForm.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.brand} — {item.productName}</p>
                      <p className="text-xs text-gray-400">{item.sizeML}ml · ×{item.quantity}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number"
                        className="w-24 text-right text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
                        value={item.unitPriceUSD}
                        onChange={e => setEditOrderForm(f => ({
                          ...f,
                          items: f.items.map((x, j) => j === i ? { ...x, unitPriceUSD: e.target.value } : x),
                        }))}
                      />
                      <span className="text-xs text-gray-400">{editOrder.localCurrency ? 'Gs.' : 'USD'} /u.</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview del nuevo total */}
            {(() => {
              const rate = editOrder.localCurrency ? 1 : (parseFloat(editOrderForm.exchangeRate) || 7500)
              const shipping = parseFloat(editOrderForm.shippingTotal) || 0
              const newTotalUSD = editOrderForm.items.reduce((s, i) => s + (parseFloat(i.unitPriceUSD) || 0) * i.quantity, 0)
              const newTotalPYG = Math.round(newTotalUSD * rate + shipping)
              const oldTotalPYG = editOrder.totalPYG + (editOrder.shippingTotalPYG ?? 0)
              const delta = newTotalPYG - oldTotalPYG
              return (
                <div className="bg-gray-50 rounded-lg px-4 py-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Nuevo total</span>
                    <span className="font-bold text-gray-900">{fmtPYG(newTotalPYG)}</span>
                  </div>
                  {Math.abs(delta) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Diferencia vs. registrado</span>
                      <span className={`font-semibold ${delta > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {delta > 0 ? '+' : ''}{fmtPYG(delta)}
                      </span>
                    </div>
                  )}
                </div>
              )
            })()}

            <div className="flex gap-2 pt-2">
              <Button variant="secondary" className="flex-1" onClick={() => setEditOrder(null)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleEditReceivedOrder}>Guardar cambios</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
