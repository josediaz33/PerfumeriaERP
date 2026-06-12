import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { TrendingUp, RefreshCw, PiggyBank, User, ArrowDownCircle, ArrowUpCircle, ChevronDown, ChevronUp, BarChart2 } from 'lucide-react'
import { db } from '../db/db'
import type { UtilityDistribution } from '../db/types'
import { fmtPYG, fmtDate, today, nowISO } from '../lib/format'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Input, Select } from '../components/ui/Input'

function fmtMonth(ym: string) {
  const [y, m] = ym.split('-')
  const names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${names[parseInt(m) - 1]} '${y.slice(2)}`
}

export function Utilidades() {
  const sales = useLiveQuery(() => db.sales.orderBy('date').reverse().toArray()) ?? []
  const accounts = useLiveQuery(() => db.accounts.filter(a => a.isActive !== false).toArray()) ?? []
  const distributions = useLiveQuery(() => db.utilityDistributions.orderBy('startDate').reverse().toArray()) ?? []
  const personalMovements = useLiveQuery(() =>
    db.movements
      .filter(m => m.category === 'personal_withdrawal' || m.category === 'personal_return')
      .toArray()
      .then(arr => arr.sort((a, b) => b.date.localeCompare(a.date)))
  ) ?? []

  const [restockPct, setRestockPct] = useState('40')
  const [reinvestPct, setReinvestPct] = useState('30')
  const [personalPct, setPersonalPct] = useState('30')
  const [showDistribute, setShowDistribute] = useState(false)
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [showReturn, setShowReturn] = useState(false)
  const [showPersonalDetail, setShowPersonalDetail] = useState(false)
  const [showSalesDetail, setShowSalesDetail] = useState(false)
  const [salesFilterMonth, setSalesFilterMonth] = useState('all')
  const [selectedDist, setSelectedDist] = useState<UtilityDistribution | null>(null)

  const [distForm, setDistForm] = useState({
    startDate: today().slice(0, 7) + '-01',
    endDate: today(),
    label: new Date().toLocaleDateString('es-PY', { month: 'long', year: 'numeric' }),
    restockPct: '40', reinvestPct: '30', personalPct: '30',
  })
  const [withdrawForm, setWithdrawForm] = useState({ amount: '', accountId: '', description: 'Retiro de ganancia personal' })
  const [returnForm, setReturnForm] = useState({ amount: '', accountId: '', description: 'Devolución al negocio' })

  // ── Personal balance ─────────────────────────────────────────────────────────
  const totalWithdrawn = personalMovements.filter(m => m.category === 'personal_withdrawal').reduce((s, m) => s + m.amount, 0)
  const totalReturned = personalMovements.filter(m => m.category === 'personal_return').reduce((s, m) => s + m.amount, 0)
  const personalDebt = totalWithdrawn - totalReturned

  // ── Core aggregates ──────────────────────────────────────────────────────────
  const currentMonth = today().slice(0, 7)
  const monthSales = sales.filter(s => s.date.startsWith(currentMonth))
  const monthProfit = monthSales.reduce((s, x) => s + x.totalProfit, 0)
  const totalRevenue = sales.reduce((s, x) => s + x.totalAmount, 0)
  const totalProfit = sales.reduce((s, x) => s + x.totalProfit, 0)
  const totalDistributed = distributions.reduce((s, d) => s + d.grossProfit, 0)
  const undistributed = totalProfit - totalDistributed
  const overallMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0
  const avgTicket = sales.length > 0 ? Math.round(totalRevenue / sales.length) : 0

  const restockAmount = undistributed * (parseFloat(restockPct) / 100)
  const reinvestAmount = undistributed * (parseFloat(reinvestPct) / 100)
  const personalAmount = undistributed * (parseFloat(personalPct) / 100)
  const totalPct = parseFloat(restockPct) + parseFloat(reinvestPct) + parseFloat(personalPct)

  // Deuda descontada de la porción personal (calculadora en tiempo real)
  const calcDebtCovered = Math.min(personalDebt, personalAmount)
  const calcNetPersonal = Math.max(0, personalAmount - personalDebt)

  // Porción personal para el modal de distribución (basada en el período del formulario)
  const distPeriodSales = sales.filter(s => s.date >= distForm.startDate && s.date <= distForm.endDate)
  const distGrossProfit = distPeriodSales.reduce((s, x) => s + x.totalProfit, 0)
  const distPersonalAmount = distGrossProfit * (parseFloat(distForm.personalPct || '0') / 100)
  const distDebtCovered = Math.min(personalDebt, distPersonalAmount)
  const distNetPersonal = Math.max(0, distPersonalAmount - personalDebt)

  // ── Monthly breakdown ────────────────────────────────────────────────────────
  const monthlyData = (() => {
    const map = new Map<string, { revenue: number; cost: number; profit: number; count: number }>()
    for (const s of sales) {
      const m = s.date.slice(0, 7)
      const prev = map.get(m) ?? { revenue: 0, cost: 0, profit: 0, count: 0 }
      map.set(m, {
        revenue: prev.revenue + s.totalAmount,
        cost: prev.cost + s.totalCost,
        profit: prev.profit + s.totalProfit,
        count: prev.count + 1,
      })
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([month, d]) => ({ month, ...d, margin: d.revenue > 0 ? Math.round((d.profit / d.revenue) * 100) : 0 }))
  })()

  const maxMonthlyRevenue = Math.max(...monthlyData.map(m => m.revenue), 1)
  const bestMonth = monthlyData.length > 0
    ? monthlyData.reduce((best, m) => m.profit > best.profit ? m : best)
    : null

  // ── Sales detail table ───────────────────────────────────────────────────────
  const availableMonths = [...new Set(sales.map(s => s.date.slice(0, 7)))].sort().reverse()
  const displayedSales = salesFilterMonth === 'all'
    ? sales
    : sales.filter(s => s.date.startsWith(salesFilterMonth))

  // ── Distribution detail ──────────────────────────────────────────────────────
  const detailSales = selectedDist
    ? sales.filter(s => s.date >= selectedDist.startDate && s.date <= selectedDist.endDate)
      .sort((a, b) => b.date.localeCompare(a.date))
    : []
  const detailRevenue = detailSales.reduce((s, x) => s + x.totalAmount, 0)
  const detailCost = detailSales.reduce((s, x) => s + x.totalCost, 0)
  const detailMargin = detailRevenue > 0 ? Math.round(((detailRevenue - detailCost) / detailRevenue) * 100) : 0

  // ── Handlers ─────────────────────────────────────────────────────────────────
  async function handleDistribute() {
    const start = distForm.startDate
    const end = distForm.endDate
    const periodSales = sales.filter(s => s.date >= start && s.date <= end)
    const grossProfit = periodSales.reduce((s, sale) => s + sale.totalProfit, 0)
    const rPct = parseFloat(distForm.restockPct) / 100
    const riPct = parseFloat(distForm.reinvestPct) / 100
    const pPct = parseFloat(distForm.personalPct) / 100
    await db.utilityDistributions.add({
      periodLabel: distForm.label,
      startDate: start, endDate: end,
      grossProfit,
      restockPercent: parseFloat(distForm.restockPct),
      reinvestPercent: parseFloat(distForm.reinvestPct),
      personalPercent: parseFloat(distForm.personalPct),
      restockAmount: grossProfit * rPct,
      reinvestAmount: grossProfit * riPct,
      personalAmount: grossProfit * pPct,
      personalWithdrawn: 0,
      createdAt: nowISO(),
    })
    setShowDistribute(false)
  }

  async function handleWithdraw() {
    const amount = parseFloat(withdrawForm.amount)
    const accId = parseInt(withdrawForm.accountId)
    if (!amount || !accId) return
    const now = nowISO()
    await db.transaction('rw', db.movements, db.accounts, async () => {
      await db.movements.add({
        type: 'expense', category: 'personal_withdrawal',
        amount, accountId: accId,
        description: withdrawForm.description,
        date: today(), createdAt: now,
      })
      await db.accounts.where('id').equals(accId).modify(a => { a.balance -= amount })
    })
    setWithdrawForm({ amount: '', accountId: '', description: 'Retiro de ganancia personal' })
    setShowWithdraw(false)
  }

  async function handleReturn() {
    const amount = parseFloat(returnForm.amount)
    const accId = parseInt(returnForm.accountId)
    if (!amount || !accId) return
    const now = nowISO()
    await db.transaction('rw', db.movements, db.accounts, async () => {
      await db.movements.add({
        type: 'income', category: 'personal_return',
        amount, accountId: accId,
        description: returnForm.description,
        date: today(), createdAt: now,
      })
      await db.accounts.where('id').equals(accId).modify(a => { a.balance += amount })
    })
    setReturnForm({ amount: '', accountId: '', description: 'Devolución al negocio' })
    setShowReturn(false)
  }

  return (
    <div>
      <PageHeader
        title="Utilidades"
        subtitle="Distribución de ganancias entre reposición, reinversión y retiro personal"
      />

      {/* KPIs — 6 cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Utilidad acumulada</p>
          <p className="text-xl font-bold text-gray-900">{fmtPYG(totalProfit)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{sales.length} ventas totales</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
          <p className="text-xs text-green-600 mb-1">Este mes</p>
          <p className="text-xl font-bold text-green-700">{fmtPYG(monthProfit)}</p>
          <p className="text-xs text-green-500 mt-0.5">{monthSales.length} ventas</p>
        </div>
        <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
          <p className="text-xs text-violet-600 mb-1">Distribuido</p>
          <p className="text-xl font-bold text-violet-700">{fmtPYG(totalDistributed)}</p>
          <p className="text-xs text-violet-400 mt-0.5">{distributions.length} períodos</p>
        </div>
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
          <p className="text-xs text-orange-600 mb-1">Sin distribuir</p>
          <p className="text-xl font-bold text-orange-700">{fmtPYG(undistributed)}</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-xs text-blue-600 mb-1">Margen promedio</p>
          <p className="text-xl font-bold text-blue-700">{overallMargin}%</p>
          <p className="text-xs text-blue-400 mt-0.5">sobre ingresos</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Ticket promedio</p>
          <p className="text-xl font-bold text-gray-900">{fmtPYG(avgTicket)}</p>
        </div>
      </div>

      {/* Balance personal */}
      <div className="mb-6">
        <button
          onClick={() => setShowPersonalDetail(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <User size={16} className="text-violet-500" />
            <span className="font-semibold text-gray-900">Balance personal</span>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-red-500">↓ {fmtPYG(totalWithdrawn)} retirado</span>
              <span className="text-green-600">↑ {fmtPYG(totalReturned)} devuelto</span>
              <span className={`font-semibold ${personalDebt > 0 ? 'text-orange-600' : 'text-green-700'}`}>
                {personalDebt > 0 ? `Debe ${fmtPYG(personalDebt)}` : personalDebt < 0 ? `A favor ${fmtPYG(-personalDebt)}` : 'Al día'}
              </span>
            </div>
          </div>
          {showPersonalDetail ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>

        {showPersonalDetail && (
          <Card className="mt-1 rounded-t-none border-t-0">
            <CardBody>
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
                  <p className="text-xs text-red-500 mb-0.5">Total retirado</p>
                  <p className="font-bold text-red-700">{fmtPYG(totalWithdrawn)}</p>
                  <p className="text-xs text-red-400 mt-0.5">{personalMovements.filter(m => m.category === 'personal_withdrawal').length} retiros</p>
                </div>
                <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
                  <p className="text-xs text-green-600 mb-0.5">Total devuelto</p>
                  <p className="font-bold text-green-700">{fmtPYG(totalReturned)}</p>
                  <p className="text-xs text-green-400 mt-0.5">{personalMovements.filter(m => m.category === 'personal_return').length} devoluciones</p>
                </div>
                <div className={`${personalDebt > 0 ? 'bg-orange-50 border-orange-100' : 'bg-violet-50 border-violet-100'} border rounded-xl p-3 text-center`}>
                  <p className={`text-xs mb-0.5 ${personalDebt > 0 ? 'text-orange-600' : 'text-violet-600'}`}>Saldo pendiente</p>
                  <p className={`font-bold ${personalDebt > 0 ? 'text-orange-700' : 'text-violet-700'}`}>{fmtPYG(Math.abs(personalDebt))}</p>
                  <p className={`text-xs mt-0.5 ${personalDebt > 0 ? 'text-orange-400' : 'text-violet-400'}`}>{personalDebt > 0 ? 'a devolver' : personalDebt < 0 ? 'a favor' : 'al día'}</p>
                </div>
              </div>

              {/* Historial */}
              {personalMovements.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-4">No hay retiros ni devoluciones registrados</p>
              ) : (
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs">Fecha</th>
                        <th className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs">Descripción</th>
                        <th className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs">Cuenta</th>
                        <th className="text-right px-4 py-2.5 text-gray-500 font-medium text-xs">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {personalMovements.map(m => {
                        const account = accounts.find(a => a.id === m.accountId)
                        const isReturn = m.category === 'personal_return'
                        return (
                          <tr key={m.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                            <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">{fmtDate(m.date)}</td>
                            <td className="px-4 py-2.5 text-gray-700">
                              <div className="flex items-center gap-1.5">
                                {isReturn
                                  ? <ArrowUpCircle size={13} className="text-green-500 shrink-0" />
                                  : <ArrowDownCircle size={13} className="text-red-400 shrink-0" />
                                }
                                {m.description}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-gray-400 text-xs">{account?.name ?? '—'}</td>
                            <td className={`px-4 py-2.5 text-right font-semibold ${isReturn ? 'text-green-600' : 'text-red-500'}`}>
                              {isReturn ? '+' : '−'} {fmtPYG(m.amount)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        )}
      </div>

      {/* Evolución mensual */}
      {monthlyData.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <BarChart2 size={16} className="text-violet-500" />
                  Evolución mensual
                </h3>
                {bestMonth && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Mejor mes: <span className="font-medium text-gray-700">{fmtMonth(bestMonth.month)}</span> — {fmtPYG(bestMonth.profit)} de ganancia
                  </p>
                )}
              </div>
            </div>
          </CardHeader>
          <CardBody className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500">
                  <th className="text-left py-2 pr-4 font-medium w-20">Mes</th>
                  <th className="text-left py-2 font-medium min-w-32">Ingresos</th>
                  <th className="text-left py-2 font-medium min-w-32">Costos</th>
                  <th className="text-left py-2 font-medium min-w-32">Ganancia</th>
                  <th className="text-right py-2 pr-2 font-medium w-16">Margen</th>
                  <th className="text-right py-2 font-medium w-16">Ventas</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map(m => (
                  <tr key={m.month} className={`border-b border-gray-50 ${m.month === currentMonth ? 'bg-violet-50/50' : ''}`}>
                    <td className="py-2.5 pr-4 font-medium text-gray-700 whitespace-nowrap">
                      {fmtMonth(m.month)}
                      {m.month === currentMonth && <span className="ml-1 text-[10px] text-violet-500 font-semibold">actual</span>}
                    </td>
                    <td className="py-2.5 pr-6">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-300 rounded-full"
                            style={{ width: `${Math.round((m.revenue / maxMonthlyRevenue) * 100)}%` }}
                          />
                        </div>
                        <span className="text-gray-700 text-xs whitespace-nowrap">{fmtPYG(m.revenue)}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-6">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-300 rounded-full"
                            style={{ width: `${Math.round((m.cost / maxMonthlyRevenue) * 100)}%` }}
                          />
                        </div>
                        <span className="text-gray-500 text-xs whitespace-nowrap">{fmtPYG(m.cost)}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-6">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-400 rounded-full"
                            style={{ width: `${Math.round((m.profit / maxMonthlyRevenue) * 100)}%` }}
                          />
                        </div>
                        <span className="font-semibold text-green-700 text-xs whitespace-nowrap">{fmtPYG(m.profit)}</span>
                      </div>
                    </td>
                    <td className={`py-2.5 pr-2 text-right text-xs font-semibold ${m.margin >= 40 ? 'text-green-700' : m.margin >= 20 ? 'text-orange-600' : 'text-red-600'}`}>
                      {m.margin}%
                    </td>
                    <td className="py-2.5 text-right text-xs text-gray-400">{m.count}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50/50">
                  <td className="py-2.5 pr-4 text-xs font-bold text-gray-700">Total</td>
                  <td className="py-2.5 pr-6 text-xs font-semibold text-gray-700">{fmtPYG(totalRevenue)}</td>
                  <td className="py-2.5 pr-6 text-xs font-semibold text-gray-500">{fmtPYG(totalRevenue - totalProfit)}</td>
                  <td className="py-2.5 pr-6 text-xs font-bold text-green-700">{fmtPYG(totalProfit)}</td>
                  <td className="py-2.5 pr-2 text-right text-xs font-bold text-gray-700">{overallMargin}%</td>
                  <td className="py-2.5 text-right text-xs font-semibold text-gray-500">{sales.length}</td>
                </tr>
              </tfoot>
            </table>
          </CardBody>
        </Card>
      )}

      {/* Calculadora + Resumen visual */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900">Calculadora de distribución</h3>
            <p className="text-sm text-gray-500 mt-0.5">Sobre la utilidad pendiente de distribuir</p>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="space-y-3">
              {[
                { label: 'Reposición de stock', pct: restockPct, setPct: setRestockPct, icon: RefreshCw, color: 'blue' as const, amount: restockAmount },
                { label: 'Reinversión en el negocio', pct: reinvestPct, setPct: setReinvestPct, icon: TrendingUp, color: 'green' as const, amount: reinvestAmount },
                { label: 'Ganancia personal', pct: personalPct, setPct: setPersonalPct, icon: User, color: 'violet' as const, amount: personalAmount },
              ].map(({ label, pct, setPct, icon: Icon, color, amount }) => (
                <div key={label} className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${color === 'blue' ? 'bg-blue-50' : color === 'green' ? 'bg-green-50' : 'bg-violet-50'}`}>
                    <Icon size={16} className={color === 'blue' ? 'text-blue-600' : color === 'green' ? 'text-green-600' : 'text-violet-600'} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700">{label}</p>
                    <p className="text-xs text-gray-400">{fmtPYG(Math.round(amount))}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min="0" max="100"
                      className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-violet-500"
                      value={pct}
                      onChange={e => setPct(e.target.value)}
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                </div>
              ))}
            </div>
            {personalDebt > 0 && personalAmount > 0 && (
              <div className="bg-orange-50 border border-orange-100 rounded-xl px-3 py-2.5 text-xs space-y-1.5">
                <p className="text-orange-700 font-semibold mb-0.5">Deuda personal activa · {fmtPYG(Math.round(personalDebt))}</p>
                <div className="flex justify-between text-gray-500">
                  <span>Porción personal bruta</span>
                  <span>{fmtPYG(Math.round(personalAmount))}</span>
                </div>
                <div className="flex justify-between text-red-500">
                  <span>Cubre deuda pendiente</span>
                  <span>−{fmtPYG(Math.round(calcDebtCovered))}</span>
                </div>
                <div className={`flex justify-between font-semibold pt-1 border-t border-orange-200 ${calcNetPersonal > 0 ? 'text-violet-700' : 'text-red-600'}`}>
                  <span>Neto personal disponible</span>
                  <span>{fmtPYG(Math.round(calcNetPersonal))}</span>
                </div>
                {personalDebt > personalAmount && (
                  <p className="text-orange-500">Deuda restante sin cubrir: {fmtPYG(Math.round(personalDebt - personalAmount))}</p>
                )}
              </div>
            )}
            {totalPct !== 100 && (
              <p className={`text-sm ${totalPct > 100 ? 'text-red-500' : 'text-orange-500'}`}>
                Los porcentajes suman {totalPct}% (deben sumar 100%)
              </p>
            )}
            <div className="border-t border-gray-100 pt-3 flex gap-2">
              <Button className="flex-1" onClick={() => setShowDistribute(true)} disabled={totalPct !== 100}>
                Registrar distribución
              </Button>
              <Button variant="secondary" icon={<ArrowDownCircle size={15} />} onClick={() => setShowWithdraw(true)}>
                Retirar
              </Button>
              <Button variant="secondary" icon={<ArrowUpCircle size={15} />} onClick={() => setShowReturn(true)}>
                Devolver
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><h3 className="font-semibold text-gray-900">Resumen visual</h3></CardHeader>
          <CardBody>
            <div className="flex h-8 rounded-full overflow-hidden mb-4">
              <div style={{ width: `${restockPct}%` }} className="bg-blue-400 transition-all" />
              <div style={{ width: `${reinvestPct}%` }} className="bg-green-400 transition-all" />
              <div style={{ width: `${personalPct}%` }} className="bg-violet-500 transition-all" />
            </div>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Reposición', pct: restockPct, amount: restockAmount, color: 'bg-blue-400' },
                { label: 'Reinversión', pct: reinvestPct, amount: reinvestAmount, color: 'bg-green-400' },
                { label: 'Ganancia personal', pct: personalPct, amount: personalAmount, color: 'bg-violet-500' },
              ].map(({ label, pct, amount, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${color}`} />
                    <span className="text-gray-600">{label} ({pct}%)</span>
                  </div>
                  <span className="font-semibold text-gray-900">{fmtPYG(Math.round(amount))}</span>
                </div>
              ))}
              <div className="border-t border-gray-100 pt-2 flex justify-between font-bold">
                <span>Total sin distribuir</span>
                <span>{fmtPYG(Math.round(undistributed))}</span>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Detalle de ventas — colapsable */}
      <div className="mb-6">
        <button
          onClick={() => setShowSalesDetail(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <TrendingUp size={16} className="text-violet-500" />
            <span className="font-semibold text-gray-900">Detalle de ventas</span>
            <span className="text-sm text-gray-400">
              {salesFilterMonth === 'all' ? `${sales.length} ventas totales` : `${displayedSales.length} ventas`}
              {' · '}
              {fmtPYG(displayedSales.reduce((s, x) => s + x.totalProfit, 0))} ganancia
            </span>
          </div>
          {showSalesDetail ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>

        {showSalesDetail && (
          <Card className="mt-1 rounded-t-none border-t-0">
            <CardBody className="pb-1">
              {/* Filtro mes */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-sm text-gray-500 shrink-0">Filtrar por mes:</span>
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    onClick={() => setSalesFilterMonth('all')}
                    className={`px-3 py-1 rounded-lg text-xs cursor-pointer transition-colors ${salesFilterMonth === 'all' ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    Todos
                  </button>
                  {availableMonths.map(m => (
                    <button
                      key={m}
                      onClick={() => setSalesFilterMonth(m)}
                      className={`px-3 py-1 rounded-lg text-xs cursor-pointer transition-colors ${salesFilterMonth === m ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {fmtMonth(m)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resumen del filtro */}
              {displayedSales.length > 0 && (
                <div className="grid grid-cols-4 gap-3 mb-4 text-center">
                  {[
                    { label: 'Ventas', value: String(displayedSales.length), color: 'text-gray-900' },
                    { label: 'Ingresos', value: fmtPYG(displayedSales.reduce((s, x) => s + x.totalAmount, 0)), color: 'text-gray-900' },
                    { label: 'Costos', value: fmtPYG(displayedSales.reduce((s, x) => s + x.totalCost, 0)), color: 'text-red-600' },
                    { label: 'Ganancia', value: fmtPYG(displayedSales.reduce((s, x) => s + x.totalProfit, 0)), color: 'text-green-700' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-gray-50 rounded-lg py-2 px-3">
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className={`font-semibold text-sm ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>

            {displayedSales.length === 0 ? (
              <CardBody className="text-center py-6 text-gray-400 text-sm">No hay ventas en este período</CardBody>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 border-t">
                      <th className="text-left px-5 py-2.5 text-gray-500 font-medium text-xs">Fecha</th>
                      <th className="text-left px-5 py-2.5 text-gray-500 font-medium text-xs">Cliente</th>
                      <th className="text-left px-5 py-2.5 text-gray-500 font-medium text-xs">Pago</th>
                      <th className="text-right px-5 py-2.5 text-gray-500 font-medium text-xs">Ingresos</th>
                      <th className="text-right px-5 py-2.5 text-gray-500 font-medium text-xs">Costos</th>
                      <th className="text-right px-5 py-2.5 text-gray-500 font-medium text-xs">Ganancia</th>
                      <th className="text-right px-5 py-2.5 text-gray-500 font-medium text-xs">Margen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedSales.map(s => {
                      const margin = s.totalAmount > 0 ? Math.round((s.totalProfit / s.totalAmount) * 100) : 0
                      return (
                        <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-2.5 text-gray-500 text-xs whitespace-nowrap">{fmtDate(s.date)}</td>
                          <td className="px-5 py-2.5 text-gray-900 font-medium">{s.customerName || '—'}</td>
                          <td className="px-5 py-2.5 text-gray-400 text-xs capitalize">{s.paymentMethod}</td>
                          <td className="px-5 py-2.5 text-right text-gray-700">{fmtPYG(s.totalAmount)}</td>
                          <td className="px-5 py-2.5 text-right text-red-500">{fmtPYG(s.totalCost)}</td>
                          <td className="px-5 py-2.5 text-right font-semibold text-green-700">{fmtPYG(s.totalProfit)}</td>
                          <td className={`px-5 py-2.5 text-right font-semibold text-xs ${margin >= 40 ? 'text-green-600' : margin >= 20 ? 'text-orange-500' : 'text-red-500'}`}>
                            {margin}%
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Historial distribuciones */}
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Historial de distribuciones</h2>
      <Card>
        {distributions.length === 0 ? (
          <CardBody className="text-center py-10">
            <PiggyBank size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400">No hay distribuciones registradas</p>
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Período</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">Utilidad bruta</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">Reposición</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">Reinversión</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">Personal</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">Ventas</th>
                </tr>
              </thead>
              <tbody>
                {distributions.map(d => {
                  const dSalesCount = sales.filter(s => s.date >= d.startDate && s.date <= d.endDate).length
                  return (
                    <tr
                      key={d.id}
                      className="border-b border-gray-50 hover:bg-violet-50/40 cursor-pointer transition-colors"
                      onClick={() => setSelectedDist(d)}
                    >
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900">{d.periodLabel}</p>
                        <p className="text-xs text-gray-400">{fmtDate(d.startDate)} — {fmtDate(d.endDate)}</p>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-900">{fmtPYG(d.grossProfit)}</td>
                      <td className="px-5 py-3 text-right text-blue-600">{fmtPYG(Math.round(d.restockAmount))} <span className="text-gray-400 text-xs">({d.restockPercent}%)</span></td>
                      <td className="px-5 py-3 text-right text-green-600">{fmtPYG(Math.round(d.reinvestAmount))} <span className="text-gray-400 text-xs">({d.reinvestPercent}%)</span></td>
                      <td className="px-5 py-3 text-right text-violet-600">{fmtPYG(Math.round(d.personalAmount))} <span className="text-gray-400 text-xs">({d.personalPercent}%)</span></td>
                      <td className="px-5 py-3 text-right text-gray-400 text-xs">{dSalesCount}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal detalle distribución */}
      <Modal
        isOpen={!!selectedDist}
        onClose={() => setSelectedDist(null)}
        title={selectedDist ? `Detalle — ${selectedDist.periodLabel}` : ''}
        size="xl"
      >
        {selectedDist && (
          <div className="space-y-4 text-sm">
            {/* Resumen distribución */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                <p className="text-xs text-gray-500">Período</p>
                <p className="font-medium text-gray-900">{fmtDate(selectedDist.startDate)} — {fmtDate(selectedDist.endDate)}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                <p className="text-xs text-gray-500">Utilidad registrada</p>
                <p className="font-bold text-gray-900">{fmtPYG(selectedDist.grossProfit)}</p>
              </div>
            </div>

            {/* Distribución */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-xs text-blue-600 mb-0.5">Reposición ({selectedDist.restockPercent}%)</p>
                <p className="font-semibold text-blue-800">{fmtPYG(Math.round(selectedDist.restockAmount))}</p>
              </div>
              <div className="bg-green-50 rounded-xl p-3">
                <p className="text-xs text-green-600 mb-0.5">Reinversión ({selectedDist.reinvestPercent}%)</p>
                <p className="font-semibold text-green-800">{fmtPYG(Math.round(selectedDist.reinvestAmount))}</p>
              </div>
              <div className="bg-violet-50 rounded-xl p-3">
                <p className="text-xs text-violet-600 mb-0.5">Personal ({selectedDist.personalPercent}%)</p>
                <p className="font-semibold text-violet-800">{fmtPYG(Math.round(selectedDist.personalAmount))}</p>
              </div>
            </div>

            {/* Ventas del período */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-gray-800">Ventas en el período ({detailSales.length})</p>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>Ingresos: <span className="font-semibold text-gray-700">{fmtPYG(detailRevenue)}</span></span>
                  <span>Costos: <span className="font-semibold text-red-600">{fmtPYG(detailCost)}</span></span>
                  <span>Margen: <span className={`font-semibold ${detailMargin >= 40 ? 'text-green-700' : detailMargin >= 20 ? 'text-orange-600' : 'text-red-600'}`}>{detailMargin}%</span></span>
                </div>
              </div>
              {detailSales.length === 0 ? (
                <p className="text-gray-400 text-center py-4 bg-gray-50 rounded-lg">
                  No hay ventas registradas en este período exacto.
                </p>
              ) : (
                <div className="border border-gray-100 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-4 py-2 text-gray-500 font-medium">Fecha</th>
                        <th className="text-left px-4 py-2 text-gray-500 font-medium">Cliente</th>
                        <th className="text-right px-4 py-2 text-gray-500 font-medium">Ingresos</th>
                        <th className="text-right px-4 py-2 text-gray-500 font-medium">Costos</th>
                        <th className="text-right px-4 py-2 text-gray-500 font-medium">Ganancia</th>
                        <th className="text-right px-4 py-2 text-gray-500 font-medium">Margen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailSales.map(s => {
                        const margin = s.totalAmount > 0 ? Math.round((s.totalProfit / s.totalAmount) * 100) : 0
                        return (
                          <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{fmtDate(s.date)}</td>
                            <td className="px-4 py-2 text-gray-900 font-medium">{s.customerName || '—'}</td>
                            <td className="px-4 py-2 text-right text-gray-700">{fmtPYG(s.totalAmount)}</td>
                            <td className="px-4 py-2 text-right text-red-500">{fmtPYG(s.totalCost)}</td>
                            <td className="px-4 py-2 text-right font-semibold text-green-700">{fmtPYG(s.totalProfit)}</td>
                            <td className={`px-4 py-2 text-right font-semibold ${margin >= 40 ? 'text-green-600' : margin >= 20 ? 'text-orange-500' : 'text-red-500'}`}>
                              {margin}%
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <Button variant="secondary" className="w-full" onClick={() => setSelectedDist(null)}>Cerrar</Button>
          </div>
        )}
      </Modal>

      {/* Modal distribución */}
      <Modal isOpen={showDistribute} onClose={() => setShowDistribute(false)} title="Registrar distribución de utilidades">
        <div className="space-y-4">
          <Input label="Etiqueta del período" value={distForm.label} onChange={e => setDistForm(f => ({ ...f, label: e.target.value }))} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Desde" type="date" value={distForm.startDate} onChange={e => setDistForm(f => ({ ...f, startDate: e.target.value }))} />
            <Input label="Hasta" type="date" value={distForm.endDate} onChange={e => setDistForm(f => ({ ...f, endDate: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="% Reposición" type="number" value={distForm.restockPct} onChange={e => setDistForm(f => ({ ...f, restockPct: e.target.value }))} />
            <Input label="% Reinversión" type="number" value={distForm.reinvestPct} onChange={e => setDistForm(f => ({ ...f, reinvestPct: e.target.value }))} />
            <Input label="% Personal" type="number" value={distForm.personalPct} onChange={e => setDistForm(f => ({ ...f, personalPct: e.target.value }))} />
          </div>
          {personalDebt > 0 && distPersonalAmount > 0 && (
            <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 text-xs space-y-1.5">
              <p className="font-semibold text-orange-700 mb-0.5">Deuda personal activa: {fmtPYG(Math.round(personalDebt))}</p>
              <div className="flex justify-between text-gray-600">
                <span>Porción personal de este período ({distForm.personalPct}%)</span>
                <span>{fmtPYG(Math.round(distPersonalAmount))}</span>
              </div>
              <div className="flex justify-between text-red-500">
                <span>Cubre deuda pendiente</span>
                <span>−{fmtPYG(Math.round(distDebtCovered))}</span>
              </div>
              <div className={`flex justify-between font-semibold pt-1 border-t border-orange-200 ${distNetPersonal > 0 ? 'text-violet-700' : 'text-orange-700'}`}>
                <span>Neto personal disponible</span>
                <span>{fmtPYG(Math.round(distNetPersonal))}</span>
              </div>
              {personalDebt > distPersonalAmount && (
                <p className="text-orange-500">Deuda restante sin cubrir: {fmtPYG(Math.round(personalDebt - distPersonalAmount))}</p>
              )}
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowDistribute(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleDistribute}>Registrar</Button>
          </div>
        </div>
      </Modal>

      {/* Modal devolución */}
      <Modal isOpen={showReturn} onClose={() => setShowReturn(false)} title="Registrar devolución al negocio">
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-sm text-green-700">
            Saldo pendiente actual: <span className="font-bold">{fmtPYG(Math.max(0, personalDebt))}</span>
            {personalDebt <= 0 && <span className="ml-1 text-green-500">(ya está al día)</span>}
          </div>
          <Input label="Monto a devolver (Gs.)" type="number" value={returnForm.amount} onChange={e => setReturnForm(f => ({ ...f, amount: e.target.value }))} />
          <Select
            label="Cuenta destino"
            value={returnForm.accountId}
            onChange={e => setReturnForm(f => ({ ...f, accountId: e.target.value }))}
            options={[{ value: '', label: 'Seleccionar...' }, ...accounts.map(a => ({ value: String(a.id), label: `${a.name} — ${fmtPYG(a.balance)}` }))]}
          />
          <Input label="Descripción" value={returnForm.description} onChange={e => setReturnForm(f => ({ ...f, description: e.target.value }))} />
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowReturn(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleReturn}>Registrar devolución</Button>
          </div>
        </div>
      </Modal>

      {/* Modal retiro */}
      <Modal isOpen={showWithdraw} onClose={() => setShowWithdraw(false)} title="Registrar retiro personal">
        <div className="space-y-4">
          <Input label="Monto (Gs.)" type="number" value={withdrawForm.amount} onChange={e => setWithdrawForm(f => ({ ...f, amount: e.target.value }))} />
          <Select
            label="Cuenta origen"
            value={withdrawForm.accountId}
            onChange={e => setWithdrawForm(f => ({ ...f, accountId: e.target.value }))}
            options={[{ value: '', label: 'Seleccionar...' }, ...accounts.map(a => ({ value: String(a.id), label: `${a.name} — ${fmtPYG(a.balance)}` }))]}
          />
          <Input label="Descripción" value={withdrawForm.description} onChange={e => setWithdrawForm(f => ({ ...f, description: e.target.value }))} />
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowWithdraw(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleWithdraw}>Registrar retiro</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
