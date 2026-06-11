import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, FileText, Download, X, Edit2, Trash2, Package } from 'lucide-react'
import { db } from '../db/db'
import type { BudgetStatus } from '../db/types'
import { fmtPYG, fmtDate, today, nowISO } from '../lib/format'
import { upsertCustomer } from '../lib/customers'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Card, CardBody } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Input, Select, Textarea } from '../components/ui/Input'
import { CustomerAutocomplete } from '../components/ui/CustomerAutocomplete'
import { Badge } from '../components/ui/Badge'

const statusColors: Record<BudgetStatus, 'gray' | 'blue' | 'green' | 'red'> = {
  draft: 'gray', sent: 'blue', accepted: 'green', rejected: 'red',
}
const statusLabels: Record<BudgetStatus, string> = {
  draft: 'Borrador', sent: 'Enviado', accepted: 'Aceptado', rejected: 'Rechazado',
}

interface BudgetLineItem {
  productId: string
  description: string
  type: 'sealed' | 'tester' | 'decant' | 'partial' | 'custom'
  sizeML: string
  quantity: string
  unitPrice: string
}

function findSupplyForSize(supplies: import('../db/types').Supply[], sizeML: number) {
  return supplies.find(s => s.sizeML === sizeML)
    ?? supplies.find(s => (s.type as string) === `${sizeML}ml`)
}

