import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Privacidad — ERP Mister Group',
  description: 'Política de privacidad y tratamiento de datos personales de ERP Mister Group, conforme a la Ley 19.628 de Chile.',
}

export default function PoliticaPrivacidadPage() {
  return (
    <div className="min-h-screen bg-background text-text-primary">

      {/* Header */}
      <header className="border-b border-border bg-surface">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/login" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
              <span className="text-primary-foreground font-black text-sm">MC</span>
            </div>
            <span className="font-semibold text-text-primary">ERP Mister Group</span>
          </Link>
          <span className="text-xs text-text-disabled">ERP · Mister Group</span>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-12">

        <div className="mb-10">
          <h1 className="text-3xl font-bold text-text-primary mb-2">Política de Privacidad</h1>
          <p className="text-text-disabled text-sm">Última actualización: abril 2026 · Vigente conforme a la Ley N° 19.628 de Chile</p>
        </div>

        <div className="space-y-10 text-text-secondary leading-relaxed">

          {/* 1 */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">1</span>
              Identificación del responsable
            </h2>
            <p>
              El responsable del tratamiento de los datos personales es <strong className="text-text-primary">Mister Group</strong>,
              titular de la plataforma <em>ERP Mister Group</em> (en adelante, "el ERP"),
              accesible en <strong className="text-text-primary">erp.mistercontador.cl</strong>.
            </p>
            <p className="mt-2">
              Para consultas relacionadas con privacidad o protección de datos, puede contactarnos en:{' '}
              <a href="mailto:mrcontadorchile@gmail.com" className="text-primary hover:underline">
                mrcontadorchile@gmail.com
              </a>
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">2</span>
              Datos personales que recopilamos
            </h2>
            <p>Al utilizar el ERP, podemos recopilar los siguientes datos personales:</p>
            <div className="mt-4 space-y-3">
              {[
                { icon: '👤', title: 'Nombre completo', desc: 'Obtenido mediante el registro manual o a través de la autenticación con Google OAuth.' },
                { icon: '📧', title: 'Correo electrónico', desc: 'Utilizado como identificador único de la cuenta y medio de comunicación.' },
                { icon: '🖼️', title: 'Foto de perfil', desc: 'Obtenida opcionalmente desde Google OAuth para personalizar la experiencia en la plataforma.' },
                { icon: '🔐', title: 'Credenciales de acceso', desc: 'Contraseña almacenada de forma cifrada. Nunca se almacena en texto plano.' },
                { icon: '🏢', title: 'Datos de empresa', desc: 'RUT, razón social y datos contables ingresados para la operación del servicio.' },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="flex gap-3 p-4 bg-surface rounded-xl border border-border">
                  <span className="text-xl shrink-0">{icon}</span>
                  <div>
                    <p className="font-medium text-text-primary text-sm">{title}</p>
                    <p className="text-sm mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">3</span>
              Finalidad del tratamiento
            </h2>
            <p>Los datos personales son tratados exclusivamente para los siguientes fines:</p>
            <ul className="mt-3 space-y-2 ml-4">
              {[
                'Identificar y autenticar al usuario dentro del ERP.',
                'Gestionar los servicios contables y financieros contratados por la Pyme.',
                'Personalizar la experiencia de uso dentro de la plataforma.',
                'Enviar notificaciones operacionales relacionadas con el servicio (invitaciones, alertas, actualizaciones).',
                'Cumplir con obligaciones legales aplicables en Chile.',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-primary mt-0.5 shrink-0">→</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm">
              <strong className="text-text-primary">No utilizamos los datos para publicidad, perfilamiento comercial ni los compartimos con terceros</strong> salvo obligación legal expresa.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">4</span>
              Base legal del tratamiento
            </h2>
            <p>
              El tratamiento de datos se realiza conforme a la{' '}
              <strong className="text-text-primary">Ley N° 19.628 sobre Protección de la Vida Privada</strong> de Chile,
              y se basa en:
            </p>
            <ul className="mt-3 space-y-2 ml-4">
              {[
                'El consentimiento explícito del usuario al registrarse y utilizar la plataforma.',
                'La ejecución de un contrato de servicios entre Mister Group y la empresa usuaria.',
                'El cumplimiento de obligaciones legales tributarias y contables.',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-primary mt-0.5 shrink-0">→</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">5</span>
              Almacenamiento y seguridad
            </h2>
            <p>
              Los datos son almacenados en <strong className="text-text-primary">Supabase</strong>,
              plataforma de base de datos en la nube con cifrado en tránsito (TLS) y en reposo.
              Los servidores se encuentran en infraestructura segura con acceso restringido.
            </p>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { icon: '🔒', label: 'Cifrado TLS', desc: 'En tránsito y en reposo' },
                { icon: '🚫', label: 'Sin venta de datos', desc: 'Nunca cedemos datos a terceros' },
                { icon: '🛡️', label: 'Acceso limitado', desc: 'Solo personal autorizado' },
              ].map(({ icon, label, desc }) => (
                <div key={label} className="p-4 bg-surface rounded-xl border border-border text-center">
                  <div className="text-2xl mb-1">{icon}</div>
                  <p className="font-medium text-text-primary text-sm">{label}</p>
                  <p className="text-xs text-text-disabled mt-0.5">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">6</span>
              Autenticación con Google
            </h2>
            <p>
              El ERP ofrece la opción de iniciar sesión mediante <strong className="text-text-primary">Google OAuth 2.0</strong>.
              Al utilizar este método, Google comparte con nosotros únicamente el nombre, correo electrónico
              y foto de perfil del usuario, con su consentimiento previo.
            </p>
            <p className="mt-2">
              El uso de Google OAuth está sujeto además a la{' '}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer"
                className="text-primary hover:underline">
                Política de Privacidad de Google
              </a>.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">7</span>
              Derechos del titular de los datos
            </h2>
            <p>De acuerdo con la Ley N° 19.628, el titular tiene derecho a:</p>
            <ul className="mt-3 space-y-2 ml-4">
              {[
                'Acceder a sus datos personales almacenados.',
                'Rectificar datos incorrectos o desactualizados.',
                'Solicitar la eliminación de sus datos (derecho al olvido).',
                'Oponerse al tratamiento de sus datos en determinadas circunstancias.',
                'Solicitar la portabilidad de sus datos en formato legible.',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-primary mt-0.5 shrink-0">→</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm">
              Para ejercer cualquiera de estos derechos, escríbenos a{' '}
              <a href="mailto:mrcontadorchile@gmail.com" className="text-primary hover:underline">
                mrcontadorchile@gmail.com
              </a>{' '}
              indicando tu nombre, email y la solicitud específica. Responderemos en un plazo máximo de 15 días hábiles.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">8</span>
              Retención de datos
            </h2>
            <p>
              Los datos se conservan mientras la cuenta esté activa o sea necesaria para la prestación del servicio.
              Una vez solicitada la baja o eliminación, los datos serán suprimidos en un plazo máximo de
              <strong className="text-text-primary"> 30 días hábiles</strong>, salvo obligación legal de conservación.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">9</span>
              Modificaciones a esta política
            </h2>
            <p>
              Mister Group se reserva el derecho de actualizar esta política de privacidad.
              Cualquier cambio relevante será notificado a los usuarios a través del correo electrónico
              registrado o mediante un aviso destacado en la plataforma.
            </p>
          </section>

          {/* Contact */}
          <div className="p-6 bg-surface rounded-2xl border border-border text-center">
            <p className="text-text-primary font-semibold mb-1">¿Tienes preguntas sobre esta política?</p>
            <p className="text-sm text-text-secondary mb-4">Estamos para ayudarte.</p>
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

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-16 py-6 text-center">
        <p className="text-xs text-text-disabled">
          Mister Group © {new Date().getFullYear()} · <Link href="/login" className="hover:text-text-secondary transition-colors">Volver al ERP</Link>
        </p>
      </footer>

    </div>
  )
}
