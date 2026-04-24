'use client'

import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

interface MonthPoint {
  mes:       string   // "Ene", "Feb", ...
  ingresos:  number
  gastos:    number
  resultado: number
}

interface CuentaClave {
  name:    string
  saldo:   number
  color:   string
}

interface Props {
  evolucion:    MonthPoint[]
  cuentasClave: CuentaClave[]
}

const MES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function fmtK(v: number) {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`
  return `$${v}`
}

function fmtCLP(v: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v)
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-border rounded-lg p-3 text-xs shadow-xl">
      <p className="font-semibold text-text-primary mb-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="flex justify-between gap-4">
          <span>{p.name}</span>
          <span className="font-mono font-semibold">{fmtCLP(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

export function DashboardCharts({ evolucion, cuentasClave }: Props) {
  if (evolucion.length === 0 && cuentasClave.length === 0) return null

  return (
    <div className="space-y-6">
      {/* Gráfico de barras: Ingresos vs Gastos por mes */}
      {evolucion.length > 0 && (
        <div className="card p-5">
          <p className="text-xs font-semibold text-text-disabled uppercase tracking-wider mb-4">
            Ingresos vs Gastos — últimos meses
          </p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={evolucion} barSize={14} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#666' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#555' }} axisLine={false} tickLine={false} width={52} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff08' }} />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  formatter={(v) => <span style={{ color: '#888' }}>{v}</span>}
                />
                <Bar dataKey="ingresos" name="Ingresos"  fill="#4CAF50" radius={[3, 3, 0, 0]} />
                <Bar dataKey="gastos"   name="Gastos"    fill="#E53935" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Gráfico de línea: Resultado neto */}
      {evolucion.length > 1 && (
        <div className="card p-5">
          <p className="text-xs font-semibold text-text-disabled uppercase tracking-wider mb-4">
            Evolución del resultado mensual
          </p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucion}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#666' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#555' }} axisLine={false} tickLine={false} width={52} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#333' }} />
                <Line
                  type="monotone"
                  dataKey="resultado"
                  name="Resultado"
                  stroke="#d4a017"
                  strokeWidth={2}
                  dot={{ fill: '#d4a017', r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Saldos de cuentas clave */}
      {cuentasClave.length > 0 && (
        <div className="card p-5">
          <p className="text-xs font-semibold text-text-disabled uppercase tracking-wider mb-4">
            Saldos cuentas clave
          </p>
          <div className="space-y-3">
            {cuentasClave.map((c, i) => {
              const max = Math.max(...cuentasClave.map(x => Math.abs(x.saldo)))
              const pct = max > 0 ? (Math.abs(c.saldo) / max) * 100 : 0
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-text-secondary">{c.name}</span>
                    <span className={`text-xs font-mono font-semibold ${c.saldo < 0 ? 'text-error' : ''}`}
                      style={c.saldo >= 0 ? { color: c.color } : {}}>
                      {fmtCLP(c.saldo)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-surface-high rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: c.saldo < 0 ? '#E53935' : c.color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
