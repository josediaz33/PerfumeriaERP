import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Users, Phone, MapPin, ChevronDown, ChevronUp, ShoppingBag, Clock, Edit2, Printer, CreditCard } from 'lucide-react'
import { db } from '../db/db'
import type { Sale, LocalOrder, Customer } from '../db/types'
import { fmtPYG, fmtDate } from '../lib/format'
import { PageHeader } from '../components/ui/PageHeader'
import { Card, CardBody } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Input, Textarea } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'

const localOrderStatusLabels: Record<string, string> = {
  pending: 'Pendiente', preparing: 'En preparación', ready: 'Listo',
  delivered: 'Entregado', cancelled: 'Cancelado',
}
const paymentLabels: Record<string, string> = {
  cash: 'Efectivo', transfer: 'Transferencia', card: 'Tarjeta', qr: 'QR', other: 'Otro',
}

const emptyEditForm = { name: '', ci: '', phone: '', address: '', notes: '' }

export function Clientes() {
  const customers = useLiveQuery(() => db.customers.orderBy('name').toArray()) ?? []
  const sales = useLiveQuery(() => db.sales.orderBy('date').reverse().toArray()) ?? []
  const localOrders = useLiveQuery(() => db.localOrders.orderBy('orderDate').reverse().toArray()) ?? []

  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
  const [editForm, setEditForm] = useState(emptyEditForm)

  function matchSales(customerId: number, name: string): Sale[] {
    return sales.filter(s =>
      s.customerId === customerId ||
      (!s.customerId && s.customerName?.toLowerCase() === name.toLowerCase())
    )
  }

  function matchOrders(customerId: number, name: string): LocalOrder[] {
    return localOrders.filter(o =>
      o.customerId === customerId ||
      (!o.customerId && o.customerName.toLowerCase() === name.toLowerCase())
    )
  }

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search) ||
    c.ci?.includes(search)
  )

  const totalRevenue = customers.reduce((sum, c) =>
    sum + matchSales(c.id!, c.name).reduce((s, x) => s + x.totalAmount, 0), 0)
  const activeOrders = localOrders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length

  function openEdit(c: Customer) {
    setEditCustomer(c)
    setEditForm({ name: c.name, ci: c.ci ?? '', phone: c.phone ?? '', address: c.address ?? '', notes: c.notes ?? '' })
  }

  async function handleSaveCustomer() {
    if (!editCustomer?.id || !editForm.name.trim()) return
    await db.customers.update(editCustomer.id, {
      name: editForm.name.trim(),
      ci: editForm.ci.trim() || undefined,
      phone: editForm.phone.trim() || undefined,
      address: editForm.address.trim() || undefined,
      notes: editForm.notes.trim() || undefined,
    })
    setEditCustomer(null)
  }

  async function generateLabel(c: Customer) {
    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [148, 105] })

    const W = 148, H = 105
    const pad = 6
    const innerW = W - pad * 2
    const cx = pad + 6

    // ── Borde exterior fino ──
    doc.setDrawColor(212, 210, 218)
    doc.setLineWidth(0.35)
    doc.rect(pad, pad, innerW, H - pad * 2)

    // ── Header oscuro ──
    const headerH = 13
    doc.setFillColor(10, 10, 13)
    doc.rect(pad, pad, innerW, headerH, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(200, 166, 96)
    doc.text('JODA PARFUMS', cx, pad + 8.5)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.setTextColor(138, 112, 65)
    doc.text('Fragancias & Decants · Paraguay', W - pad - 5, pad + 8.5, { align: 'right' })

    // ── Línea dorada bajo header ──
    doc.setDrawColor(200, 166, 96)
    doc.setLineWidth(0.6)
    doc.line(pad, pad + headerH, W - pad, pad + headerH)

    // ── Label "DESTINATARIO" ──
    let y = pad + headerH + 8
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(5.5)
    doc.setTextColor(182, 178, 190)
    doc.text('DESTINATARIO', cx, y)
    y += 6.5

    // ── Nombre ──
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.setTextColor(12, 10, 18)
    const nameLines = doc.splitTextToSize(c.name, innerW - 12)
    doc.text(nameLines, cx, y)
    y += nameLines.length * 7 + 3

    // ── Datos de contacto ──
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(12)
    doc.setTextColor(68, 65, 82)

    if (c.ci) {
      doc.text(`CI   ${c.ci}`, cx, y)
      y += 5.5
    }
    if (c.phone) {
      doc.text(`Tel  ${c.phone}`, cx, y)
      y += 5.5
    }
    if (c.address) {
      const addrLines = doc.splitTextToSize(c.address, innerW - 14)
      doc.text(addrLines, cx, y)
      y += addrLines.length * 5.5
    }
    if (c.notes) {
      doc.setFontSize(7.5)
      doc.setTextColor(140, 136, 155)
      const noteLines = doc.splitTextToSize(c.notes, innerW - 14)
      doc.text(noteLines, cx, y + 1)
    }

    // ── Divisor + Remitente ──
    const footerY = H - pad - 13
    doc.setDrawColor(215, 212, 222)
    doc.setLineWidth(0.25)
    doc.line(pad, footerY, W - pad, footerY)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(5.5)
    doc.setTextColor(170, 165, 180)
    doc.text('REMITENTE', cx, footerY + 5)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(78, 75, 92)
    doc.text('JODA Parfums · Paraguay', cx, footerY + 9.5)

    const url = doc.output('bloburi')
    window.open(url, '_blank')
  }

  return (
    <div>
      <PageHeader title="Clientes" subtitle="Historial de compras y datos de contacto" />

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-500">Clientes registrados</p>
          <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-500">Facturación total</p>
          <p className="text-2xl font-bold text-gray-900">{fmtPYG(totalRevenue)}</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4">
          <p className="text-sm text-yellow-600">Pedidos activos</p>
          <p className="text-2xl font-bold text-yellow-700">{activeOrders}</p>
        </div>
      </div>

      {/* Buscador */}
      <div className="mb-4">
        <Input
          placeholder="Buscar por nombre, teléfono o CI..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {customers.length === 0 ? (
        <Card>
          <CardBody className="text-center py-14">
            <Users size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No hay clientes registrados todavía</p>
            <p className="text-sm text-gray-400 mt-1">Se crean automáticamente al guardar pedidos con nombre de cliente</p>
          </CardBody>
        </Card>
      ) : filtered.length === 0 ? (
        <Card><CardBody className="text-center py-10"><p className="text-gray-400">Sin resultados para "{search}"</p></CardBody></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => {
            const cSales = matchSales(c.id!, c.name)
            const cOrders = matchOrders(c.id!, c.name)
            const totalSpent = cSales.reduce((s, x) => s + x.totalAmount, 0)
            const activeCustomerOrders = cOrders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled')
            const lastSale = cSales[0]
            const isExpanded = expandedId === c.id
            const hasShippingData = c.address || c.ci || c.phone

            return (
              <Card key={c.id}>
                <CardBody>
                  {/* Fila principal */}
                  <div className="flex items-center justify-between">
                    <div
                      className="flex items-center gap-3 flex-1 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : c.id!)}
                    >
                      <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-sm shrink-0 select-none">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900">{c.name}</p>
                          {activeCustomerOrders.length > 0 && (
                            <span className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 px-1.5 py-0.5 rounded-full">
                              {activeCustomerOrders.length} activo{activeCustomerOrders.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5 flex-wrap">
                          {c.ci && <span className="flex items-center gap-1"><CreditCard size={10} /> CI {c.ci}</span>}
                          {c.phone && <span className="flex items-center gap-1"><Phone size={10} /> {c.phone}</span>}
                          {c.address && <span className="flex items-center gap-1 truncate max-w-48"><MapPin size={10} /> {c.address}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div
                        className="text-right cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : c.id!)}
                      >
                        <p className="text-sm font-semibold text-gray-900">{fmtPYG(totalSpent)}</p>
                        <p className="text-xs text-gray-400">{cSales.length} venta{cSales.length !== 1 ? 's' : ''}</p>
                      </div>
                      <div
                        className="text-right min-w-[80px] cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : c.id!)}
                      >
                        {lastSale ? (
                          <>
                            <p className="text-xs text-gray-600">{fmtDate(lastSale.date)}</p>
                            <p className="text-xs text-gray-400">última compra</p>
                          </>
                        ) : (
                          <p className="text-xs text-gray-400">Sin compras</p>
                        )}
                      </div>

                      {/* Acciones */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(c)}
                          className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                          title="Editar cliente"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => hasShippingData ? generateLabel(c) : openEdit(c)}
                          className={`p-1.5 rounded-lg transition-colors ${hasShippingData ? 'text-violet-400 hover:bg-violet-50 hover:text-violet-600' : 'text-gray-300 hover:bg-gray-100 hover:text-gray-500'}`}
                          title={hasShippingData ? 'Generar etiqueta de envío' : 'Completar datos para generar etiqueta'}
                        >
                          <Printer size={14} />
                        </button>
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : c.id!)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Historial expandido */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                      {/* Datos de envío */}
                      <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">Cédula de identidad</p>
                          <p className="font-medium text-gray-700">{c.ci || <span className="text-gray-300 italic">No registrada</span>}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">Teléfono</p>
                          <p className="font-medium text-gray-700">{c.phone || <span className="text-gray-300 italic">No registrado</span>}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">Dirección</p>
                          <p className="font-medium text-gray-700">{c.address || <span className="text-gray-300 italic">No registrada</span>}</p>
                        </div>
                        {c.notes && (
                          <div className="col-span-3">
                            <p className="text-xs text-gray-400 mb-0.5">Notas</p>
                            <p className="text-gray-600 italic text-xs">{c.notes}</p>
                          </div>
                        )}
                      </div>

                      {/* Pedidos activos */}
                      {activeCustomerOrders.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                            <Clock size={11} /> Pedidos en curso
                          </p>
                          <div className="space-y-1">
                            {activeCustomerOrders.map(o => (
                              <div key={o.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50">
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-500">{fmtDate(o.orderDate)}</span>
                                  {o.customerAddress && (
                                    <span className="text-xs text-gray-400 flex items-center gap-0.5">
                                      <MapPin size={10} /> {o.customerAddress}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3">
                                  <Badge color={o.status === 'pending' ? 'yellow' : o.status === 'preparing' ? 'blue' : 'violet'}>
                                    {localOrderStatusLabels[o.status]}
                                  </Badge>
                                  <span className="font-semibold text-gray-900">{fmtPYG(o.totalAmount)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Historial de ventas */}
                      {cSales.length > 0 ? (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                            <ShoppingBag size={11} /> Historial de compras
                          </p>
                          <div className="space-y-1">
                            {cSales.slice(0, 8).map(s => (
                              <div key={s.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                                <div className="flex items-center gap-3">
                                  <span className="text-gray-500 w-20 shrink-0">{fmtDate(s.date)}</span>
                                  <span className="text-xs text-gray-400">{paymentLabels[s.paymentMethod] ?? s.paymentMethod}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-green-600">+{fmtPYG(s.totalProfit)}</span>
                                  <span className="font-semibold text-gray-900 w-28 text-right">{fmtPYG(s.totalAmount)}</span>
                                </div>
                              </div>
                            ))}
                            {cSales.length > 8 && (
                              <p className="text-xs text-gray-400 pt-1">y {cSales.length - 8} compra{cSales.length - 8 > 1 ? 's' : ''} más...</p>
                            )}
                          </div>
                          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-sm">
                            <span className="text-gray-500">Total gastado</span>
                            <span className="font-bold text-gray-900">{fmtPYG(totalSpent)}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400">Sin historial de compras completadas</p>
                      )}

                      {/* Acciones de fila expandida */}
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="secondary" icon={<Edit2 size={13} />} onClick={() => openEdit(c)}>
                          Editar datos
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<Printer size={13} />}
                          onClick={() => hasShippingData ? generateLabel(c) : openEdit(c)}
                        >
                          {hasShippingData ? 'Generar etiqueta' : 'Completar para etiquetar'}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal editar cliente */}
      <Modal isOpen={!!editCustomer} onClose={() => setEditCustomer(null)} title="Editar cliente">
        {editCustomer && (
          <div className="space-y-4">
            <Input
              label="Nombre completo"
              value={editForm.name}
              onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Cédula de identidad (CI)"
                value={editForm.ci}
                onChange={e => setEditForm(f => ({ ...f, ci: e.target.value }))}
                placeholder="Ej: 4.567.890"
              />
              <Input
                label="Teléfono"
                value={editForm.phone}
                onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="Ej: 0981-555-123"
              />
            </div>
            <Input
              label="Dirección"
              value={editForm.address}
              onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
              placeholder="Ej: Av. España 1234, Asunción"
            />
            <Textarea
              label="Notas internas (opcional)"
              value={editForm.notes}
              onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="Preferencias, referencias, etc."
            />
            <div className="bg-violet-50 rounded-lg p-3 text-xs text-violet-700 space-y-0.5">
              <p className="font-medium">Datos para etiqueta de envío</p>
              <p className="text-violet-600">CI, teléfono y dirección se usan para generar el levante para transportadoras.</p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="secondary" className="flex-1" onClick={() => setEditCustomer(null)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleSaveCustomer} disabled={!editForm.name.trim()}>Guardar</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
