import { createClient } from '@/lib/supabase/server'
import { formatCLP, taxDocTypeLabel } from '@/lib/utils'

export default async function DocumentosSiiPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile }  = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()

  const companyId = profile?.company_id as string

  let query = supabase
    .from('conta.tax_documents')
    .select('*')
    .eq('company_id', companyId)
    .order('date', { ascending: false })
    .limit(200)

  if (params.status) query = query.eq('status', params.status)
  if (params.type)   query = query.eq('type', params.type)

  const { data: docs } = await query

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Documentos Tributarios</h1>
          <p className="text-text-secondary text-sm mt-1">
            {docs?.length ?? 0} documentos
          </p>
        </div>
        <a href="/importar-sii" className="btn-primary px-4 py-2 text-sm">
          + Importar SII
        </a>
      </div>

      {/* Filtros */}
      <form className="flex gap-2 flex-wrap mb-6">
        <select name="type" defaultValue={params.type ?? ''} className="input w-44 text-sm">
          <option value="">Todos los tipos</option>
          <option value="FACTURA_COMPRA">Facturas Compra</option>
          <option value="FACTURA_VENTA">Facturas Venta</option>
          <option value="BOLETA_HONORARIO">Boletas Honorario</option>
          <option value="NOTA_CREDITO">Notas Crédito</option>
          <option value="NOTA_DEBITO">Notas Débito</option>
        </select>
        <select name="status" defaultValue={params.status ?? ''} className="input w-44 text-sm">
          <option value="">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="journalized">Contabilizado</option>
          <option value="rejected">Rechazado</option>
        </select>
        <button type="submit" className="btn-primary px-4 py-2 text-sm">Filtrar</button>
      </form>

      {!docs?.length ? (
        <div className="card p-12 text-center text-text-disabled">
          Sin documentos para los filtros seleccionados
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left w-20">Folio</th>
                <th className="px-4 py-3 text-left w-28">Fecha</th>
                <th className="px-4 py-3 text-left">RUT</th>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-right">Neto</th>
                <th className="px-4 py-3 text-right">IVA</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {docs.map(doc => (
                <tr key={doc.id} className="table-row">
                  <td className="px-4 py-3">
                    <span className="badge bg-surface-high text-text-secondary text-xs">
                      {taxDocTypeLabel(doc.type)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-text-disabled text-xs">
                    {doc.folio}
                  </td>
                  <td className="px-4 py-3 text-text-secondary text-xs">
                    {new Date(doc.date).toLocaleDateString('es-CL')}
                  </td>
                  <td className="px-4 py-3 font-mono text-text-secondary text-xs">
                    {doc.rut_counterpart}
                  </td>
                  <td className="px-4 py-3 text-text-primary max-w-xs truncate">
                    {doc.name_counterpart}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-text-secondary">
                    {formatCLP(doc.net_amount)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-text-secondary">
                    {formatCLP(doc.tax_amount)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-text-primary">
                    {formatCLP(doc.total_amount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <DocStatusBadge status={doc.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function DocStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending:     { label: 'Pendiente',     cls: 'bg-warning/10 text-warning' },
    journalized: { label: 'Contabilizado', cls: 'bg-success/10 text-success' },
    rejected:    { label: 'Rechazado',     cls: 'bg-error/10 text-error' },
  }
  const s = map[status] ?? { label: status, cls: 'bg-surface-high text-text-disabled' }
  return <span className={`badge ${s.cls}`}>{s.label}</span>
}
