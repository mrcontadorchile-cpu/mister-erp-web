'use client'

import { useState, useTransition } from 'react'
import { monthName } from '@/lib/utils'
import { openPeriod, closePeriod, reopenPeriod } from './actions'
import type { Period } from '@/types/database'

interface Props {
  periods: Period[]
  currentYear: number
}

export function PeriodosClient({ periods, currentYear }: Props) {
  const [year, setYear] = useState(currentYear)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const years = [currentYear - 1, currentYear, currentYear + 1]
  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  const periodMap = new Map(periods.map(p => [`${p.year}-${p.month}`, p]))

  const handleOpen = (month: number) => {
    setError('')
    startTransition(async () => {
      const r = await openPeriod(year, month)
      if (r.error) setError(r.error)
    })
  }

  const handleClose = (id: string) => {
    if (!confirm('¿Cerrar este período? No podrá modificar asientos en él.')) return
    startTransition(async () => {
      const r = await closePeriod(id)
      if (r.error) setError(r.error)
    })
  }

  const handleReopen = (id: string) => {
    if (!confirm('¿Reabrir este período?')) return
    startTransition(async () => {
      const r = await reopenPeriod(id)
      if (r.error) setError(r.error)
    })
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Períodos Contables</h1>
          <p className="text-text-secondary text-sm mt-1">Administra la apertura y cierre de períodos</p>
        </div>
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          className="input w-28 text-sm"
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {error && (
        <div className="bg-error/10 border border-error/20 text-error text-sm px-4 py-3 rounded-lg mb-5">
          {error}
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="table-header">
              <th className="px-5 py-3 text-left">Mes</th>
              <th className="px-5 py-3 text-center">Estado</th>
              <th className="px-5 py-3 text-right">Cerrado el</th>
              <th className="px-5 py-3 text-center w-40">Acción</th>
            </tr>
          </thead>
          <tbody>
            {months.map(month => {
              const key = `${year}-${month}`
              const period = periodMap.get(key)
              const isClosed = period?.status === 'closed'
              const isOpen = period?.status === 'open'

              return (
                <tr key={month} className="table-row">
                  <td className="px-5 py-3 font-medium text-text-primary">
                    {monthName(month)} {year}
                  </td>
                  <td className="px-5 py-3 text-center">
                    {!period ? (
                      <span className="badge bg-surface-high text-text-disabled">Sin abrir</span>
                    ) : isClosed ? (
                      <span className="badge bg-error/10 text-error">Cerrado</span>
                    ) : (
                      <span className="badge bg-success/10 text-success">
                        <span className="w-1.5 h-1.5 bg-success rounded-full mr-1 inline-block" />
                        Abierto
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right text-xs text-text-disabled">
                    {period?.closed_at
                      ? new Date(period.closed_at).toLocaleDateString('es-CL')
                      : '—'}
                  </td>
                  <td className="px-5 py-3 text-center">
                    {!period && (
                      <button
                        onClick={() => handleOpen(month)}
                        disabled={isPending}
                        className="text-xs px-3 py-1.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium disabled:opacity-50"
                      >
                        Abrir Período
                      </button>
                    )}
                    {isOpen && (
                      <button
                        onClick={() => handleClose(period.id)}
                        disabled={isPending}
                        className="text-xs px-3 py-1.5 rounded bg-error/10 text-error hover:bg-error/20 transition-colors font-medium disabled:opacity-50"
                      >
                        Cerrar Período
                      </button>
                    )}
                    {isClosed && (
                      <button
                        onClick={() => handleReopen(period.id)}
                        disabled={isPending}
                        className="text-xs px-3 py-1.5 rounded bg-warning/10 text-warning hover:bg-warning/20 transition-colors font-medium disabled:opacity-50"
                      >
                        Reabrir
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-xs text-text-disabled">
        <p>• Un período cerrado no permite crear ni modificar asientos contables.</p>
        <p>• Reabrir un período es posible solo si tiene autorización de administrador.</p>
      </div>
    </div>
  )
}
