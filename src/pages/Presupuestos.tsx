import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, FileText, Download, X, Edit2, Trash2 } from 'lucide-react'
import { db } from '../db/db'
import type { BudgetStatus } from '../db/types'
import { fmtPYG, fmtDate, nowISO } from '../lib/format'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Card, CardBody } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Input, Select, Textarea } from '../components/ui/Input'
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
  type: 'sealed' | 'decant'
  sizeML: string
  quantity: string
  unitPrice: string
}

export function Presupuestos() {
  const products = useLiveQuery(() => db.products.toArray()) ?? []
  const budgets = useLiveQuery(() => db.budgets.orderBy('createdAt').reverse().toArray()) ?? []
  const [showNew, setShowNew] = useState(false)
  const [showDetail, setShowDetail] = useState<number | null>(null)
  const [editBudgetId, setEditBudgetId] = useState<number | null>(null)

  const emptyForm = {
    customerName: '', customerPhone: '', discount: '0', notes: '', validUntil: '',
    items: [{ productId: '0', description: '', type: 'sealed' as 'sealed' | 'decant', sizeML: '5', quantity: '1', unitPrice: '' }] as BudgetLineItem[],
  }
  const [form, setForm] = useState({
    customerName: '', customerPhone: '',
    discount: '0', notes: '', validUntil: '',
    items: [{ productId: '0', description: '', type: 'sealed' as 'sealed' | 'decant', sizeML: '5', quantity: '1', unitPrice: '' }] as BudgetLineItem[],
  })

  const subtotal = form.items.reduce((s, i) => s + (parseFloat(i.unitPrice) || 0) * (parseInt(i.quantity) || 0), 0)
  const discountAmt = subtotal * (parseFloat(form.discount) / 100 || 0)
  const total = subtotal - discountAmt

  function updateItem(i: number, field: keyof BudgetLineItem, val: string) {
    setForm(f => ({ ...f, items: f.items.map((x, j) => j === i ? { ...x, [field]: val } : x) }))
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
      .map(i => ({
        productId: i.productId !== '0' ? parseInt(i.productId) : 0,
        description: i.description,
        type: i.type,
        sizeML: i.type === 'decant' ? parseInt(i.sizeML) : undefined,
        quantity: parseInt(i.quantity) || 1,
        unitPrice: parseFloat(i.unitPrice) || 0,
        subtotal: (parseFloat(i.unitPrice) || 0) * (parseInt(i.quantity) || 1),
      }))
  }

  async function handleCreate() {
    if (!form.customerName.trim()) return
    const validItems = buildItems()
    if (!validItems.length) return
    const now = nowISO()

    await db.budgets.add({
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
    await db.budgets.update(editBudgetId, {
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
      doc.text(`Subtotal:`, 140, y)
      doc.text(`Gs. ${budget.subtotal.toLocaleString('es-PY')}`, 170, y, { align: 'right' })
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
            <Input label="Nombre del cliente" value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} />
            <Input label="Teléfono (opcional)" value={form.customerPhone} onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))} />
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Líneas del presupuesto</p>
            {form.items.map((item, i) => (
              <div key={i} className="grid grid-cols-6 gap-2 mb-2 items-end">
                <div className="col-span-2">
                  <Select
                    value={item.productId}
                    onChange={e => {
                      const p = products.find(x => String(x.id) === e.target.value)
                      updateItem(i, 'productId', e.target.value)
                      if (p) {
                        updateItem(i, 'description', `${p.brand} — ${p.name} ${p.sizeML}ml`)
                        updateItem(i, 'type', p.type === 'sealed' ? 'sealed' : 'decant')
                        updateItem(i, 'unitPrice', String(p.sellingPricePYG))
                      }
                    }}
                    options={[{ value: '0', label: 'Producto...' }, ...products.map(p => ({ value: String(p.id), label: `${p.brand} — ${p.name}` }))]}
                  />
                </div>
                <div className="col-span-2">
                  <Input placeholder="Descripción" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} />
                </div>
                <Input placeholder="Cant." type="number" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} />
                <div className="flex gap-1 items-end">
                  <Input placeholder="Precio Gs." type="number" value={item.unitPrice} onChange={e => updateItem(i, 'unitPrice', e.target.value)} />
                  <button onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, j) => j !== i) }))} className="p-2 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 cursor-pointer mb-0.5">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setForm(f => ({ ...f, items: [...f.items, { productId: '0', description: '', type: 'sealed', sizeML: '5', quantity: '1', unitPrice: '' }] }))}>
              + Agregar línea
            </Button>
          </div>

          {/* Totales en tiempo real */}
          {subtotal > 0 && (
            <div className="bg-violet-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="font-semibold">{fmtPYG(subtotal)}</span></div>
              {discountAmt > 0 && <div className="flex justify-between"><span className="text-gray-500">Descuento ({form.discount}%)</span><span className="text-red-600">- {fmtPYG(discountAmt)}</span></div>}
              <div className="flex justify-between border-t border-violet-200 pt-2"><span className="font-bold text-gray-900">TOTAL</span><span className="font-bold text-violet-700 text-base">{fmtPYG(total)}</span></div>
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
