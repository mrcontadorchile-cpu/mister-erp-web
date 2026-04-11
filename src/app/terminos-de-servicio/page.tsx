import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Términos de Servicio — Mister Contabilidad ERP',
  description: 'Términos y condiciones de uso de Mister Contabilidad ERP, plataforma SaaS de gestión contable para Pymes chilenas.',
}

export default function TerminosDeServicioPage() {
  return (
    <div className="min-h-screen bg-background text-text-primary">

      {/* Header */}
      <header className="border-b border-border bg-surface">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/login" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
              <span className="text-primary-foreground font-black text-sm">MC</span>
            </div>
            <span className="font-semibold text-text-primary">Mister Contabilidad</span>
          </Link>
          <span className="text-xs text-text-disabled">ERP · Mister Group</span>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-12">

        <div className="mb-10">
          <h1 className="text-3xl font-bold text-text-primary mb-2">Términos de Servicio</h1>
          <p className="text-text-disabled text-sm">Última actualización: abril 2026 · Aplica a todos los usuarios de erp.mistercontador.cl</p>
        </div>

        <div className="space-y-10 text-text-secondary leading-relaxed">

          {/* 1 */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">1</span>
              Aceptación de los términos
            </h2>
            <p>
              Al acceder y utilizar <strong className="text-text-primary">Mister Contabilidad ERP</strong> (en adelante, "el Servicio"),
              operado por <strong className="text-text-primary">Mister Group</strong>, el usuario acepta íntegramente
              los presentes Términos de Servicio. Si no está de acuerdo con alguno de ellos, debe abstenerse de utilizar la plataforma.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">2</span>
              Descripción del servicio
            </h2>
            <p>
              Mister Contabilidad ERP es una plataforma SaaS (Software as a Service) de gestión contable y financiera
              orientada a Pymes chilenas. El Servicio incluye, entre otras funcionalidades:
            </p>
            <ul className="mt-3 space-y-2 ml-4">
              {[
                'Gestión de contabilidad general y libros contables.',
                'Control de remuneraciones y liquidaciones de sueldo.',
                'Administración de empresas y usuarios con control de acceso por roles.',
                'Integración con el Servicio de Impuestos Internos (SII) de Chile.',
                'Acceso multiempresa desde una sola cuenta.',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-primary mt-0.5 shrink-0">→</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">3</span>
              Registro y acceso
            </h2>
            <p>
              El acceso al ERP es <strong className="text-text-primary">exclusivo para usuarios invitados</strong> por un administrador de empresa.
              No existe registro público abierto. El usuario es responsable de:
            </p>
            <ul className="mt-3 space-y-2 ml-4">
              {[
                'Mantener la confidencialidad de sus credenciales de acceso.',
                'Notificar de inmediato a Mister Group ante cualquier uso no autorizado de su cuenta.',
                'La veracidad de la información proporcionada al registrarse.',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-primary mt-0.5 shrink-0">→</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">4</span>
              Uso aceptable
            </h2>
            <p>El usuario se compromete a utilizar el Servicio únicamente para fines lícitos y expresamente prohibe:</p>
            <ul className="mt-3 space-y-2 ml-4">
              {[
                'Usar la plataforma para actividades fraudulentas, ilegales o contrarias a la legislación chilena.',
                'Intentar acceder de forma no autorizada a sistemas, cuentas o datos de terceros.',
                'Reproducir, copiar, vender o sublicenciar cualquier parte del Servicio.',
                'Introducir virus, malware u otro código malicioso.',
                'Realizar ingeniería inversa del software o sus componentes.',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-error mt-0.5 shrink-0">✕</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">5</span>
              Propiedad intelectual
            </h2>
            <p>
              Todo el contenido del Servicio — incluyendo diseño, código fuente, marca, logotipos y documentación —
              es propiedad exclusiva de <strong className="text-text-primary">Mister Group</strong> y está protegido
              por las leyes de propiedad intelectual vigentes en Chile. El usuario recibe únicamente una licencia
              limitada, no exclusiva e intransferible para utilizar el Servicio según estos términos.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">6</span>
              Disponibilidad del servicio
            </h2>
            <p>
              Mister Group realizará esfuerzos razonables para mantener el Servicio disponible de forma continua.
              Sin embargo, no garantiza una disponibilidad del 100% y se reserva el derecho de realizar mantenciones,
              actualizaciones o interrupciones temporales, notificando con anticipación cuando sea posible.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">7</span>
              Limitación de responsabilidad
            </h2>
            <p>
              Mister Group no será responsable por daños directos, indirectos, incidentales o consecuentes
              derivados del uso o imposibilidad de uso del Servicio, incluyendo pérdida de datos, lucro cesante
              o interrupción del negocio, salvo dolo o culpa grave imputable a Mister Group.
            </p>
            <p className="mt-2">
              El usuario es responsable de la exactitud de los datos contables ingresados en la plataforma
              y de su cumplimiento con las obligaciones tributarias ante el SII.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">8</span>
              Suspensión y terminación
            </h2>
            <p>
              Mister Group se reserva el derecho de suspender o cancelar el acceso de un usuario o empresa en caso de:
            </p>
            <ul className="mt-3 space-y-2 ml-4">
              {[
                'Incumplimiento de estos Términos de Servicio.',
                'Uso fraudulento o abusivo de la plataforma.',
                'Falta de pago del servicio (cuando aplique).',
                'Solicitud expresa del administrador de la empresa.',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-primary mt-0.5 shrink-0">→</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">9</span>
              Ley aplicable y jurisdicción
            </h2>
            <p>
              Estos Términos de Servicio se rigen por las leyes de la <strong className="text-text-primary">República de Chile</strong>.
              Cualquier disputa será sometida a la jurisdicción de los tribunales ordinarios de justicia de Santiago de Chile,
              con renuncia expresa a cualquier otro fuero que pudiere corresponder.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">10</span>
              Modificaciones
            </h2>
            <p>
              Mister Group se reserva el derecho de modificar estos Términos en cualquier momento.
              Los cambios serán notificados por correo electrónico o mediante un aviso en la plataforma
              con al menos <strong className="text-text-primary">7 días de anticipación</strong>.
              El uso continuado del Servicio tras la notificación implica la aceptación de los nuevos términos.
            </p>
          </section>

          {/* Contact */}
          <div className="p-6 bg-surface rounded-2xl border border-border text-center">
            <p className="text-text-primary font-semibold mb-1">¿Tienes preguntas sobre estos términos?</p>
            <p className="text-sm text-text-secondary mb-4">Contáctanos directamente.</p>
            <a
              href="mailto:mrcontadorchile@gmail.com"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-6 py-2.5 rounded-xl hover:bg-primary/90 transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              mrcontadorchile@gmail.com
            </a>
          </div>

          {/* Also see */}
          <div className="text-center text-sm text-text-disabled">
            Ver también:{' '}
            <Link href="/politica-de-privacidad" className="text-primary hover:underline">
              Política de Privacidad
            </Link>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-16 py-6 text-center">
        <p className="text-xs text-text-disabled">
          Mister Group © {new Date().getFullYear()} ·{' '}
          <Link href="/login" className="hover:text-text-secondary transition-colors">Volver al ERP</Link>
        </p>
      </footer>

    </div>
  )
}