export function Presupuestos() {
  const navigate = useNavigate()
  const products = useLiveQuery(() => db.products.toArray()) ?? []
  const budgets = useLiveQuery(() => db.budgets.orderBy('createdAt').reverse().toArray()) ?? []
  const customers = useLiveQuery(() => db.customers.orderBy('name').toArray()) ?? []
  const supplies = useLiveQuery(() => db.supplies.toArray()) ?? []
  const localOrderIds = useLiveQuery(async () => {
    const orders = await db.localOrders.toArray()
    return new Set(orders.map(o => o.id!))
  }) ?? new Set<number>()
  const [showNew, setShowNew] = useState(false)
  const [showDetail, setShowDetail] = useState<number | null>(null)
  const [editBudgetId, setEditBudgetId] = useState<number | null>(null)

  const emptyLine = (): BudgetLineItem => ({ productId: '0', description: '', type: 'sealed', sizeML: '5', quantity: '1', unitPrice: '' })
  const emptyForm = {
    customerName: '', customerPhone: '', discount: '0', notes: '', validUntil: '',
    items: [emptyLine()] as BudgetLineItem[],
  }
  const [form, setForm] = useState(emptyForm)

  const subtotal = form.items.reduce((s, i) => s + (parseFloat(i.unitPrice) || 0) * (parseInt(i.quantity) || 0), 0)
  const discountAmt = subtotal * (parseFloat(form.discount) / 100 || 0)
  const total = subtotal - discountAmt

  // Profit analysis — internal only, not shown in PDF
  const profitLines = form.items.map(item => {
    const p = products.find(x => String(x.id) === item.productId)
    const qty = parseInt(item.quantity) || 1
    const price = parseFloat(item.unitPrice) || 0
    const sizeML = parseInt(item.sizeML) || 5
    let unitCost = 0
    let costDetail = ''

    if (p && item.type !== 'custom') {
      if (item.type === 'sealed' || item.type === 'tester') {
        unitCost = p.costPYG
        costDetail = `CPP: ${fmtPYG(Math.round(p.costPYG))}`
      } else if (item.type === 'decant') {
        const cpm = p.type === 'decant_source' ? p.costPYG : p.costPYG / p.sizeML
        const supply = findSupplyForSize(supplies, sizeML)
        const supplyCost = supply?.costPYG ?? 0
        unitCost = cpm * sizeML + supplyCost
        costDetail = `${fmtPYG(Math.round(cpm * sizeML))} líquido + ${fmtPYG(supplyCost)} frasco`
      } else if (item.type === 'partial') {
        const cpm = p.type === 'decant_source' ? p.costPYG : p.costPYG / p.sizeML
        unitCost = cpm * sizeML
        costDetail = `CPM: ${fmtPYG(Math.round(cpm))}/ml`
      }
    }

    const totalRevenue = price * qty
    const totalCost = unitCost * qty
    const profit = totalRevenue - totalCost
    const margin = totalRevenue > 0 ? Math.round((profit / totalRevenue) * 100) : 0

    return { description: item.description || '—', qty, unitCost: Math.round(unitCost), price, totalRevenue, totalCost: Math.round(totalCost), profit: Math.round(profit), margin, costDetail }
  }).filter(l => l.price > 0)

  const totalRevenueFull = profitLines.reduce((s, l) => s + l.totalRevenue, 0)
  const totalRevenueAfterDiscount = totalRevenueFull - discountAmt
  const totalCostAll = profitLines.reduce((s, l) => s + l.totalCost, 0)
  const totalProfit = totalRevenueAfterDiscount - totalCostAll
  const overallMargin = totalRevenueAfterDiscount > 0 ? Math.round((totalProfit / totalRevenueAfterDiscount) * 100) : 0

  function updateItem(i: number, field: keyof BudgetLineItem, val: string) {
    setForm(f => ({ ...f, items: f.items.map((x, j) => j === i ? { ...x, [field]: val } : x) }))
  }

  const sealedProds = products.filter(p => p.type === 'sealed' || p.type === 'tester')
  const decantProds = products.filter(p => p.stockOpenML > 0)

  function getProductsForType(t: BudgetLineItem['type']) {
    if (t === 'sealed' || t === 'tester') return sealedProds
    if (t === 'decant' || t === 'partial') return decantProds
    return []
  }

  function autoFill(i: number, productId: string, type: BudgetLineItem['type'], sizeML: string) {
    const p = products.find(x => String(x.id) === productId)
    if (!p || productId === '0') {
      setForm(f => ({ ...f, items: f.items.map((x, j) => j === i ? { ...x, productId, type, sizeML } : x) }))
      return
    }
    const size = parseInt(sizeML) || 5
    const priceMap: Record<number, number | undefined> = { 3: p.price3ML, 5: p.price5ML, 10: p.price10ML, 30: p.price30ML }
    let desc = ''
    let price = ''
    if (type === 'sealed') {
      desc = `${p.brand} — ${p.name} ${p.sizeML}ml`
      price = String(p.sellingPricePYG)
    } else if (type === 'tester') {
      desc = `${p.brand} — ${p.name} ${p.sizeML}ml (tester)`
      price = String(p.sellingPricePYG)
    } else if (type === 'decant') {
      desc = `${p.brand} — ${p.name} ${size}ml (decant)`
      price = priceMap[size] ? String(priceMap[size]) : ''
    } else if (type === 'partial') {
      desc = `${p.brand} — ${p.name} ${size}ml (parcial)`
      const cpm = p.type === 'decant_source' ? p.costPYG : p.costPYG / p.sizeML
      price = String(Math.round(cpm * size))
    }
    setForm(f => ({
      ...f,
      items: f.items.map((x, j) => j === i ? { ...x, productId, type, sizeML, description: desc || x.description, unitPrice: price || x.unitPrice } : x),
    }))
  }

  function handleLineTypeChange(i: number, type: BudgetLineItem['type']) {
    setForm(f => ({
      ...f,
      items: f.items.map((x, j) => j === i ? { ...x, type, productId: '0', description: '', unitPrice: '' } : x),
    }))
  }

  function openEditBudget(b: typeof budgets[0]) {
    setEditBudgetId(b.id!)
    setForm({
      customerName: b.customerName,
      customerPhone: b.customerPhone ?? '',
      discount: String(b.discount),
      notes: b.notes ?? '',
      validUntil: b.validUntil ?? '',
      items: b.items.map(i => ({
        productId: String(i.productId ?? '0'),
        description: i.description,
        type: i.type as 'sealed' | 'decant',
        sizeML: String(i.sizeML ?? '5'),
        quantity: String(i.quantity),
        unitPrice: String(i.unitPrice),
      })),
    })
    setShowNew(true)
  }

  function closeModal() {
    setShowNew(false)
    setEditBudgetId(null)
    setForm(emptyForm)
  }

  function buildItems() {
    return form.items
      .filter(i => i.description.trim() && i.unitPrice)
      .map(i => {
        const dbType = (i.type === 'decant' ? 'decant' : i.type === 'partial' ? 'partial' : 'sealed') as import('../db/types').SaleItemType
        return {
          productId: i.productId !== '0' ? parseInt(i.productId) : 0,
          description: i.description,
          type: dbType,
          sizeML: (i.type === 'decant' || i.type === 'partial') ? parseInt(i.sizeML) : undefined,
          quantity: parseInt(i.quantity) || 1,
          unitPrice: parseFloat(i.unitPrice) || 0,
          subtotal: (parseFloat(i.unitPrice) || 0) * (parseInt(i.quantity) || 1),
        }
      })
  }

  async function handleCreate() {
    if (!form.customerName.trim()) return
    const validItems = buildItems()
    if (!validItems.length) return
    const now = nowISO()
    const customerId = await upsertCustomer(form.customerName, form.customerPhone)

    await db.budgets.add({
      customerId,
      customerName: form.customerName, customerPhone: form.customerPhone || undefined,
      items: validItems,
      subtotal, discount: parseFloat(form.discount) || 0, total,
      notes: form.notes, status: 'draft',
      validUntil: form.validUntil || undefined,
      createdAt: now, updatedAt: now,
    })

    closeModal()
  }

  async function handleEditBudget() {
    if (!editBudgetId || !form.customerName.trim()) return
    const validItems = buildItems()
    if (!validItems.length) return
    const customerId = await upsertCustomer(form.customerName, form.customerPhone)
    await db.budgets.update(editBudgetId, {
      customerId,
      customerName: form.customerName, customerPhone: form.customerPhone || undefined,
      items: validItems, subtotal, discount: parseFloat(form.discount) || 0, total,
      notes: form.notes, validUntil: form.validUntil || undefined, updatedAt: nowISO(),
    })
    closeModal()
  }

  async function handleDeleteBudget(id: number) {
    if (!confirm('¿Eliminar este presupuesto?')) return
    await db.budgets.delete(id)
  }

  async function convertToOrder(budget: typeof budgets[0]) {
    const validItems = budget.items.filter(i => i.productId > 0)
    if (!validItems.length) {
      alert('Este presupuesto solo tiene ítems personalizados sin producto. No se puede convertir a pedido.')
      return
    }

    const orderItems = validItems.map(i => ({
      productId: i.productId,
      type: i.type,
      sizeML: (i.type === 'decant' || i.type === 'partial') ? i.sizeML : undefined,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    }))

    // Los frascos para decants los descuenta automáticamente advanceStatus al preparar —
    // no los agregamos aquí para evitar doble descuento
    const skipped = budget.items.length - validItems.length
    const now = nowISO()
    const customerId = await upsertCustomer(budget.customerName, budget.customerPhone ?? '')

    await db.transaction('rw', db.localOrders, db.budgets, async () => {
      const orderId = await db.localOrders.add({
        customerId,
        customerName: budget.customerName,
        customerPhone: budget.customerPhone ?? '',
        customerAddress: '',
        items: orderItems,
        supplies: [],
        shippingCost: 0,
        shippingPaidBy: 'customer',
        totalAmount: budget.total,
        totalCost: 0,
        status: 'pending',
        budgetId: budget.id!,
        notes: budget.notes ?? '',
        orderDate: today(),
        createdAt: now,
        updatedAt: now,
      })
      await db.budgets.update(budget.id!, { localOrderId: orderId as number, updatedAt: now })
    })

    if (skipped > 0) alert(`Pedido creado. ${skipped} ítem${skipped > 1 ? 's' : ''} personalizado${skipped > 1 ? 's' : ''} sin producto fue${skipped > 1 ? 'ron' : ''} omitido${skipped > 1 ? 's' : ''}.`)
    navigate('/logistica')
  }

  async function updateStatus(id: number, status: BudgetStatus) {
    await db.budgets.update(id, { status, updatedAt: nowISO() })
  }

  async function exportPDF(budget: typeof budgets[0]) {
    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    // Header — JODA brand: dark + gold
    doc.setFillColor(20, 18, 18)
    doc.rect(0, 0, 210, 38, 'F')
    doc.setTextColor(200, 169, 110)
    doc.setFontSize(24)
    doc.setFont('helvetica', 'bold')
    doc.text('JODA', 14, 16)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(180, 150, 95)
    doc.text('PARFUMS & DECANTS', 14, 23)
    doc.setTextColor(160, 130, 80)
    doc.text('Presupuesto de Fragancias', 14, 30)
    doc.setTextColor(200, 169, 110)
    doc.setFontSize(10)
    doc.text(`N° ${String(budget.id).padStart(4, '0')}`, 160, 15)
    doc.setFontSize(8)
    doc.setTextColor(160, 130, 80)
    doc.text(fmtDate(budget.createdAt), 160, 22)

    // Cliente
    doc.setTextColor(30, 27, 46)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Para:', 14, 50)
    doc.setFont('helvetica', 'normal')
    doc.text(budget.customerName, 32, 50)
    if (budget.customerPhone) doc.text(budget.customerPhone, 32, 57)
    if (budget.validUntil) {
      doc.text(`Válido hasta: ${fmtDate(budget.validUntil)}`, 140, 50)
    }

    // Tabla
    let y = 73
    doc.setFillColor(20, 18, 18)
    doc.rect(14, y, 182, 8, 'F')
    doc.setTextColor(200, 169, 110)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('Descripción', 16, y + 5.5)
    doc.text('Cant.', 130, y + 5.5)
    doc.text('P. Unit.', 148, y + 5.5)
    doc.text('Subtotal', 172, y + 5.5)
    y += 12

    doc.setTextColor(30, 27, 46)
    doc.setFont('helvetica', 'normal')
    budget.items.forEach((item, idx) => {
      if (y > 250) { doc.addPage(); y = 20 }
      if (idx % 2 === 1) {
        doc.setFillColor(248, 247, 255)
        doc.rect(14, y - 2, 182, 9, 'F')
      }
      doc.text(item.description.slice(0, 55), 16, y + 4)
      doc.text(String(item.quantity), 135, y + 4)
      doc.text(`Gs. ${item.unitPrice.toLocaleString('es-PY')}`, 142, y + 4)
      doc.text(`Gs. ${item.subtotal.toLocaleString('es-PY')}`, 165, y + 4)
      y += 10
    })

    // Totales
    y += 5
    doc.setDrawColor(200, 200, 220)
    doc.line(14, y, 196, y)
    y += 8
    doc.setFontSize(10)
    if (budget.discount > 0) {
      doc.text(`Subtotal:`, 130, y)
      doc.text(`Gs. ${budget.subtotal.toLocaleString('es-PY')}`, 195, y, { align: 'right' })
      y += 7
      doc.text(`Descuento (${budget.discount}%):`, 130, y)
      doc.setTextColor(200, 50, 50)
      doc.text(`- Gs. ${(budget.subtotal * budget.discount / 100).toLocaleString('es-PY')}`, 195, y, { align: 'right' })
      y += 7
      doc.setTextColor(30, 27, 46)
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(30, 27, 46)
    doc.text('TOTAL:', 140, y)
    doc.setTextColor(160, 128, 64)
    doc.text(`Gs. ${budget.total.toLocaleString('es-PY')}`, 195, y, { align: 'right' })

    if (budget.notes) {
      y += 20
      doc.setTextColor(100, 100, 100)
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(9)
      doc.text(budget.notes, 14, y, { maxWidth: 182 })
    }

    // Footer
    doc.setTextColor(150, 150, 150)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text('¡Gracias por tu confianza en JODA Parfums! · Paraguay', 105, 285, { align: 'center' })

    doc.save(`presupuesto-${String(budget.id).padStart(4, '0')}-${budget.customerName.replace(/\s/g, '-')}.pdf`)
  }

  const selectedBudget = budgets.find(b => b.id === showDetail)

  return (
    <div>
      <PageHeader
        title="Presupuestos"
        subtitle="Generación de documentos PDF para clientes"
        action={<Button icon={<Plus size={15} />} onClick={() => setShowNew(true)}>Nuevo presupuesto</Button>}
      />

      {budgets.length === 0 ? (
        <Card><CardBody className="text-center py-12">
          <FileText size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400">No hay presupuestos emitidos</p>
        </CardBody></Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">#</th>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Cliente</th>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Fecha</th>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Estado</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">Total</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {budgets.map(b => (
                  <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => setShowDetail(b.id!)}>
                    <td className="px-5 py-3 text-gray-400 font-mono">{String(b.id).padStart(4, '0')}</td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{b.customerName}</p>
                      {b.customerPhone && <p className="text-xs text-gray-400">{b.customerPhone}</p>}
                    </td>
                    <td className="px-5 py-3 text-gray-500">{fmtDate(b.createdAt)}</td>
                    <td className="px-5 py-3"><Badge color={statusColors[b.status]}>{statusLabels[b.status]}</Badge></td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-900">{fmtPYG(b.total)}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                        <Select
                          value={b.status}
                          onChange={e => updateStatus(b.id!, e.target.value as BudgetStatus)}
                          options={Object.entries(statusLabels).map(([v, l]) => ({ value: v, label: l }))}
                          className="text-xs w-28"
                        />
                        {b.status === 'accepted' && !(b.localOrderId && localOrderIds.has(b.localOrderId)) && (
                          <button
                            onClick={() => convertToOrder(b)}
                            className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors cursor-pointer"
                            title="Crear pedido en Logística"
                          >
                            <Package size={13} />
                          </button>
                        )}
                        {b.localOrderId && localOrderIds.has(b.localOrderId) && (
                          <button
                            onClick={() => navigate('/logistica')}
                            className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors cursor-pointer"
                            title="Ver pedido en Logística"
                          >
                            Ped. #{String(b.localOrderId).padStart(4, '0')}
                          </button>
                        )}
                        <button onClick={() => openEditBudget(b)} className="p-1.5 rounded-lg text-gray-300 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer" title="Editar">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => exportPDF(b)} className="p-1.5 rounded-lg text-gray-300 hover:bg-violet-50 hover:text-violet-600 transition-colors cursor-pointer" title="Exportar PDF">
                          <Download size={13} />
                        </button>
                        <button onClick={() => handleDeleteBudget(b.id!)} className="p-1.5 rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors cursor-pointer" title="Eliminar">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal nuevo presupuesto */}
      <Modal isOpen={showNew} onClose={closeModal} title={editBudgetId ? 'Editar presupuesto' : 'Nuevo presupuesto'} size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <CustomerAutocomplete
              label="Nombre del cliente"
              value={form.customerName}
              onChange={v => setForm(f => ({ ...f, customerName: v }))}
              onSelect={c => setForm(f => ({ ...f, customerName: c.name, customerPhone: c.phone ?? f.customerPhone }))}
              customers={customers}
            />
            <Input label="Teléfono (opcional)" value={form.customerPhone} onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))} />
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Líneas del presupuesto</p>
            <div className="space-y-2">
              {form.items.map((item, i) => (
                <div key={i} className="border border-gray-100 rounded-xl p-3 bg-gray-50/50 space-y-2">
                  {/* Fila 1: tipo + producto + tamaño */}
                  <div className="flex gap-2 items-center">
                    <select
                      value={item.type}
                      onChange={e => handleLineTypeChange(i, e.target.value as BudgetLineItem['type'])}
                      className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white shrink-0"
                    >
                      <option value="sealed">Sellado</option>
                      <option value="tester">Tester</option>
                      <option value="decant">Decant</option>
                      <option value="partial">Parcial</option>
                      <option value="custom">Personalizado</option>
                    </select>

                    {item.type !== 'custom' ? (
                      <select
                        value={item.productId}
                        onChange={e => autoFill(i, e.target.value, item.type, item.sizeML)}
                        className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white min-w-0"
                      >
                        <option value="0">Seleccionar producto...</option>
                        {getProductsForType(item.type).map(p => (
                          <option key={p.id} value={String(p.id)}>{p.brand} — {p.name}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex-1" />
                    )}

                    {(item.type === 'decant' || item.type === 'partial') && (
                      <select
                        value={item.sizeML}
                        onChange={e => autoFill(i, item.productId, item.type, e.target.value)}
                        className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white shrink-0"
                      >
                        {[3, 5, 10, 30].map(s => <option key={s} value={String(s)}>{s}ml</option>)}
                      </select>
                    )}

                    <button
                      onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, j) => j !== i) }))}
                      className="p-1.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 cursor-pointer shrink-0"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* Fila 2: descripción + cantidad + precio */}
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Descripción del ítem"
                      value={item.description}
                      onChange={e => updateItem(i, 'description', e.target.value)}
                      className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white min-w-0"
                    />
                    <input
                      type="number"
                      placeholder="Cant."
                      value={item.quantity}
                      onChange={e => updateItem(i, 'quantity', e.target.value)}
                      className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white text-center shrink-0"
                    />
                    <input
                      type="number"
                      placeholder="Precio Gs."
                      value={item.unitPrice}
                      onChange={e => updateItem(i, 'unitPrice', e.target.value)}
                      className="w-32 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white text-right shrink-0"
                    />
                    {item.unitPrice && item.quantity && (
                      <span className="text-xs text-gray-400 shrink-0 w-24 text-right">
                        = {fmtPYG((parseFloat(item.unitPrice) || 0) * (parseInt(item.quantity) || 0))}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setForm(f => ({ ...f, items: [...f.items, emptyLine()] }))}
              className="mt-2 text-sm text-violet-600 hover:text-violet-800 font-medium cursor-pointer"
            >
              + Agregar línea
            </button>
          </div>

          {/* Totales en tiempo real */}
          {subtotal > 0 && (
            <div className="bg-violet-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="font-semibold">{fmtPYG(subtotal)}</span></div>
              {discountAmt > 0 && <div className="flex justify-between"><span className="text-gray-500">Descuento ({form.discount}%)</span><span className="text-red-600">- {fmtPYG(discountAmt)}</span></div>}
              <div className="flex justify-between border-t border-violet-200 pt-2"><span className="font-bold text-gray-900">TOTAL</span><span className="font-bold text-violet-700 text-base">{fmtPYG(total)}</span></div>
            </div>
          )}

          {/* Análisis de rentabilidad — solo uso interno, no aparece en el PDF */}
          {profitLines.length > 0 && (
            <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-3 text-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Solo uso interno — no se incluye en el PDF</span>
              </div>

              <table className="w-full text-xs">
                <thead>
                  <tr className="text-amber-700 border-b border-amber-200">
                    <th className="text-left py-1 font-medium">Ítem</th>
                    <th className="text-right py-1 font-medium w-20">Costo unit.</th>
                    <th className="text-right py-1 font-medium w-20">Precio unit.</th>
                    <th className="text-right py-1 font-medium w-16">Ganancia</th>
                    <th className="text-right py-1 font-medium w-12">Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {profitLines.map((l, i) => (
                    <tr key={i} className="border-b border-amber-100 last:border-0">
                      <td className="py-1.5 text-gray-700 max-w-0 truncate" title={l.description}>
                        <span className="block truncate">{l.description}</span>
                        {l.costDetail && <span className="text-amber-600 text-[10px]">{l.costDetail}</span>}
                      </td>
                      <td className="py-1.5 text-right text-gray-600">{fmtPYG(l.unitCost)}</td>
                      <td className="py-1.5 text-right text-gray-600">{fmtPYG(l.price)}</td>
                      <td className={`py-1.5 text-right font-medium ${l.profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                        {l.profit >= 0 ? '+' : ''}{fmtPYG(l.profit * l.qty)}
                      </td>
                      <td className={`py-1.5 text-right font-semibold ${l.margin >= 30 ? 'text-green-700' : l.margin >= 10 ? 'text-amber-700' : 'text-red-600'}`}>
                        {l.margin}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="grid grid-cols-3 gap-3 pt-1 border-t border-amber-200">
                <div className="text-center">
                  <p className="text-amber-600 text-[10px] uppercase font-medium">Costo total</p>
                  <p className="font-semibold text-gray-800">{fmtPYG(totalCostAll)}</p>
                </div>
                <div className="text-center">
                  <p className="text-amber-600 text-[10px] uppercase font-medium">Ingreso neto</p>
                  <p className="font-semibold text-gray-800">{fmtPYG(totalRevenueAfterDiscount)}</p>
                </div>
                <div className="text-center">
                  <p className="text-amber-600 text-[10px] uppercase font-medium">Ganancia estimada</p>
                  <p className={`font-bold text-base ${totalProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {totalProfit >= 0 ? '+' : ''}{fmtPYG(totalProfit)}
                    <span className="text-xs font-normal ml-1">({overallMargin}%)</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input label="Descuento (%)" type="number" value={form.discount} onChange={e => setForm(f => ({ ...f, discount: e.target.value }))} />
            <Input label="Válido hasta" type="date" value={form.validUntil} onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))} />
          </div>
          <Textarea label="Condiciones / Notas" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Ej: Precio válido por 48 hs. Pago anticipado." />

          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={closeModal}>Cancelar</Button>
            <Button className="flex-1" onClick={editBudgetId ? handleEditBudget : handleCreate}>
              {editBudgetId ? 'Guardar cambios' : 'Crear presupuesto'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal detalle */}
      {selectedBudget && (
        <Modal isOpen={!!showDetail} onClose={() => setShowDetail(null)} title={`Presupuesto #${String(selectedBudget.id).padStart(4, '0')}`} size="lg">
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-gray-500">Cliente</p><p className="font-semibold">{selectedBudget.customerName}</p></div>
              <div><p className="text-gray-500">Fecha</p><p className="font-medium">{fmtDate(selectedBudget.createdAt)}</p></div>
            </div>
            {selectedBudget.localOrderId && localOrderIds.has(selectedBudget.localOrderId) ? (
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                <Package size={16} className="text-emerald-600 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-emerald-800">Pedido generado — Ped. #{String(selectedBudget.localOrderId).padStart(4, '0')}</p>
                  <p className="text-xs text-emerald-600">Este presupuesto ya fue convertido a un pedido en Logística.</p>
                </div>
                <button onClick={() => { setShowDetail(null); navigate('/logistica') }} className="text-xs font-medium text-emerald-700 hover:text-emerald-900 underline cursor-pointer">
                  Ver en Logística →
                </button>
              </div>
            ) : selectedBudget.status === 'accepted' && (
              <div className="flex items-center gap-3 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3">
                <Package size={16} className="text-violet-500 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-violet-800">Presupuesto aceptado</p>
                  <p className="text-xs text-violet-600">Podés convertirlo en un pedido de Logística para iniciar la preparación.</p>
                </div>
                <button onClick={() => { setShowDetail(null); convertToOrder(selectedBudget) }} className="text-xs font-semibold bg-violet-600 text-white px-3 py-1.5 rounded-lg hover:bg-violet-700 transition-colors cursor-pointer">
                  Crear pedido
                </button>
              </div>
            )}
            <table className="w-full">
              <thead><tr className="border-b border-gray-100"><th className="text-left py-2 text-gray-500 font-medium">Descripción</th><th className="text-right py-2 text-gray-500 font-medium">Cant.</th><th className="text-right py-2 text-gray-500 font-medium">Precio</th><th className="text-right py-2 text-gray-500 font-medium">Subtotal</th></tr></thead>
              <tbody>
                {selectedBudget.items.map((item, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2">{item.description}</td>
                    <td className="py-2 text-right">{item.quantity}</td>
                    <td className="py-2 text-right">{fmtPYG(item.unitPrice)}</td>
                    <td className="py-2 text-right font-medium">{fmtPYG(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="bg-gray-50 rounded-lg p-3 space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{fmtPYG(selectedBudget.subtotal)}</span></div>
              {selectedBudget.discount > 0 && <div className="flex justify-between"><span className="text-gray-500">Descuento {selectedBudget.discount}%</span><span className="text-red-600">- {fmtPYG(selectedBudget.subtotal * selectedBudget.discount / 100)}</span></div>}
              <div className="flex justify-between font-bold"><span>TOTAL</span><span className="text-violet-700">{fmtPYG(selectedBudget.total)}</span></div>
            </div>
            {selectedBudget.notes && <p className="text-gray-500 italic">{selectedBudget.notes}</p>}
            <Button className="w-full" icon={<Download size={15} />} onClick={() => exportPDF(selectedBudget)}>
              Descargar PDF
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
