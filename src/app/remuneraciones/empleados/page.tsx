import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCLP } from '@/lib/utils'

const TIPO_CONTRATO: Record<string, string> = {
  indefinido:   'Indefinido',
  plazo_fijo:   'Plazo Fijo',
  honorarios:   'Honorarios',
  obra_faena:   'Obra/Faena',
}

export default async function EmpleadosPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user!.id).single()

  const companyId = profile?.company_id as string

  const { data: empleados } = await supabase
    .schema('remu').from('empleados')
    .select('id, rut, nombres, apellido_paterno, apellido_materno, cargo, departamento, tipo_contrato, sueldo_base, fecha_ingreso, estado, afp:afp_id(nombre), tipo_salud')
    .eq('company_id', companyId)
    .order('apellido_paterno')

  const activos   = (empleados ?? []).filter(e => e.estado === 'activo').length
  const inactivos = (empleados ?? []).filter(e => e.estado === 'inactivo').length

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Empleados</h1>
          <p className="text-text-secondary text-sm mt-1">
            {activos} activos{inactivos > 0 ? ` · ${inactivos} inactivos` : ''}
          </p>
        </div>
        <Link href="/remuneraciones/empleados/nuevo" className="btn-primary">
          + Nuevo empleado
        </Link>
      </div>

      {/* Tabla */}
      {(empleados ?? []).length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-text-secondary text-sm">No hay empleados registrados.</p>
          <Link href="/remuneraciones/empleados/nuevo" className="btn-primary mt-4 inline-block">
            Agregar primer empleado
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">RUT</th>
                <th className="px-4 py-3 text-left">Cargo</th>
                <th className="px-4 py-3 text-left">Contrato</th>
                <th className="px-4 py-3 text-right">Sueldo Base</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {(empleados ?? []).map(emp => {
                const afp = emp.afp as unknown as { nombre: string } | null
                return (
                  <tr key={emp.id} className="table-row">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-text-primary">
                        {emp.apellido_paterno} {emp.apellido_materno ?? ''}, {emp.nombres}
                      </p>
                      <p className="text-xs text-text-disabled">{emp.departamento ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">{emp.rut}</td>
                    <td className="px-4 py-3 text-sm text-text-secondary">{emp.cargo}</td>
                    <td className="px-4 py-3">
                      <span className="badge bg-surface-high text-text-secondary border border-border">
                        {TIPO_CONTRATO[emp.tipo_contrato] ?? emp.tipo_contrato}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-primary text-right font-medium">
                      {formatCLP(emp.sueldo_base)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`badge ${
                        emp.estado === 'activo'
                          ? 'bg-success/10 text-success'
                          : emp.estado === 'finiquitado'
                          ? 'bg-error/10 text-error'
                          : 'bg-surface-high text-text-disabled'
                      }`}>
                        {emp.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/remuneraciones/empleados/${emp.id}`}
                        className="text-xs text-primary hover:underline"
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
