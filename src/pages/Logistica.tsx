import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, MapPin, Package, Check, Clock, Truck, X as XIcon, Edit2, Trash2, AlertTriangle } from 'lucide-react'
import { db } from '../db/db'
import type { LocalOrderStatus, PaymentMethod, Supply, AdvancePayment } from '../db/types'
import { fmtPYG, fmtDate, today, nowISO } from '../lib/format'
import { upsertCustomer } from '../lib/customers'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Card, CardBody } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Input, Select, Textarea } from '../components/ui/Input'
import { CustomerAutocomplete } from '../components/ui/CustomerAutocomplete'
import { Badge } from '../components/ui/Badge'

const statusColors: Record<LocalOrderStatus, 'yellow' | 'blue' | 'green' | 'gray' | 'red'> = {
  pending: 'yellow', preparing: 'blue', ready: 'violet' as any, delivered: 'green', cancelled: 'red',
}
const statusLabels: Record<LocalOrderStatus, string> = {
  pending: 'Pendiente', preparing: 'En preparación', ready: 'Listo', delivered: 'Entregado', cancelled: 'Cancelado',
}
const statusIcons: Record<LocalOrderStatus, typeof Clock> = {
  pending: Clock, preparing: Package, ready: Check, delivered: Truck, cancelled: XIcon,
}

const statusFlow: LocalOrderStatus[] = ['pending', 'preparing', 'ready', 'delivered']

function findSupplyForSize(supplyList: Supply[], sizeML: number): Supply | undefined {
  return supplyList.find(s => s.sizeML === sizeML)
    ?? supplyList.find(s => (s.type as string) === `${sizeML}ml`)
}

