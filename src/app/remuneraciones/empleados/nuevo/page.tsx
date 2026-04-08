import { createClient } from '@/lib/supabase/server'
import { crearEmpleado } from '../actions'
import Link from 'next/link'

export default async function NuevoEmpleadoPage() {
  const supabase = await createClient()

  const [afpRes, isapreRes] = await Promise.all([
    supabase.schema('remu').from('afp').select('id, nombre').eq('activa', true).order('nombre'),
    supabase.schema('remu').from('isapres').select('id, nombre').eq('activa', true).order('nombre'),
  ])

  const afps    = afpRes.data ?? []
  const isapres = isapreRes.data ?? []

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/remuneraciones/empleados" className="text-text-disabled hover:text-text-primary">
          ← Empleados
        </Link>
        <span className="text-border">/</span>
        <h1 className="text-xl font-bold text-text-primary">Nuevo Empleado</h1>
      </div>

      <form action={crearEmpleado} className="space-y-8">
        {/* Datos personales */}
        <section className="card p-6">
          <h2 className="text-sm font-semibold text-text-primary mb-5 pb-3 border-b border-border">
            Datos Personales
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">RUT *</label>
              <input name="rut" required placeholder="12.345.678-9" className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Nombres *</label>
              <input name="nombres" required className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Apellido Paterno *</label>
              <input name="apellido_paterno" required className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Apellido Materno</label>
              <input name="apellido_materno" className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Fecha Nacimiento</label>
              <input name="fecha_nacimiento" type="date" className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Género</label>
              <select name="genero" className="input">
                <option value="">Seleccionar</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Email</label>
              <input name="email" type="email" className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Teléfono</label>
              <input name="telefono" placeholder="+56 9 1234 5678" className="input" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Dirección</label>
              <input name="direccion" className="input" />
            </div>
          </div>
        </section>

        {/* Datos laborales */}
        <section className="card p-6">
          <h2 className="text-sm font-semibold text-text-primary mb-5 pb-3 border-b border-border">
            Datos Laborales
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Cargo *</label>
              <input name="cargo" required className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Departamento</label>
              <input name="departamento" className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Fecha de Ingreso *</label>
              <input name="fecha_ingreso" type="date" required className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Tipo de Contrato *</label>
              <select name="tipo_contrato" required className="input">
                <option value="">Seleccionar</option>
                <option value="indefinido">Indefinido</option>
                <option value="plazo_fijo">Plazo Fijo</option>
                <option value="honorarios">Honorarios</option>
                <option value="obra_faena">Obra/Faena</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Fecha Término Contrato</label>
              <input name="fecha_termino_contrato" type="date" className="input" />
              <p className="text-[10px] text-text-disabled mt-1">Solo para plazo fijo / obra faena</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Jornada (horas semanales) *</label>
              <input name="jornada_horas" type="number" defaultValue={45} min={1} max={45} required className="input" />
            </div>
          </div>
        </section>

        {/* Remuneración y previsión */}
        <section className="card p-6">
          <h2 className="text-sm font-semibold text-text-primary mb-5 pb-3 border-b border-border">
            Remuneración y Previsión
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Sueldo Base (CLP) *</label>
              <input name="sueldo_base" type="number" required min={0} step={1000} className="input" placeholder="500000" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">AFP *</label>
              <select name="afp_id" required className="input">
                <option value="">Seleccionar AFP</option>
                {afps.map(a => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Sistema de Salud *</label>
              <select name="tipo_salud" required className="input">
                <option value="fonasa">Fonasa</option>
                <option value="isapre">Isapre</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Isapre (si aplica)</label>
              <select name="isapre_id" className="input">
                <option value="">— Fonasa / Sin isapre —</option>
                {isapres.map(i => (
                  <option key={i.id} value={i.id}>{i.nombre}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Seguro de Cesantía (AFC)</label>
              <select name="cotiza_afc" className="input">
                <option value="true">Sí cotiza AFC</option>
                <option value="false">No cotiza AFC (exento)</option>
              </select>
            </div>
          </div>
        </section>

        <div className="flex gap-3 justify-end">
          <Link href="/remuneraciones/empleados" className="btn-ghost">
            Cancelar
          </Link>
          <button type="submit" className="btn-primary">
            Guardar Empleado
          </button>
        </div>
      </form>
    </div>
  )
}
