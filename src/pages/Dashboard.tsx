import { useLiveQuery } from 'dexie-react-hooks'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { ShoppingCart, Package, TrendingUp, AlertTriangle, Clock, DollarSign } from 'lucide-react'
import { db } from '../db/db'
import { fmtPYG, today } from '../lib/format'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { format, subDays } from 'date-fns'

export function Dashboard() {
  const accounts = useLiveQuery(() => db.accounts.filter(a => a.isActive !== false).toArray()) ?? []
  const products = useLiveQuery(() => db.products.toArray()) ?? []
  const sales = useLiveQuery(() => db.sales.orderBy('date').reverse().limit(50).toArray()) ?? []
  const localOrders = useLiveQuery(() => db.localOrders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').toArray()) ?? []
  const movements = useLiveQuery(() => db.movements.orderBy('date').reverse().limit(10).toArray()) ?? []

  const todayStr = today()
  const currentMonth = todayStr.slice(0, 7)

  const todaySales = sales.filter(s => s.date === todayStr)
  const monthSales = sales.filter(s => s.date.startsWith(currentMonth))
  const totalCapital = accounts.reduce((s, a) => s + a.balance, 0)
  const monthRevenue = monthSales.reduce((s, sale) => s + sale.totalAmount, 0)
  const monthProfit = monthSales.reduce((s, sale) => s + sale.totalProfit, 0)
  const todayRevenue = todaySales.reduce((s, sale) => s + sale.totalAmount, 0)

  const lowStock = products.filter(p => p.stockSealed <= p.minStock && p.type === 'sealed')
  const pendingOrders = localOrders.filter(o => o.status === 'pending').length
  const preparingOrders = localOrders.filter(o => o.status === 'preparing').length

  // Chart: last 7 days sales
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd')
    const daySales = sales.filter(s => s.date === d)
    return {
      label: format(subDays(new Date(), 6 - i), 'dd/MM'),
      ventas: daySales.reduce((s, x) => s + x.totalAmount, 0),
      utilidad: daySales.reduce((s, x) => s + x.totalProfit, 0),
    }
  })

  // Top products (by sale count from saleItems would be ideal, using sales as proxy)
  const topBrands: Record<string, number> = {}
  products.forEach(p => {
    topBrands[p.brand] = (topBrands[p.brand] || 0) + 1
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString('es-PY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
          <DollarSign size={16} className="text-violet-600" />
          <div>
            <p className="text-xs text-violet-600 font-medium">Capital total</p>
            <p className="text-lg font-bold text-violet-700">{fmtPYG(totalCapital)}</p>
          </div>
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2 text-gray-500">
            <ShoppingCart size={15} />
            <span className="text-sm">Ventas hoy</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{fmtPYG(todayRevenue)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{todaySales.length} venta{todaySales.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2 text-gray-500">
            <TrendingUp size={15} />
            <span className="text-sm">Ingresos del mes</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{fmtPYG(monthRevenue)}</p>
          <p className="text-xs text-green-500 mt-0.5">Utilidad: {fmtPYG(monthProfit)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2 text-gray-500">
            <Package size={15} />
            <span className="text-sm">Productos</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{products.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">{products.reduce((s, p) => s + p.stockSealed, 0)} sellados en stock</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2 text-gray-500">
            <Clock size={15} />
            <span className="text-sm">Pedidos activos</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{localOrders.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">{pendingOrders} pendientes · {preparingOrders} preparando</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Gráfico ventas 7 días */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <h3 className="font-semibold text-gray-900">Ventas — últimos 7 días</h3>
          </CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={last7} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `${Math.round(v / 1000)}k`} />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={((value: unknown, name: unknown) => [fmtPYG(Number(value ?? 0)), name === 'ventas' ? 'Ventas' : 'Utilidad']) as any}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e4e2f0', fontSize: 12 }}
                />
                <Bar dataKey="ventas" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                <Bar dataKey="utilidad" fill="#a78bfa" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        {/* Alertas */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900">Alertas</h3>
          </CardHeader>
          <CardBody className="space-y-3">
            {lowStock.length === 0 && localOrders.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-gray-400">Sin alertas activas</p>
              </div>
            ) : (
              <>
                {lowStock.slice(0, 5).map(p => (
                  <div key={p.id} className="flex items-center gap-3 p-2.5 bg-orange-50 rounded-lg">
                    <AlertTriangle size={16} className="text-orange-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-orange-800 truncate">{p.name}</p>
                      <p className="text-xs text-orange-600">Stock: {p.stockSealed} u. (mín. {p.minStock})</p>
                    </div>
                  </div>
                ))}
                {localOrders.slice(0, 3).map(o => (
                  <div key={o.id} className="flex items-center gap-3 p-2.5 bg-blue-50 rounded-lg">
                    <Clock size={16} className="text-blue-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-blue-800 truncate">{o.customerName}</p>
                      <p className="text-xs text-blue-600">{o.status === 'pending' ? 'Pendiente' : 'En preparación'} · {fmtPYG(o.totalAmount)}</p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Últimos movimientos */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900">Últimos movimientos</h3>
          </CardHeader>
          {movements.length === 0 ? (
            <CardBody className="text-center py-8 text-gray-400 text-sm">Sin movimientos registrados</CardBody>
          ) : (
            <div>
              {movements.slice(0, 6).map(m => (
                <div key={m.id} className="flex items-center justify-between px-5 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900 truncate">{m.description}</p>
                    <p className="text-xs text-gray-400">{m.date}</p>
                  </div>
                  <span className={`text-sm font-semibold ml-3 shrink-0 ${m.type === 'income' ? 'text-green-600' : m.type === 'expense' ? 'text-red-600' : 'text-violet-600'}`}>
                    {m.type === 'income' ? '+' : m.type === 'expense' ? '−' : '↔'}{fmtPYG(m.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Cuentas resumen */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900">Saldos por cuenta</h3>
          </CardHeader>
          {accounts.length === 0 ? (
            <CardBody className="text-center py-8 text-gray-400 text-sm">Sin cuentas creadas</CardBody>
          ) : (
            <CardBody className="space-y-3">
              {accounts.map(a => (
                <div key={a.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-violet-400" />
                    <span className="text-sm text-gray-700">{a.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{fmtPYG(a.balance)}</p>
                    <p className="text-xs text-gray-400">{Math.round(a.balance / Math.max(totalCapital, 1) * 100)}% del total</p>
                  </div>
                </div>
              ))}
              <div className="border-t border-gray-100 pt-2 flex justify-between font-bold text-sm">
                <span className="text-gray-700">Total</span>
                <span className="text-violet-700">{fmtPYG(totalCapital)}</span>
              </div>
            </CardBody>
          )}
        </Card>
      </div>
    </div>
  )
}
