import { createClient } from '@/lib/supabase/server'
import { formatCLP } from '@/lib/utils'
import { SincronizarIndicadoresButton, TablaAFPEditable } from './ParametrosClient'

export default async function ParametrosPage() {
  const supabase = await createClient()

  const [afpRes, isapreRes, paramRes] = await Promise.all([
    supabase.schema('remu').from('afp').select('*').order('nombre'),
    supabase.schema('remu').from('isapres').select('*').order('nombre'),
    supabase.schema('remu').from('parametros_legales')
      .select('tipo, year, month, valor, datos_json, fuente, actualizado_en')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(40),
  ])

  const afps    = afpRes.data    ?? []
  const isapres = isapreRes.data ?? []
  const params  = paramRes.data  ?? []

  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1

  // Obtener valores actuales desde BD
  const rowUF  = params.find(p => p.tipo === 'UF')
  const rowUTM = params.find(p => p.tipo === 'UTM'  && p.year === year && p.month === month)
              ?? params.find(p => p.tipo === 'UTM')
  const rowTopeAfp = params.find(p => p.tipo === 'TOPE_AFP_SALUD_CLP')
  const rowTopeAfc = params.find(p => p.tipo === 'TOPE_AFC_CLP')
  const rowTopeUF  = params.find(p => p.tipo === 'TOPE_IMPONIBLE_UF' && p.year === year)
                  ?? params.find(p => p.tipo === 'TOPE_IMPONIBLE_UF')
  const rowTopeAfcUF = params.find(p => p.tipo === 'TOPE_AFC_UF' && p.year === year)
                    ?? params.find(p => p.tipo === 'TOPE_AFC_UF')
  const rowAfc = params.find(p => p.tipo === 'AFC' && p.year === year)
              ?? params.find(p => p.tipo === 'AFC')
  const rowSis = params.find(p => p.tipo === 'SIS' && p.year === year)
              ?? params.find(p => p.tipo === 'SIS')

  const afcData = rowAfc?.datos_json as Record<string, number> | null

  // Fecha última sincronización (la más reciente entre UF y UTM)
  const syncUF  = rowUF?.actualizado_en  ? new Date(rowUF.actualizado_en)  : null
  const syncUTM = rowUTM?.actualizado_en ? new Date(rowUTM.actualizado_en) : null
  const ultimaSync = syncUF && syncUTM
    ? new Date(Math.max(syncUF.getTime(), syncUTM.getTime())).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })
    : (syncUF ?? syncUTM)?.toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' }) ?? null

  // ¿Los datos están desactualizados? (más de 24h)
  const desactualizado = !syncUF || (Date.now() - (syncUF?.getTime() ?? 0)) > 24 * 60 * 60 * 1000

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Parámetros Legales</h1>
        <p className="text-text-secondary text-sm mt-1">
          Indicadores previsionales Chile {year} — actualización automática vía mindicador.cl
        </p>
      </div>

      {/* Alerta si desactualizado */}
      {desactualizado && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-warning/10 border border-warning/20">
          <p className="text-xs text-warning font-medium">
            Los indicadores no se han sincronizado recientemente. Pulsa "Sincronizar Indicadores" para obtener los valores vigentes.
          </p>
        </div>
      )}

      {/* Sincronización */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-text-primary">Sincronización con mindicador.cl</h2>
          <span className="badge bg-success/10 text-success text-[10px]">Gratis · sin API key</span>
        </div>
        <SincronizarIndicadoresButton
          ufEnBD={Number(rowUF?.valor ?? 0)}
          utmEnBD={Number(rowUTM?.valor ?? 0)}
          ultimaSync={ultimaSync}
        />
      </div>

      {/* Topes legales */}
      <div className="card p-5 mb-6">
        <h2 className="text-sm font-semibold text-text-primary mb-4">Topes Imponibles Vigentes {year}</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-surface-high rounded-lg">
            <p className="text-[10px] text-text-disabled uppercase tracking-wide mb-2">AFP + Salud</p>
            <p className="text-xs text-text-disabled">{rowTopeUF?.valor ?? 90} UF</p>
            <p className="text-xl font-black text-text-primary">
              {rowTopeAfp?.valor ? formatCLP(Number(rowTopeAfp.valor)) : `${rowTopeUF?.valor ?? 90} UF`}
            </p>
            <p className="text-[10px] text-text-disabled mt-1">DL 3500 · actualiza con UF</p>
          </div>
          <div className="p-4 bg-surface-high rounded-lg">
            <p className="text-[10px] text-text-disabled uppercase tracking-wide mb-2">Seguro Cesantía (AFC)</p>
            <p className="text-xs text-text-disabled">{rowTopeAfcUF?.valor ?? 135.2} UF</p>
            <p className="text-xl font-black text-text-primary">
              {rowTopeAfc?.valor ? formatCLP(Number(rowTopeAfc.valor)) : `${rowTopeAfcUF?.valor ?? 135.2} UF`}
            </p>
            <p className="text-[10px] text-text-disabled mt-1">Ley 19.728 · actualiza con UF</p>
          </div>
        </div>
        <p className="text-[10px] text-text-disabled mt-3">
          Los montos en CLP se recalculan automáticamente al sincronizar la UF.
        </p>
      </div>

      {/* AFC */}
      {afcData && (
        <div className="card p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text-primary">Seguro de Cesantía (AFC) {year}</h2>
            <a
              href="https://www.afc.cl/empleadores/tasas-de-cotizacion/"
              target="_blank" rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              afc.cl →
            </a>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                label: 'Contrato Indefinido',
                trabajador: afcData.contrato_indefinido_trabajador,
                empleador:  afcData.contrato_indefinido_empleador,
              },
              {
                label: 'Contrato Plazo Fijo',
                trabajador: afcData.contrato_plazo_fijo_trabajador,
                empleador:  afcData.contrato_plazo_fijo_empleador,
              },
            ].map(t => (
              <div key={t.label} className="p-4 bg-surface-high rounded-lg">
                <p className="text-[10px] text-text-disabled uppercase tracking-wide mb-2">{t.label}</p>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Trabajador</span>
                  <span className="font-semibold text-text-primary">
                    {((t.trabajador ?? 0) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-text-secondary">Empleador</span>
                  <span className="font-semibold text-text-primary">
                    {((t.empleador ?? 0) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
          {rowAfc?.fuente && (
            <p className="text-[10px] text-text-disabled mt-3">{rowAfc.fuente}</p>
          )}
        </div>
      )}

      {/* AFP — editables */}
      <div className="card overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">AFP — Tasas de Comisión y SIS</h2>
            <p className="text-[10px] text-text-disabled mt-0.5">
              SIS vigente: {rowSis ? `${(((rowSis.datos_json as { tasa: number } | null)?.tasa ?? 0.0154) * 100).toFixed(2)}%` : '1,54%'}
              {' '}· cambia anualmente en febrero
            </p>
          </div>
          <a
            href="https://www.spensiones.cl/portal/institucional/594/w3-article-13497.html"
            target="_blank" rel="noopener noreferrer"
            className="text-xs text-primary hover:underline"
          >
            spensiones.cl →
          </a>
        </div>
        <div className="px-4 py-2 bg-warning/5 border-b border-warning/10">
          <p className="text-[10px] text-warning">
            Actualizar en febrero de cada año cuando la SP publique nuevas tarifas. El SIS puede cambiar distinto por AFP.
          </p>
        </div>
        <TablaAFPEditable afps={afps} />
      </div>

      {/* Tabla IU */}
      <div className="card overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">Impuesto Único 2ª Categoría {year}</h2>
          <a
            href="https://www.sii.cl/pagina/valores/ut/ut2025.htm"
            target="_blank" rel="noopener noreferrer"
            className="text-xs text-primary hover:underline"
          >
            sii.cl →
          </a>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="table-header">
              <th className="px-4 py-3 text-left">Tramo mensual (UTM)</th>
              <th className="px-4 py-3 text-right">Tasa</th>
              <th className="px-4 py-3 text-right">Factor rebaja (UTM)</th>
            </tr>
          </thead>
          <tbody>
            {[
              { desde: '0',    hasta: '13,5',  tasa: 'Exento',  factor: '—' },
              { desde: '13,5', hasta: '30',    tasa: '4%',      factor: '0,54' },
              { desde: '30',   hasta: '50',    tasa: '8%',      factor: '1,74' },
              { desde: '50',   hasta: '70',    tasa: '13,5%',   factor: '4,49' },
              { desde: '70',   hasta: '90',    tasa: '23%',     factor: '11,14' },
              { desde: '90',   hasta: '120',   tasa: '30,4%',   factor: '17,80' },
              { desde: '120',  hasta: '150',   tasa: '35%',     factor: '23,80' },
              { desde: '150',  hasta: '+∞',    tasa: '40%',     factor: '31,30' },
            ].map((t, i) => (
              <tr key={i} className="table-row">
                <td className="px-4 py-2.5 text-text-secondary">
                  Más de {t.desde} UTM hasta {t.hasta} UTM
                </td>
                <td className="px-4 py-2.5 text-right font-semibold text-text-primary">{t.tasa}</td>
                <td className="px-4 py-2.5 text-right text-text-secondary">{t.factor}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t border-border">
          <p className="text-[10px] text-text-disabled">
            Tramos embebidos en el motor de cálculo. Actualizar anualmente si el SII modifica la tabla.
          </p>
        </div>
      </div>

      {/* Isapres */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">Isapres vigentes</h2>
          <a href="https://www.isapre.cl" target="_blank" rel="noopener noreferrer"
            className="text-xs text-primary hover:underline">isapre.cl →</a>
        </div>
        <div className="grid grid-cols-2">
          {isapres.map(i => (
            <div key={i.id} className="px-4 py-3 border-b border-border flex items-center justify-between">
              <p className="text-sm text-text-primary">{i.nombre}</p>
              <span className={`badge ${i.activa ? 'bg-success/10 text-success' : 'bg-surface-high text-text-disabled'}`}>
                {i.activa ? 'Activa' : 'Inactiva'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
