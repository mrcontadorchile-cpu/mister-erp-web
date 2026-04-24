import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { actualizarEmpleado } from '../actions'
import { formatCLP } from '@/lib/utils'
import Link from 'next/link'

const TIPO_CONTRATO: Record<string, string> = {
  indefinido:  'Indefinido',
  plazo_fijo:  'Plazo Fijo',
  honorarios:  'Honorarios',
  obra_faena:  'Obra/Faena',
}

export default async function EmpleadoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [empRes, afpRes, isapreRes] = await Promise.all([
    supabase.schema('remu').from('empleados')
      .select('*, afp:afp_id(id, nombre, tasa_trabajador), isapre:isapre_id(id, nombre)')
      .eq('id', id)
      .single(),
    supabase.schema('remu').from('afp').select('id, nombre').eq('activa', true).order('nombre'),
    supabase.schema('remu').from('isapres').select('id, nombre').eq('activa', true).order('nombre'),
  ])

  if (empRes.error || !empRes.data) notFound()

  const emp     = empRes.data
  const afps    = afpRes.data ?? []
  const isapres = isapreRes.data ?? []

  const afp    = emp.afp as unknown as { id: number; nombre: string; tasa_trabajador: number } | null
  const isapre = emp.isapre as unknown as { id: number; nombre: string } | null

  // Últimas liquidaciones
  const { data: liquidaciones } = await supabase
    .schema('remu').from('liquidaciones')
    .select('id, liquido_a_pagar, total_haberes, total_descuentos, estado, periodo:periodo_id(year, month)')
    .eq('empleado_id', id)
    .order('created_at', { ascending: false })
    .limit(6)

  const actualizarConId = actualizarEmpleado.bind(null, id)

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/remuneraciones/empleados" className="text-text-disabled hover:text-text-primary">
          ← Empleados
        </Link>
        <span className="text-border">/</span>
        <h1 className="text-xl font-bold text-text-primary">
          {emp.apellido_paterno} {emp.apellido_materno ?? ''}, {emp.nombres}
        </h1>
        <span className={`badge ml-2 ${
          emp.estado === 'activo' ? 'bg-success/10 text-success' :
          emp.estado === 'finiquitado' ? 'bg-error/10 text-error' :
          'bg-surface-high text-text-disabled'
        }`}>
          {emp.estado}
        </span>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="card p-4">
          <p className="text-xs text-text-disabled mb-1">Sueldo Base</p>
          <p className="text-lg font-bold text-text-primary">{formatCLP(emp.sueldo_base)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-disabled mb-1">AFP</p>
          <p className="text-sm font-semibold text-text-primary">{afp?.nombre ?? '—'}</p>
          <p className="text-xs text-text-disabled">{afp ? `${(afp.tasa_trabajador * 100).toFixed(2)}%` : ''}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-disabled mb-1">Salud</p>
          <p className="text-sm font-semibold text-text-primary">
            {emp.tipo_salud === 'isapre' && isapre ? isapre.nombre : 'Fonasa'}
          </p>
          <p className="text-xs text-text-disabled">7%</p>
        </div>
      </div>

      {/* Formulario de edición */}
      <form action={actualizarConId} className="space-y-8">
        {/* Datos personales */}
        <section className="card p-6">
          <h2 className="text-sm font-semibold text-text-primary mb-5 pb-3 border-b border-border">
            Datos Personales
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">RUT</label>
              <input value={emp.rut} disabled className="input opacity-50 cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Nombres *</label>
              <input name="nombres" defaultValue={emp.nombres} required className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Apellido Paterno *</label>
              <input name="apellido_paterno" defaultValue={emp.apellido_paterno} required className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Apellido Materno</label>
              <input name="apellido_materno" defaultValue={emp.apellido_materno ?? ''} className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Fecha Nacimiento</label>
              <input name="fecha_nacimiento" type="date" defaultValue={emp.fecha_nacimiento ?? ''} className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Género</label>
              <select name="genero" defaultValue={emp.genero ?? ''} className="input">
                <option value="">Seleccionar</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Email</label>
              <input name="email" type="email" defaultValue={emp.email ?? ''} className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Teléfono</label>
              <input name="telefono" defaultValue={emp.telefono ?? ''} className="input" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Dirección</label>
              <input name="direccion" defaultValue={emp.direccion ?? ''} className="input" />
            </div>
          </div>
        </section>

        {/* Datos laborales */}
        <section className="card p-6">
          <h2 className="text-sm font-semibold text-text-primary mb-5 pb-3 border-b border-border">
            Datos Laborales
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Cargo *</label>
              <input name="cargo" defaultValue={emp.cargo} required className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Departamento</label>
              <input name="departamento" defaultValue={emp.departamento ?? ''} className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Fecha de Ingreso *</label>
              <input name="fecha_ingreso" type="date" defaultValue={emp.fecha_ingreso} required className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Tipo de Contrato *</label>
              <select name="tipo_contrato" defaultValue={emp.tipo_contrato} required className="input">
                <option value="indefinido">Indefinido</option>
                <option value="plazo_fijo">Plazo Fijo</option>
                <option value="honorarios">Honorarios</option>
                <option value="obra_faena">Obra/Faena</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Fecha Término Contrato</label>
              <input name="fecha_termino_contrato" type="date" defaultValue={emp.fecha_termino_contrato ?? ''} className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Jornada (horas semanales)</label>
              <input name="jornada_horas" type="number" defaultValue={emp.jornada_horas} min={1} max={45} className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Estado</label>
              <select name="estado" defaultValue={emp.estado} className="input">
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
                <option value="finiquitado">Finiquitado</option>
              </select>
            </div>
          </div>
        </section>

        {/* Remuneración y previsión */}
        <section className="card p-6">
          <h2 className="text-sm font-semibold text-text-primary mb-5 pb-3 border-b border-border">
            Remuneración y Previsión
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Sueldo Base (CLP) *</label>
              <input name="sueldo_base" type="number" defaultValue={emp.sueldo_base} required min={0} step={1000} className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">AFP *</label>
              <select name="afp_id" defaultValue={afp?.id ?? ''} required className="input">
                <option value="">Seleccionar AFP</option>
                {afps.map(a => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Sistema de Salud *</label>
              <select name="tipo_salud" defaultValue={emp.tipo_salud} required className="input">
                <option value="fonasa">Fonasa</option>
                <option value="isapre">Isapre</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Isapre</label>
              <select name="isapre_id" defaultValue={isapre?.id ?? ''} className="input">
                <option value="">— Fonasa / Sin isapre —</option>
                {isapres.map(i => (
                  <option key={i.id} value={i.id}>{i.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Seguro de Cesantía</label>
              <select name="cotiza_afc" defaultValue={emp.cotiza_afc ? 'true' : 'false'} className="input">
                <option value="true">Sí cotiza AFC</option>
                <option value="false">No cotiza AFC</option>
              </select>
            </div>
          </div>
        </section>

        <div className="flex gap-3 justify-end">
          <Link href="/remuneraciones/empleados" className="btn-ghost">Cancelar</Link>
          <button type="submit" className="btn-primary">Guardar Cambios</button>
        </div>
      </form>

      {/* Últimas liquidaciones */}
      {(liquidaciones ?? []).length > 0 && (
        <div className="mt-10">
          <h2 className="text-xs font-semibold text-text-disabled tracking-wider uppercase mb-3">
            Últimas Liquidaciones
          </h2>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left">Período</th>
                  <th className="px-4 py-3 text-right">Haberes</th>
                  <th className="px-4 py-3 text-right">Descuentos</th>
                  <th className="px-4 py-3 text-right">Líquido</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {(liquidaciones ?? []).map(liq => {
                  const periodo = liq.periodo as unknown as { year: number; month: number } | null
                  return (
                    <tr key={liq.id} className="table-row">
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {periodo ? `${periodo.month.toString().padStart(2,'0')}/${periodo.year}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-text-primary">{formatCLP(liq.total_haberes)}</td>
                      <td className="px-4 py-3 text-sm text-right text-error">{formatCLP(liq.total_descuentos)}</td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-success">{formatCLP(liq.liquido_a_pagar)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`badge ${
                          liq.estado === 'pagada' ? 'bg-success/10 text-success' :
                          liq.estado === 'aprobada' ? 'bg-primary/10 text-primary' :
                          'bg-surface-high text-text-disabled'
                        }`}>
                          {liq.estado}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
