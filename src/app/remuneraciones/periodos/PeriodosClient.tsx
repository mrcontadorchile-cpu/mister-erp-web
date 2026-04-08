'use client'

import { cerrarPeriodo, reabrirPeriodo } from './actions'
import Link from 'next/link'

const MESES = ['', 'Enero','Febrero','Marzo','Abril','Mayo','Junio',
                'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

interface Periodo {
  id: string
  year: number
  month: number
  estado: string
  cerrado_at: string | null
  liquidaciones_count?: number
}

export function PeriodosTable({ periodos }: { periodos: Periodo[] }) {
  return (
    <div className="card overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="table-header">
            <th className="px-4 py-3 text-left">Período</th>
            <th className="px-4 py-3 text-center">Liquidaciones</th>
            <th className="px-4 py-3 text-center">Estado</th>
            <th className="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {periodos.map(p => (
            <tr key={p.id} className="table-row">
              <td className="px-4 py-3">
                <p className="text-sm font-semibold text-text-primary">
                  {MESES[p.month]} {p.year}
                </p>
                {p.cerrado_at && (
                  <p className="text-xs text-text-disabled">
                    Cerrado: {new Date(p.cerrado_at).toLocaleDateString('es-CL')}
                  </p>
                )}
              </td>
              <td className="px-4 py-3 text-center">
                <Link
                  href={`/remuneraciones/liquidaciones/${p.id}`}
                  className="text-sm text-primary hover:underline"
                >
                  {p.liquidaciones_count ?? 0} liquidaciones
                </Link>
              </td>
              <td className="px-4 py-3 text-center">
                <span className={`badge ${
                  p.estado === 'abierto'
                    ? 'bg-success/10 text-success'
                    : 'bg-error/10 text-error'
                }`}>
                  {p.estado}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex gap-2 justify-end">
                  <Link
                    href={`/remuneraciones/liquidaciones/${p.id}`}
                    className="text-xs text-primary hover:underline"
                  >
                    Liquidar
                  </Link>
                  {p.estado === 'abierto' ? (
                    <form action={cerrarPeriodo.bind(null, p.id)}>
                      <button type="submit" className="text-xs text-error hover:underline">
                        Cerrar
                      </button>
                    </form>
                  ) : (
                    <form action={reabrirPeriodo.bind(null, p.id)}>
                      <button type="submit" className="text-xs text-text-disabled hover:text-text-secondary">
                        Reabrir
                      </button>
                    </form>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
