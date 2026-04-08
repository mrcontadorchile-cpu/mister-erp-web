'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function crearEmpleado(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { data: profile } = await supabase
    .from('user_profiles').select('company_id').eq('id', user.id).single()
  const companyId = profile?.company_id as string

  const sueldo = parseInt(formData.get('sueldo_base') as string, 10) || 0
  const jornada = parseInt(formData.get('jornada_horas') as string, 10) || 45
  const afpId = formData.get('afp_id') ? parseInt(formData.get('afp_id') as string, 10) : null
  const isapreId = formData.get('isapre_id') ? parseInt(formData.get('isapre_id') as string, 10) : null

  const { data, error } = await supabase.schema('remu').from('empleados').insert({
    company_id:             companyId,
    rut:                    formData.get('rut') as string,
    nombres:                formData.get('nombres') as string,
    apellido_paterno:       formData.get('apellido_paterno') as string,
    apellido_materno:       (formData.get('apellido_materno') as string) || null,
    fecha_nacimiento:       (formData.get('fecha_nacimiento') as string) || null,
    genero:                 (formData.get('genero') as string) || null,
    email:                  (formData.get('email') as string) || null,
    telefono:               (formData.get('telefono') as string) || null,
    direccion:              (formData.get('direccion') as string) || null,
    cargo:                  formData.get('cargo') as string,
    departamento:           (formData.get('departamento') as string) || null,
    fecha_ingreso:          formData.get('fecha_ingreso') as string,
    tipo_contrato:          formData.get('tipo_contrato') as string,
    fecha_termino_contrato: (formData.get('fecha_termino_contrato') as string) || null,
    jornada_horas:          jornada,
    sueldo_base:            sueldo,
    afp_id:                 afpId,
    tipo_salud:             formData.get('tipo_salud') as string,
    isapre_id:              isapreId,
    tasa_isapre:            isapreId ? 0.07 : null,
    cotiza_afc:             formData.get('cotiza_afc') === 'true',
    estado:                 'activo',
  }).select('id').single()

  if (error) throw new Error(error.message)

  revalidatePath('/remuneraciones/empleados')
  redirect(`/remuneraciones/empleados/${data.id}`)
}

export async function actualizarEmpleado(id: string, formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const sueldo = parseInt(formData.get('sueldo_base') as string, 10) || 0
  const jornada = parseInt(formData.get('jornada_horas') as string, 10) || 45
  const afpId = formData.get('afp_id') ? parseInt(formData.get('afp_id') as string, 10) : null
  const isapreId = formData.get('isapre_id') ? parseInt(formData.get('isapre_id') as string, 10) : null

  const { error } = await supabase.schema('remu').from('empleados').update({
    nombres:                formData.get('nombres') as string,
    apellido_paterno:       formData.get('apellido_paterno') as string,
    apellido_materno:       (formData.get('apellido_materno') as string) || null,
    fecha_nacimiento:       (formData.get('fecha_nacimiento') as string) || null,
    genero:                 (formData.get('genero') as string) || null,
    email:                  (formData.get('email') as string) || null,
    telefono:               (formData.get('telefono') as string) || null,
    direccion:              (formData.get('direccion') as string) || null,
    cargo:                  formData.get('cargo') as string,
    departamento:           (formData.get('departamento') as string) || null,
    fecha_ingreso:          formData.get('fecha_ingreso') as string,
    tipo_contrato:          formData.get('tipo_contrato') as string,
    fecha_termino_contrato: (formData.get('fecha_termino_contrato') as string) || null,
    jornada_horas:          jornada,
    sueldo_base:            sueldo,
    afp_id:                 afpId,
    tipo_salud:             formData.get('tipo_salud') as string,
    isapre_id:              isapreId,
    cotiza_afc:             formData.get('cotiza_afc') === 'true',
    estado:                 formData.get('estado') as string,
  }).eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath(`/remuneraciones/empleados/${id}`)
  revalidatePath('/remuneraciones/empleados')
  redirect(`/remuneraciones/empleados/${id}`)
}
