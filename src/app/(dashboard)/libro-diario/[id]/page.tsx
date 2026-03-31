import { createClient } from '@/lib/supabase/server'
import { formatCLP, accountTypeColor } from '@/lib/utils'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ReverseButton } from './ReverseButton'
import type { AccountType } from '@/types/database'

export default async function JournalEntryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()

  const { data: entry } = await supabase
    .schema('conta').from('journal_entries')
    .select(`
      id, number, date, glosa, type, status, created_at,
      conta_journal_lines(
        id, debit, credit, description,
        conta_accounts(code, name, type)
      )
    `)
    .eq('id', id)
    .eq('company_id', profile?.company_id)
    .single()

  if (!entry) notFound()

  const lines = (entry.conta_journal_lines ?? []) as unknown as {
    id: string
    debit: number
    credit: number
    description: string | null
    conta_accounts: { code: string; name: string; type: string } | null
  }[]

  const totalDebit  = lines.reduce((s, l) => s + l.debit, 0)
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0)

  const STATUS_MAP: Record<string, { label: string; cls: string }> = {
    posted:   { label: 'Contabilizado', cls: 'bg-success/10 text-success' },
    draft:    { label: 'Borrador',      cls: 'bg-warning/10 text-warning' },
    reversed: { label: 'Revertido',     cls: 'bg-error/10 text-error' },
  }
  const statusInfo = STATUS_MAP[entry.status] ?? { label: entry.status, cls: 'bg-surface-high text-text-disabled' }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Link href="/libro-diario" className="text-text-disabled hover:text-primary transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Asiento #{entry.number}</h1>
            <p className="text-text-secondary text-sm mt-1">
              {new Date(entry.date).toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`badge ${statusInfo.cls} text-sm px-3 py-1`}>{statusInfo.label}</span>
          {entry.status === 'posted' && (
            <ReverseButton entryId={entry.id} />
          )}
        </div>
      </div>

      {/* Info del asiento */}
      <div className="card p-5 mb-5">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-text-disabled mb-1">Glosa</p>
            <p className="text-sm font-medium text-text-primary">{entry.glosa}</p>
          </div>
          <div>
            <p className="text-xs text-text-disabled mb-1">Tipo</p>
            <span className="badge bg-surface-high text-text-secondary text-xs">
              {(({
                MANUAL: 'Manual',
                SII_FACTURA: 'Factura SII',
                SII_HONORARIO: 'Honorario SII',
                INVENTARIO_VENTA: 'Venta Inventario',
                INVENTARIO_COMPRA: 'Compra Inventario',
              } as Record<string, string>)[entry.type] ?? entry.type)}
            </span>
          </div>
          <div>
            <p className="text-xs text-text-disabled mb-1">Creado</p>
            <p className="text-xs text-text-secondary">
              {new Date(entry.created_at).toLocaleDateString('es-CL')}
            </p>
          </div>
        </div>
      </div>

      {/* Líneas */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h2 className="text-sm font-bold text-text-primary">Líneas del Asiento</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="table-header">
              <th className="px-4 py-3 text-left">Cuenta</th>
              <th className="px-4 py-3 text-left">Descripción</th>
              <th className="px-4 py-3 text-right w-36">DEBE</th>
              <th className="px-4 py-3 text-right w-36">HABER</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(l => {
              const acc = l.conta_accounts
              const color = acc ? accountTypeColor(acc.type as AccountType) : '#888'
              return (
                <tr key={l.id} className="table-row">
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs" style={{ color }}>{acc?.code}</p>
                    <p className="text-text-primary text-sm">{acc?.name}</p>
                  </td>
                  <td className="px-4 py-3 text-text-secondary text-xs">{l.description ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-mono text-info text-sm">
                    {l.debit > 0 ? formatCLP(l.debit) : ''}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-warning text-sm">
                    {l.credit > 0 ? formatCLP(l.credit) : ''}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-surface-high border-t-2 border-border font-bold">
              <td colSpan={2} className="px-4 py-3 text-xs text-text-secondary">TOTALES</td>
              <td className="px-4 py-3 text-right font-mono text-info text-base">{formatCLP(totalDebit)}</td>
              <td className="px-4 py-3 text-right font-mono text-warning text-base">{formatCLP(totalCredit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