export function Logistica() {
  const products = useLiveQuery(() => db.products.toArray()) ?? []
  const supplies = useLiveQuery(() => db.supplies.toArray()) ?? []
  const orders = useLiveQuery(() => db.localOrders.orderBy('orderDate').reverse().toArray()) ?? []
  const accounts = useLiveQuery(() => db.accounts.filter(a => a.isActive !== false).toArray()) ?? []
  const customers = useLiveQuery(() => db.customers.orderBy('name').toArray()) ?? []

  const [filterStatus, setFilterStatus] = useState<LocalOrderStatus | 'all'>('all')
  const [showNew, setShowNew] = useState(false)
  const [showDetail, setShowDetail] = useState<number | null>(null)

  // Payment modal (triggered when delivering an order)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [pendingDeliveryId, setPendingDeliveryId] = useState<number | null>(null)
  const [payAccountId, setPayAccountId] = useState('')
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash')

  const [editOrderId, setEditOrderId] = useState<number | null>(null)
  const [supplyErrors, setSupplyErrors] = useState<string[]>([])
  const [prepErrors, setPrepErrors] = useState<string[]>([])

  // Seña (pago parcial anticipado)
  const [showSeña, setShowSeña] = useState(false)
  const [señaOrderId, setSeñaOrderId] = useState<number | null>(null)
  const [señaForm, setSeñaForm] = useState({ amount: '', method: 'cash' as PaymentMethod, accountId: '', date: today(), notes: '' })

  const emptyForm = {
    customerName: '', customerPhone: '', customerAddress: '',
    shippingCost: '0', shippingPaidBy: 'customer' as 'customer' | 'business',
    orderDate: today(), estimatedDelivery: '', notes: '',
    isPreOrder: false,
    items: [{ productId: '0', type: 'sealed' as 'sealed' | 'decant' | 'partial', sizeML: '5', quantity: '1', unitPrice: '' }],
    supplies: [] as { supplyId: string; quantity: string }[],
  }

  const [form, setForm] = useState(emptyForm)

  const filtered = orders.filter(o => filterStatus === 'all' || o.status === filterStatus)

  const pending = orders.filter(o => o.status === 'pending').length
  const preparing = orders.filter(o => o.status === 'preparing').length
  const ready = orders.filter(o => o.status === 'ready').length

  function openNewOrder() {
    setEditOrderId(null)
    setForm(emptyForm)
    setSupplyErrors([])
    setShowNew(true)
  }

  function openEditOrder(order: typeof orders[0]) {
    setEditOrderId(order.id!)
    setForm({
      customerName: order.customerName, customerPhone: order.customerPhone ?? '',
      customerAddress: order.customerAddress ?? '',
      shippingCost: String(order.shippingCost), shippingPaidBy: order.shippingPaidBy,
      orderDate: order.orderDate, estimatedDelivery: order.estimatedDelivery ?? '',
      notes: order.notes ?? '',
      isPreOrder: order.isPreOrder ?? false,
      items: order.items.map(i => ({
        productId: String(i.productId), type: i.type,
        sizeML: String(i.sizeML ?? 5), quantity: String(i.quantity), unitPrice: String(i.unitPrice),
      })),
      supplies: order.supplies.map(s => ({ supplyId: String(s.supplyId), quantity: String(s.quantity) })),
    })
    setSupplyErrors([])
    setShowNew(true)
  }

  function validateForPreparation(order: typeof orders[0]): string[] {
    const errors: string[] = []
    for (const item of order.items) {
      const product = products.find(p => p.id === item.productId)
      if (!product) continue
      if (item.type === 'sealed') {
        if (product.stockSealed < item.quantity) {
          errors.push(`${product.brand} — ${product.name}: stock insuficiente (${product.stockSealed} disponibles, se necesitan ${item.quantity})`)
        }
      } else if (item.type === 'decant' && item.sizeML) {
        const mlNeeded = item.quantity * item.sizeML
        if (product.stockOpenML < mlNeeded) {
          errors.push(`${product.brand} — ${product.name}: ML insuficientes (${product.stockOpenML}ml disponibles, se necesitan ${mlNeeded}ml)`)
        }
        const supply = findSupplyForSize(supplies, item.sizeML)
        if (!supply) {
          errors.push(`No hay frasco registrado para decants de ${item.sizeML}ml`)
        } else if (supply.stock < item.quantity) {
          errors.push(`Frascos ${item.sizeML}ml: stock insuficiente (${supply.stock} disponibles, se necesitan ${item.quantity})`)
        }
      } else if (item.type === 'partial' && item.sizeML) {
        const mlNeeded = item.quantity * item.sizeML
        if (product.stockOpenML < mlNeeded) {
          errors.push(`${product.brand} — ${product.name}: ML insuficientes para venta parcial (${product.stockOpenML}ml disponibles, se necesitan ${mlNeeded}ml)`)
        }
      }
    }
    return errors
  }

  function validateSupplies(validItems: typeof form.items): string[] {
    const errors: string[] = []
    for (const item of validItems) {
      if (item.type === 'decant') {
        const sizeML = parseInt(item.sizeML)
        const qty = parseInt(item.quantity) || 1
        const supply = findSupplyForSize(supplies, sizeML)
        if (!supply) {
          errors.push(`No hay insumo registrado para frascos de ${sizeML}ml`)
        } else if (supply.stock < qty) {
          errors.push(`Frascos ${sizeML}ml: stock insuficiente (${supply.stock} disponibles, se necesitan ${qty})`)
        }
      }
    }
    return errors
  }

  async function handleCreate() {
    if (!form.customerName.trim()) return
    const validItems = form.items.filter(i => i.productId !== '0' && i.unitPrice)
    if (!validItems.length) return

    if (!form.isPreOrder) {
      const errors = validateSupplies(validItems)
      if (errors.length > 0) { setSupplyErrors(errors); return }
    }
    setSupplyErrors([])

    const now = nowISO()
    const totalAmount = validItems.reduce((s, i) => s + parseFloat(i.unitPrice) * parseInt(i.quantity), 0)
    const supplyItems = form.supplies.filter(s => s.supplyId && s.quantity)
    const supplyCost = supplyItems.reduce((s, si) => {
      const sup = supplies.find(x => String(x.id) === si.supplyId)
      return s + (sup?.costPYG ?? 0) * parseInt(si.quantity)
    }, 0)
    const shipping = parseFloat(form.shippingCost) || 0
    const totalCost = supplyCost + (form.shippingPaidBy === 'business' ? shipping : 0)
    const orderData = {
      customerName: form.customerName, customerPhone: form.customerPhone, customerAddress: form.customerAddress,
      items: validItems.map(i => ({
        productId: parseInt(i.productId), type: i.type,
        sizeML: (i.type === 'decant' || i.type === 'partial') ? parseInt(i.sizeML) : undefined,
        quantity: parseInt(i.quantity), unitPrice: parseFloat(i.unitPrice),
      })),
      supplies: supplyItems.map(si => {
        const sup = supplies.find(x => String(x.id) === si.supplyId)!
        return { supplyId: parseInt(si.supplyId), quantity: parseInt(si.quantity), unitCost: sup?.costPYG ?? 0 }
      }),
      shippingCost: shipping, shippingPaidBy: form.shippingPaidBy,
      totalAmount, totalCost,
      isPreOrder: form.isPreOrder || undefined,
      orderDate: form.orderDate, estimatedDelivery: form.estimatedDelivery || undefined,
      notes: form.notes, updatedAt: now,
    }

    const customerId = await upsertCustomer(form.customerName, form.customerPhone, form.customerAddress)
    if (editOrderId) {
      await db.localOrders.update(editOrderId, { ...orderData, customerId })
    } else {
      await db.localOrders.add({ ...orderData, customerId, status: 'pending', createdAt: now })
    }

    setForm(emptyForm)
    setEditOrderId(null)
    setShowNew(false)
  }

  function openSeña(orderId: number) {
    setSeñaOrderId(orderId)
    setSeñaForm({ amount: '', method: 'cash', accountId: accounts[0] ? String(accounts[0].id) : '', date: today(), notes: '' })
    setShowSeña(true)
  }

  async function handleAddSeña() {
    if (!señaOrderId || !señaForm.amount || !señaForm.accountId) return
    const order = orders.find(o => o.id === señaOrderId)
    if (!order) return
    const amount = parseFloat(señaForm.amount)
    if (!amount || amount <= 0) return
    const now = nowISO()
    const newSeña: AdvancePayment = { amount, date: señaForm.date, method: señaForm.method, accountId: parseInt(señaForm.accountId), notes: señaForm.notes || undefined }
    const updatedSeñas = [...(order.advancePayments ?? []), newSeña]
    await db.transaction('rw', [db.localOrders, db.accounts, db.movements], async () => {
      await db.movements.add({
        type: 'income', category: 'sale',
        amount,
        accountId: parseInt(señaForm.accountId),
        description: `Seña — ${order.customerName}`,
        referenceId: señaOrderId!, referenceType: 'local_order',
        date: señaForm.date, createdAt: now,
      })
      await db.accounts.where('id').equals(parseInt(señaForm.accountId)).modify(a => { a.balance += amount })
      await db.localOrders.update(señaOrderId!, { advancePayments: updatedSeñas, updatedAt: now })
    })
    setShowSeña(false)
    setSeñaOrderId(null)
  }

  async function handleDeleteOrder(order: typeof orders[0]) {
    const now = nowISO()

    if (order.status === 'pending') {
      const hasSeñas = (order.advancePayments?.length ?? 0) > 0
      const msg = hasSeñas
        ? `Este pedido tiene señas registradas (${fmtPYG(order.advancePayments!.reduce((s, p) => s + p.amount, 0))}). ¿Eliminar y revertir los cobros?`
        : `¿Eliminar el pedido de ${order.customerName}?`
      if (!confirm(msg)) return
      await db.transaction('rw', [db.localOrders, db.accounts, db.movements, db.budgets], async () => {
        for (const seña of order.advancePayments ?? []) {
          await db.accounts.where('id').equals(seña.accountId).modify(a => { a.balance -= seña.amount })
        }
        const movs = await db.movements.where('referenceId').equals(order.id!).filter(m => m.referenceType === 'local_order').toArray()
        for (const m of movs) if (m.id) await db.movements.delete(m.id)
        await db.localOrders.delete(order.id!)
        if (order.budgetId) {
          await db.budgets.update(order.budgetId, { localOrderId: undefined, updatedAt: nowISO() })
        }
      })
      setShowDetail(null)
      return
    }

    if (order.status === 'preparing' || order.status === 'ready') {
      if (!confirm('¿Revertir a Pendiente? El stock preparado será restaurado y la producción de decants eliminada. El pedido quedará en estado Pendiente.')) return
      await db.transaction('rw', [db.localOrders, db.products, db.stockEntries, db.supplies, db.decantBatches], async () => {
        for (const item of order.items) {
          const product = await db.products.get(item.productId)
          if (!product) continue
          if (item.type === 'decant' && item.sizeML) {
            const mlToRestore = item.quantity * item.sizeML
            await db.products.update(item.productId, { stockOpenML: product.stockOpenML + mlToRestore })
            const lots = (await db.stockEntries.where('productId').equals(item.productId).toArray())
              .filter(l => l.quantityRemaining !== undefined).sort((a, b) => b.date.localeCompare(a.date))
            let left = mlToRestore
            for (const lot of lots) {
              if (left <= 0) break
              const deducted = lot.quantity - lot.quantityRemaining!
              if (deducted <= 0) continue
              const restore = Math.min(deducted, left)
              await db.stockEntries.update(lot.id!, { quantityRemaining: lot.quantityRemaining! + restore })
              left -= restore
            }
            const supply = await db.supplies.where('sizeML').equals(item.sizeML).first()
            if (supply?.id) await db.supplies.update(supply.id, { stock: supply.stock + item.quantity, updatedAt: now })
          } else if (item.type === 'partial' && item.sizeML) {
            const mlToRestore = item.quantity * item.sizeML
            await db.products.update(item.productId, { stockOpenML: product.stockOpenML + mlToRestore })
            const lots = (await db.stockEntries.where('productId').equals(item.productId).toArray())
              .filter(l => l.quantityRemaining !== undefined).sort((a, b) => b.date.localeCompare(a.date))
            let left = mlToRestore
            for (const lot of lots) {
              if (left <= 0) break
              const deducted = lot.quantity - lot.quantityRemaining!
              if (deducted <= 0) continue
              const restore = Math.min(deducted, left)
              await db.stockEntries.update(lot.id!, { quantityRemaining: lot.quantityRemaining! + restore })
              left -= restore
            }
          } else if (item.type === 'sealed') {
            await db.products.update(item.productId, { stockSealed: product.stockSealed + item.quantity })
            const lots = (await db.stockEntries.where('productId').equals(item.productId).toArray())
              .filter(l => l.quantityRemaining !== undefined).sort((a, b) => b.date.localeCompare(a.date))
            let left = item.quantity
            for (const lot of lots) {
              if (left <= 0) break
              const deducted = lot.quantity - lot.quantityRemaining!
              if (deducted <= 0) continue
              const restore = Math.min(deducted, left)
              await db.stockEntries.update(lot.id!, { quantityRemaining: lot.quantityRemaining! + restore })
              left -= restore
            }
          }
        }
        for (const si of order.supplies) {
          const sup = await db.supplies.get(si.supplyId)
          if (sup?.id) await db.supplies.update(sup.id, { stock: sup.stock + si.quantity, updatedAt: now })
        }
        await db.decantBatches.where('sourceId').equals(order.id!).filter(b => b.sourceType === 'local_order').delete()
        await db.localOrders.update(order.id!, { status: 'pending', updatedAt: now })
      })
      setShowDetail(null)
      return
    }

    if (order.status === 'delivered') {
      if (!confirm('¿Anular la entrega? El cobro será revertido y el pedido volverá a estado Listo.\nPara cancelar completamente el pedido, hacelo desde Ventas.')) return
      const movement = await db.movements.where('referenceId').equals(order.id!).filter(m => m.referenceType === 'local_order').first()
      const linkedSale = await db.sales.where('referenceId').equals(order.id!).first()
      await db.transaction('rw', [db.localOrders, db.accounts, db.movements, db.sales, db.saleItems], async () => {
        if (movement?.id) {
          await db.accounts.where('id').equals(movement.accountId).modify(a => { a.balance -= movement.amount })
          await db.movements.delete(movement.id)
        }
        if (linkedSale?.id) {
          await db.saleItems.where('saleId').equals(linkedSale.id!).delete()
          await db.sales.delete(linkedSale.id!)
        }
        await db.localOrders.update(order.id!, { status: 'ready', updatedAt: now })
      })
      setShowDetail(null)
      return
    }
  }

  async function advanceStatus(id: number, current: LocalOrderStatus) {
    const idx = statusFlow.indexOf(current)
    if (idx < 0 || idx >= statusFlow.length - 1) return
    const next = statusFlow[idx + 1]

    if (next === 'preparing') {
      const order = orders.find(o => o.id === id)
      if (!order) return

      const errors = validateForPreparation(order)
      if (errors.length > 0) { setPrepErrors(errors); return }

      const now = nowISO()
      await db.transaction('rw', [db.localOrders, db.products, db.stockEntries, db.supplies, db.decantBatches], async () => {
        for (const item of order.items) {
          const product = await db.products.get(item.productId)
          if (!product) continue
          if (item.type === 'decant' && item.sizeML) {
            const sizeML = item.sizeML
            const mlToDeduct = item.quantity * sizeML
            await db.products.update(item.productId, { stockOpenML: Math.max(0, product.stockOpenML - mlToDeduct) })
            let mlLeft = mlToDeduct
            const lots = (await db.stockEntries.where('productId').equals(item.productId).toArray())
              .sort((a, b) => a.date.localeCompare(b.date))
            for (const lot of lots) {
              if (mlLeft <= 0) break
              const avail = lot.quantityRemaining !== undefined ? lot.quantityRemaining : lot.quantity
              if (avail <= 0) continue
              const deduct = Math.min(avail, mlLeft)
              await db.stockEntries.update(lot.id!, { quantityRemaining: avail - deduct })
              mlLeft -= deduct
            }
            let supply = await db.supplies.where('sizeML').equals(sizeML).first()
            if (!supply) supply = await db.supplies.filter(s => (s.type as string) === `${sizeML}ml`).first()
            if (supply?.id) await db.supplies.update(supply.id, { stock: Math.max(0, supply.stock - item.quantity), updatedAt: now })
            const cpm = product.type === 'decant_source' ? product.costPYG : product.costPYG / product.sizeML
            await db.decantBatches.add({
              productId: item.productId, sizeML, quantity: item.quantity,
              supplyId: supply?.id ?? 0,
              costPerDecant: cpm * sizeML + (supply?.costPYG ?? 0),
              sellingPricePYG: item.unitPrice,
              mlUsed: mlToDeduct, stockRemaining: 0,
              date: order.orderDate,
              notes: `Pedido — ${order.customerName}`,
              sourceType: 'local_order', sourceId: id,
              createdAt: now,
            })
          } else if (item.type === 'partial' && item.sizeML) {
            const sizeML = item.sizeML
            const mlToDeduct = item.quantity * sizeML
            await db.products.update(item.productId, { stockOpenML: Math.max(0, product.stockOpenML - mlToDeduct) })
            let mlLeft = mlToDeduct
            const lots = (await db.stockEntries.where('productId').equals(item.productId).toArray())
              .sort((a, b) => a.date.localeCompare(b.date))
            for (const lot of lots) {
              if (mlLeft <= 0) break
              const avail = lot.quantityRemaining !== undefined ? lot.quantityRemaining : lot.quantity
              if (avail <= 0) continue
              const deduct = Math.min(avail, mlLeft)
              await db.stockEntries.update(lot.id!, { quantityRemaining: avail - deduct })
              mlLeft -= deduct
            }
            const cpm = product.type === 'decant_source' ? product.costPYG : product.costPYG / product.sizeML
            await db.decantBatches.add({
              productId: item.productId, sizeML, quantity: item.quantity,
              supplyId: 0,
              costPerDecant: cpm * sizeML,
              sellingPricePYG: item.unitPrice,
              mlUsed: mlToDeduct, stockRemaining: 0,
              date: order.orderDate,
              notes: `Venta parcial — ${order.customerName}`,
              sourceType: 'local_order', sourceId: id,
              createdAt: now,
            })
          } else if (item.type === 'sealed') {
            await db.products.update(item.productId, { stockSealed: Math.max(0, product.stockSealed - item.quantity) })
            let toDeduct = item.quantity
            const lots = (await db.stockEntries.where('productId').equals(item.productId).toArray())
              .sort((a, b) => a.date.localeCompare(b.date))
            for (const lot of lots) {
              if (toDeduct <= 0) break
              const avail = lot.quantityRemaining !== undefined ? lot.quantityRemaining : lot.quantity
              if (avail <= 0) continue
              const deduct = Math.min(avail, toDeduct)
              await db.stockEntries.update(lot.id!, { quantityRemaining: avail - deduct })
              toDeduct -= deduct
            }
          }
        }
        for (const si of order.supplies) {
          const sup = await db.supplies.get(si.supplyId)
          if (sup?.id) await db.supplies.update(sup.id, { stock: Math.max(0, sup.stock - si.quantity), updatedAt: now })
        }
        await db.localOrders.update(id, { status: 'preparing', updatedAt: now })
      })
    } else if (next === 'delivered') {
      setPendingDeliveryId(id)
      setPayAccountId('')
      setPayMethod('cash')
      setShowPaymentModal(true)
    } else {
      await db.localOrders.update(id, { status: next, updatedAt: nowISO() })
    }
  }

  async function handleDeliveryPayment() {
    if (!pendingDeliveryId) return
    const order = orders.find(o => o.id === pendingDeliveryId)
    if (!order) return
    const señaTotalCheck = (order.advancePayments ?? []).reduce((s, p) => s + p.amount, 0)
    const saldoCheck = Math.max(0, order.totalAmount - señaTotalCheck)
    if (saldoCheck > 0 && !payAccountId) return
    const now = nowISO()

    // Pre-calcular costos antes de la transacción
    const batches = (await db.decantBatches.where('sourceId').equals(pendingDeliveryId).toArray())
      .filter(b => b.sourceType === 'local_order')
    const itemCosts: number[] = []
    for (const item of order.items) {
      let unitCost = 0
      if (item.type === 'sealed') {
        const product = await db.products.get(item.productId)
        unitCost = product?.costPYG ?? 0
      } else if ((item.type === 'decant' || item.type === 'partial') && item.sizeML) {
        const batch = batches.find(b => b.productId === item.productId && b.sizeML === item.sizeML)
        unitCost = batch?.costPerDecant ?? 0
      }
      itemCosts.push(unitCost)
    }
    const totalCost = order.items.reduce((s, item, i) => s + itemCosts[i] * item.quantity, 0)
    const totalProfit = order.totalAmount - totalCost

    const señaTotal = (order.advancePayments ?? []).reduce((s, p) => s + p.amount, 0)
    const saldo = Math.max(0, order.totalAmount - señaTotal)

    await db.transaction('rw', [db.localOrders, db.accounts, db.movements, db.sales, db.saleItems], async () => {
      const saleId = await db.sales.add({
        items: [],
        totalAmount: order.totalAmount,
        totalCost,
        totalProfit,
        paymentMethod: payMethod,
        accountId: parseInt(payAccountId),
        customerId: order.customerId,
        customerName: order.customerName,
        referenceType: 'local_order',
        referenceId: pendingDeliveryId!,
        date: today(),
        notes: order.notes,
        createdAt: now,
      })
      for (let i = 0; i < order.items.length; i++) {
        const item = order.items[i]
        const unitCost = itemCosts[i]
        await db.saleItems.add({
          saleId: saleId as number,
          productId: item.productId,
          type: item.type,
          sizeML: item.sizeML,
          quantity: item.quantity,
          unitCost,
          unitPrice: item.unitPrice,
          profit: (item.unitPrice - unitCost) * item.quantity,
        })
      }
      if (saldo > 0) {
        await db.movements.add({
          type: 'income', category: 'sale',
          amount: saldo,
          accountId: parseInt(payAccountId),
          description: `Entrega — ${order.customerName}${señaTotal > 0 ? ` (saldo, seña: ${fmtPYG(señaTotal)})` : ''}`,
          referenceId: pendingDeliveryId!, referenceType: 'local_order',
          date: today(), createdAt: now,
        })
        await db.accounts.where('id').equals(parseInt(payAccountId)).modify(a => { a.balance += saldo })
      }
      await db.localOrders.update(pendingDeliveryId!, { status: 'delivered', updatedAt: now })
    })
    setShowPaymentModal(false)
    setPendingDeliveryId(null)
    setShowDetail(null)
  }

  const selectedOrder = orders.find(o => o.id === showDetail)

  return (
    <div>
      <PageHeader
        title="Logística"
        subtitle="Pedidos locales, preparación y entregas"
        action={<Button icon={<Plus size={15} />} onClick={openNewOrder}>Nuevo pedido</Button>}
      />

      {/* Estado rápido */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-yellow-700">{pending}</p>
          <p className="text-sm text-yellow-600">Pendientes</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{preparing}</p>
          <p className="text-sm text-blue-600">En preparación</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{ready}</p>
          <p className="text-sm text-green-600">Listos para entregar</p>
        </div>
      </div>

      {/* Filtro estado */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['all', ...statusFlow] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-sm cursor-pointer transition-colors ${filterStatus === s ? 'bg-violet-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {s === 'all' ? 'Todos' : statusLabels[s]}
          </button>
        ))}
      </div>

      {/* Lista pedidos */}
      {filtered.length === 0 ? (
        <Card><CardBody className="text-center py-12">
          <MapPin size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400">No hay pedidos con este estado</p>
        </CardBody></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(o => {
            const StatusIcon = statusIcons[o.status]
            const canAdvance = statusFlow.indexOf(o.status) < statusFlow.length - 1
            return (
              <Card key={o.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowDetail(o.id!)}>
                <CardBody>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${o.status === 'pending' ? 'bg-yellow-50' : o.status === 'preparing' ? 'bg-blue-50' : o.status === 'ready' ? 'bg-violet-50' : o.status === 'delivered' ? 'bg-green-50' : 'bg-gray-50'}`}>
                        <StatusIcon size={18} className={o.status === 'pending' ? 'text-yellow-600' : o.status === 'preparing' ? 'text-blue-600' : o.status === 'ready' ? 'text-violet-600' : o.status === 'delivered' ? 'text-green-600' : 'text-gray-400'} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900">{o.customerName}</p>
                          {o.isPreOrder && <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">Pre-pedido</span>}
                          {o.budgetId && <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">Pres. #{String(o.budgetId).padStart(4, '0')}</span>}
                          {(o.advancePayments?.length ?? 0) > 0 && (
                            <span className="text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-medium">
                              Seña {fmtPYG(o.advancePayments!.reduce((s, p) => s + p.amount, 0))}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">{fmtDate(o.orderDate)} {o.customerPhone && `· ${o.customerPhone}`}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">{fmtPYG(o.totalAmount)}</p>
                        <Badge color={statusColors[o.status]}>{statusLabels[o.status]}</Badge>
                      </div>
                      {o.status !== 'delivered' && o.status !== 'cancelled' && (
                        <button
                          onClick={e => { e.stopPropagation(); openSeña(o.id!) }}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-violet-500 hover:bg-violet-50 transition-colors"
                          title="Registrar seña"
                        >
                          <span className="text-xs font-bold">$½</span>
                        </button>
                      )}
                      {canAdvance && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={e => { e.stopPropagation(); advanceStatus(o.id!, o.status) }}
                        >
                          {o.status === 'pending' ? 'Preparar' : o.status === 'preparing' ? 'Listo' : 'Entregar'}
                        </Button>
                      )}
                    </div>
                  </div>
                  {o.customerAddress && (
                    <p className="text-sm text-gray-400 mt-2 flex items-center gap-1">
                      <MapPin size={12} /> {o.customerAddress}
                    </p>
                  )}
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal nuevo pedido */}
      <Modal isOpen={showNew} onClose={() => setShowNew(false)} title={editOrderId ? 'Editar pedido' : 'Nuevo pedido'} size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <CustomerAutocomplete
              label="Nombre del cliente"
              value={form.customerName}
              onChange={v => setForm(f => ({ ...f, customerName: v }))}
              onSelect={c => setForm(f => ({ ...f, customerName: c.name, customerPhone: c.phone ?? f.customerPhone, customerAddress: c.address ?? f.customerAddress }))}
              customers={customers}
            />
            <Input label="Teléfono" value={form.customerPhone} onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))} />
            <Input label="Dirección" value={form.customerAddress} onChange={e => setForm(f => ({ ...f, customerAddress: e.target.value }))} />
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Productos</p>
            {form.items.map((item, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <div className="grid grid-cols-5 gap-2 flex-1">
                  <Select value={item.productId} onChange={e => setForm(f => ({ ...f, items: f.items.map((x, j) => j === i ? { ...x, productId: e.target.value } : x) }))}
                    options={[{ value: '0', label: 'Producto...' }, ...(
                      item.type === 'sealed'
                        ? products.filter(p => p.type === 'sealed' || p.type === 'tester')
                        : item.type === 'decant' || item.type === 'partial'
                          ? products.filter(p => p.stockOpenML > 0)
                          : products
                    ).map(p => ({ value: String(p.id), label: (item.type === 'decant' || item.type === 'partial') ? `${p.brand} — ${p.name} (${p.stockOpenML}ml)` : `${p.brand} — ${p.name}` }))]} />
                  <Select value={item.type} onChange={e => setForm(f => ({ ...f, items: f.items.map((x, j) => j === i ? { ...x, type: e.target.value as any, productId: '0' } : x) }))}
                    options={[{ value: 'sealed', label: 'Sellado' }, { value: 'decant', label: 'Decant' }, { value: 'partial', label: 'Parcial' }]} />
                  {item.type === 'decant' && (
                    <Select value={item.sizeML} onChange={e => setForm(f => ({ ...f, items: f.items.map((x, j) => j === i ? { ...x, sizeML: e.target.value } : x) }))}
                      options={[3, 5, 10, 30].map(s => ({ value: String(s), label: `${s}ml` }))} />
                  )}
                  {item.type === 'partial' && (
                    <Input placeholder="ML a vender" type="number" value={item.sizeML} onChange={e => setForm(f => ({ ...f, items: f.items.map((x, j) => j === i ? { ...x, sizeML: e.target.value } : x) }))} />
                  )}
                  <Input placeholder="Cant." type="number" value={item.quantity} onChange={e => setForm(f => ({ ...f, items: f.items.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x) }))} />
                  <Input placeholder="Precio Gs." type="number" value={item.unitPrice} onChange={e => setForm(f => ({ ...f, items: f.items.map((x, j) => j === i ? { ...x, unitPrice: e.target.value } : x) }))} />
                </div>
                <button onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, j) => j !== i) }))} className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer shrink-0">
                  <XIcon size={14} />
                </button>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setForm(f => ({ ...f, items: [...f.items, { productId: '0', type: 'sealed', sizeML: '5', quantity: '1', unitPrice: '' }] }))}>
              + Agregar producto
            </Button>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Insumos utilizados</p>
            {form.supplies.map((si, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <div className="grid grid-cols-2 gap-2 flex-1">
                  <Select value={si.supplyId} onChange={e => setForm(f => ({ ...f, supplies: f.supplies.map((x, j) => j === i ? { ...x, supplyId: e.target.value } : x) }))}
                    options={[{ value: '', label: 'Insumo...' }, ...supplies.map(s => ({ value: String(s.id), label: s.name }))]} />
                  <Input placeholder="Cantidad" type="number" value={si.quantity} onChange={e => setForm(f => ({ ...f, supplies: f.supplies.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x) }))} />
                </div>
                <button onClick={() => setForm(f => ({ ...f, supplies: f.supplies.filter((_, j) => j !== i) }))} className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer shrink-0">
                  <XIcon size={14} />
                </button>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setForm(f => ({ ...f, supplies: [...f.supplies, { supplyId: '', quantity: '1' }] }))}>
              + Agregar insumo
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Costo de envío (Gs.)" type="number" value={form.shippingCost} onChange={e => setForm(f => ({ ...f, shippingCost: e.target.value }))} />
            <Select label="¿Quién paga el envío?" value={form.shippingPaidBy} onChange={e => setForm(f => ({ ...f, shippingPaidBy: e.target.value as any }))}
              options={[{ value: 'customer', label: 'El cliente' }, { value: 'business', label: 'El negocio' }]} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Fecha del pedido" type="date" value={form.orderDate} onChange={e => setForm(f => ({ ...f, orderDate: e.target.value }))} />
            <Input label="Entrega estimada" type="date" value={form.estimatedDelivery} onChange={e => setForm(f => ({ ...f, estimatedDelivery: e.target.value }))} />
          </div>
          <Textarea label="Notas" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => setForm(f => ({ ...f, isPreOrder: !f.isPreOrder }))}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.isPreOrder ? 'bg-orange-400' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isPreOrder ? 'translate-x-5' : ''}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Pre-pedido (sin stock disponible)</p>
              {form.isPreOrder && <p className="text-xs text-orange-600">No se validará stock al crear. Validará cuando pase a "Preparar".</p>}
            </div>
          </label>

          {supplyErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
              {supplyErrors.map((e, idx) => (
                <p key={idx} className="text-sm text-red-600 flex items-center gap-1.5">
                  <AlertTriangle size={13} /> {e}
                </p>
              ))}
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleCreate}>{editOrderId ? 'Guardar cambios' : 'Crear pedido'}</Button>
          </div>
        </div>
      </Modal>

      {/* Modal errores de stock al preparar */}
      <Modal isOpen={prepErrors.length > 0} onClose={() => setPrepErrors([])} title="Stock insuficiente">
        <div className="space-y-3">
          <p className="text-sm text-gray-600">No se puede preparar el pedido:</p>
          <div className="space-y-1.5">
            {prepErrors.map((e, i) => (
              <p key={i} className="text-sm text-red-600 flex items-center gap-1.5">
                <AlertTriangle size={13} className="shrink-0" /> {e}
              </p>
            ))}
          </div>
          <Button className="w-full" onClick={() => setPrepErrors([])}>Entendido</Button>
        </div>
      </Modal>

      {/* Modal pago al entregar */}
      <Modal isOpen={showPaymentModal} onClose={() => { setShowPaymentModal(false); setPendingDeliveryId(null) }} title="Registrar entrega y cobro">
        {pendingDeliveryId && (() => {
          const ord = orders.find(o => o.id === pendingDeliveryId)
          if (!ord) return null
          const señaTotal = (ord.advancePayments ?? []).reduce((s, p) => s + p.amount, 0)
          const saldo = Math.max(0, ord.totalAmount - señaTotal)
          return (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-100 rounded-xl p-4 space-y-2">
                <p className="text-sm font-medium text-green-700">{ord.customerName}</p>
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">Total del pedido</span>
                  <span className="font-bold text-green-800">{fmtPYG(ord.totalAmount)}</span>
                </div>
                {señaTotal > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600">Señas ya cobradas</span>
                      <span className="text-green-700">− {fmtPYG(señaTotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm border-t border-green-200 pt-2">
                      <span className="font-semibold text-green-700">Saldo a cobrar ahora</span>
                      <span className="text-xl font-bold text-green-800">{fmtPYG(saldo)}</span>
                    </div>
                    {(ord.advancePayments ?? []).map((p, i) => (
                      <p key={i} className="text-xs text-green-500">{fmtDate(p.date)} · {fmtPYG(p.amount)} · {p.method}</p>
                    ))}
                  </>
                )}
                {señaTotal === 0 && <p className="text-xs text-green-600">{ord.items.length} producto(s) · {fmtDate(ord.orderDate)}</p>}
              </div>
              {saldo > 0 ? (
                <>
                  <Select
                    label="Cobrar saldo en cuenta"
                    value={payAccountId}
                    onChange={e => setPayAccountId(e.target.value)}
                    options={[{ value: '', label: 'Seleccionar cuenta...' }, ...accounts.map(a => ({ value: String(a.id), label: `${a.name} — ${fmtPYG(a.balance)}` }))]}
                  />
                  <Select
                    label="Método de pago"
                    value={payMethod}
                    onChange={e => setPayMethod(e.target.value as PaymentMethod)}
                    options={[
                      { value: 'cash', label: 'Efectivo' },
                      { value: 'transfer', label: 'Transferencia' },
                      { value: 'card', label: 'Tarjeta' },
                      { value: 'other', label: 'Otro' },
                    ]}
                  />
                </>
              ) : (
                <div className="bg-violet-50 rounded-lg p-3 text-sm text-violet-700 text-center font-medium">
                  Pagado completamente con señas. Solo se registrará la entrega.
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button variant="secondary" className="flex-1" onClick={() => { setShowPaymentModal(false); setPendingDeliveryId(null) }}>Cancelar</Button>
                <Button className="flex-1" onClick={handleDeliveryPayment} disabled={saldo > 0 && !payAccountId}>
                  Confirmar entrega{saldo > 0 ? ` y cobrar ${fmtPYG(saldo)}` : ''}
                </Button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* Modal detalle */}
      {selectedOrder && (
        <Modal isOpen={!!showDetail} onClose={() => setShowDetail(null)} title={`Pedido — ${selectedOrder.customerName}`} size="lg">
          <div className="space-y-4 text-sm">
            {selectedOrder.budgetId && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 flex items-center gap-2 text-xs text-emerald-700">
                <span className="font-medium">Origen:</span>
                <span>Presupuesto #{String(selectedOrder.budgetId).padStart(4, '0')}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-gray-500">Teléfono</p><p className="font-medium">{selectedOrder.customerPhone || '—'}</p></div>
              <div><p className="text-gray-500">Dirección</p><p className="font-medium">{selectedOrder.customerAddress || '—'}</p></div>
              <div><p className="text-gray-500">Fecha</p><p className="font-medium">{fmtDate(selectedOrder.orderDate)}</p></div>
              <div><p className="text-gray-500">Estado</p><Badge color={statusColors[selectedOrder.status]}>{statusLabels[selectedOrder.status]}</Badge></div>
            </div>
            <div className="border-t border-gray-100 pt-3">
              <p className="font-medium text-gray-700 mb-2">Productos</p>
              {selectedOrder.items.map((item, i) => {
                const p = products.find(x => x.id === item.productId)
                return (
                  <div key={i} className="flex justify-between py-1">
                    <span className="text-gray-600">{p?.name ?? '—'} {item.type === 'partial' ? `${item.sizeML}ml (parcial)` : item.sizeML ? `${item.sizeML}ml` : ''} ×{item.quantity}</span>
                    <span className="font-medium">{fmtPYG(item.quantity * item.unitPrice)}</span>
                  </div>
                )
              })}
            </div>
            <div className="bg-gray-50 rounded-lg p-3 space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">Total venta</span><span className="font-bold">{fmtPYG(selectedOrder.totalAmount)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Costo insumos+envío</span><span className="text-gray-700">{fmtPYG(selectedOrder.totalCost)}</span></div>
              <div className="flex justify-between"><span className="text-green-600 font-medium">Margen</span><span className="font-bold text-green-700">{fmtPYG(selectedOrder.totalAmount - selectedOrder.totalCost)}</span></div>
              {(selectedOrder.advancePayments?.length ?? 0) > 0 && (() => {
                const señaTotal = selectedOrder.advancePayments!.reduce((s, p) => s + p.amount, 0)
                return (
                  <>
                    <div className="border-t border-gray-200 pt-1 mt-1">
                      {selectedOrder.advancePayments!.map((p, i) => (
                        <div key={i} className="flex justify-between text-xs text-violet-600">
                          <span>Seña {fmtDate(p.date)} ({p.method})</span>
                          <span>{fmtPYG(p.amount)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-semibold text-violet-700 mt-1">
                        <span>Saldo pendiente</span>
                        <span>{fmtPYG(Math.max(0, selectedOrder.totalAmount - señaTotal))}</span>
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>
            {selectedOrder.notes && <p className="text-gray-500 italic">{selectedOrder.notes}</p>}
            <div className="flex gap-2 pt-2 border-t border-gray-100 flex-wrap">
              {selectedOrder.status !== 'delivered' && selectedOrder.status !== 'cancelled' && (
                <Button variant="secondary" size="sm" onClick={() => { openSeña(selectedOrder.id!); setShowDetail(null) }}>
                  + Registrar seña
                </Button>
              )}
              {selectedOrder.status === 'pending' && (
                <Button variant="secondary" size="sm" icon={<Edit2 size={14} />} onClick={() => { openEditOrder(selectedOrder); setShowDetail(null) }}>
                  Editar
                </Button>
              )}
              <Button
                variant={selectedOrder.status === 'pending' ? 'danger' : 'secondary'}
                size="sm"
                icon={<Trash2 size={14} />}
                onClick={() => handleDeleteOrder(selectedOrder)}
              >
                {selectedOrder.status === 'pending'
                  ? 'Eliminar pedido'
                  : selectedOrder.status === 'delivered'
                    ? 'Anular entrega'
                    : 'Revertir a pendiente'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal seña */}
      <Modal isOpen={showSeña} onClose={() => { setShowSeña(false); setSeñaOrderId(null) }} title="Registrar seña">
        {señaOrderId && (() => {
          const ord = orders.find(o => o.id === señaOrderId)
          if (!ord) return null
          const señaTotal = (ord.advancePayments ?? []).reduce((s, p) => s + p.amount, 0)
          const saldo = Math.max(0, ord.totalAmount - señaTotal)
          return (
            <div className="space-y-4">
              <div className="bg-violet-50 rounded-xl p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Pedido de {ord.customerName}</span>
                  <span className="font-bold text-violet-700">{fmtPYG(ord.totalAmount)}</span>
                </div>
                {señaTotal > 0 && (
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Señas anteriores</span>
                    <span>{fmtPYG(señaTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-violet-700 border-t border-violet-100 pt-1">
                  <span>Saldo restante</span>
                  <span>{fmtPYG(saldo)}</span>
                </div>
              </div>
              <Input label="Monto de la seña (Gs.)" type="number" value={señaForm.amount} onChange={e => setSeñaForm(f => ({ ...f, amount: e.target.value }))} placeholder={`Máx. ${fmtPYG(saldo)}`} />
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Método de pago"
                  value={señaForm.method}
                  onChange={e => setSeñaForm(f => ({ ...f, method: e.target.value as PaymentMethod }))}
                  options={[{ value: 'cash', label: 'Efectivo' }, { value: 'transfer', label: 'Transferencia' }, { value: 'card', label: 'Tarjeta' }, { value: 'other', label: 'Otro' }]}
                />
                <Select
                  label="Acreditar en"
                  value={señaForm.accountId}
                  onChange={e => setSeñaForm(f => ({ ...f, accountId: e.target.value }))}
                  options={[{ value: '', label: 'Seleccionar...' }, ...accounts.map(a => ({ value: String(a.id), label: `${a.name} — ${fmtPYG(a.balance)}` }))]}
                />
              </div>
              <Input label="Fecha" type="date" value={señaForm.date} onChange={e => setSeñaForm(f => ({ ...f, date: e.target.value }))} />
              <Input label="Notas (opcional)" value={señaForm.notes} onChange={e => setSeñaForm(f => ({ ...f, notes: e.target.value }))} />
              <div className="flex gap-2 pt-2">
                <Button variant="secondary" className="flex-1" onClick={() => { setShowSeña(false); setSeñaOrderId(null) }}>Cancelar</Button>
                <Button className="flex-1" onClick={handleAddSeña} disabled={!señaForm.amount || !señaForm.accountId || parseFloat(señaForm.amount) <= 0}>
                  Registrar seña
                </Button>
              </div>
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}
