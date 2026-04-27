# Mister ERP — Documentación Técnica

ERP contable y de gestión empresarial para el mercado chileno, desarrollado sobre **Next.js 15 + Supabase**. Incluye contabilidad completa, remuneraciones, gestión presupuestaria e integración con el SII.

**Producción:** https://erp.mistercontador.cl

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 15 (App Router) |
| Lenguaje | TypeScript |
| Base de datos | PostgreSQL vía Supabase |
| Autenticación | Supabase Auth (email/contraseña + Google OAuth) |
| Estilos | Tailwind CSS (tema oscuro custom) |
| Gráficos | Recharts |
| Excel export | xlsx |
| PDF | @react-pdf/renderer |
| Email | Resend |
| Deploy | Vercel |
| Formularios | React Hook Form + Zod |

---

## Variables de entorno

Crear `.env.local` en la raíz del proyecto:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>       # solo server-side
NEXT_PUBLIC_APP_URL=https://erp.mistercontador.cl
RESEND_API_KEY=<resend key>                        # envío de emails
ANTHROPIC_API_KEY=<anthropic key>                  # IA contable
```

---

## Estructura del proyecto

```
src/
├── app/                          # Rutas Next.js (App Router)
│   ├── auth/                     # Flujos de autenticación
│   │   ├── callback/             # OAuth callback + activación de invitaciones
│   │   ├── aceptar-invitacion/   # Página de registro para usuarios invitados
│   │   ├── configurar-cuenta/    # Onboarding primer acceso
│   │   ├── recuperar/            # Recuperar contraseña
│   │   └── nueva-contrasena/     # Reset contraseña
│   ├── contabilidad/             # Módulo de contabilidad
│   │   ├── dashboard/            # KPIs + gráficos Recharts (6 meses)
│   │   ├── libro-diario/         # CRUD asientos + export Excel
│   │   │   └── nuevo/            # Formulario + plantillas recurrentes
│   │   ├── libro-mayor/          # Movimientos por cuenta
│   │   ├── plan-cuentas/         # Árbol de cuentas (8 niveles)
│   │   ├── centros-costo/        # CRUD centros de costo
│   │   ├── auxiliares/           # Clientes, proveedores, empleados
│   │   ├── documentos-sii/       # Facturas/boletas importadas del SII
│   │   ├── importar-sii/         # Parser XML SII → tax_documents
│   │   ├── periodos/             # Abrir/cerrar períodos contables
│   │   ├── validaciones/         # Validaciones IA sobre documentos SII
│   │   ├── ia-agente/            # Chat con agente contable (Anthropic)
│   │   ├── analisis/             # Análisis por cuenta y por auxiliar
│   │   ├── configuracion/        # Config de empresa (RUT, razón social, etc.)
│   │   └── reportes/
│   │       ├── eerr/             # Estado de Resultados (+ comparativo período)
│   │       ├── balance-clasificado/  # Balance (+ comparativo período)
│   │       ├── balance-8col/     # Balance 8 columnas
│   │       ├── centros-costo/    # Reporte por CC
│   │       ├── libro-compras/    # Libro de compras SII
│   │       ├── libro-ventas/     # Libro de ventas SII
│   │       └── libro-honorarios/ # Libro de honorarios SII
│   ├── gestion/                  # Módulo de gestión presupuestaria
│   │   ├── dashboard/            # Ejecución presupuestaria por presupuesto activo
│   │   ├── presupuestos/         # CRUD presupuestos + workflow aprobación
│   │   │   ├── nuevo/            # Paso 1 (cabecera) + Paso 2 (líneas × 12 meses)
│   │   │   └── [id]/             # Editor de líneas + acciones de estado
│   │   └── control/              # Presupuesto vs Real con semáforo y varianza
│   ├── remuneraciones/           # Módulo de remuneraciones (Chile)
│   │   ├── dashboard/
│   │   ├── empleados/
│   │   ├── liquidaciones/        # Liquidaciones de sueldo
│   │   ├── periodos/
│   │   ├── finiquitos/
│   │   ├── libro-remuneraciones/
│   │   ├── parametros/           # UF, UTM, tasa AFP, etc.
│   │   └── previred/             # Archivo para pago Previred
│   ├── sistema/                  # Administración de accesos
│   │   ├── usuarios/             # Invitar/gestionar usuarios de la empresa
│   │   └── roles/                # RBAC: crear roles y asignar permisos
│   ├── superadmin/               # Panel solo para superadmins
│   │   └── empresas/             # CRUD de empresas del SaaS
│   └── api/
│       ├── ia-agente/            # Endpoint streaming Anthropic (IA contable)
│       └── remuneraciones/
│           └── previred/         # Generador archivo Previred
├── components/
│   └── layout/
│       ├── sidebar.tsx           # Sidebar módulo Contabilidad
│       └── sidebar-gestion.tsx   # Sidebar módulo Gestión
├── lib/
│   ├── supabase/
│   │   ├── server.ts             # createClient() — SSR con cookies
│   │   ├── client.ts             # createClient() — browser
│   │   ├── admin.ts              # createAdminClient() — service role (solo server)
│   │   ├── conta.ts              # helpers schema 'conta'
│   │   └── remu.ts               # helpers schema 'remuneraciones'
│   ├── permissions.ts            # Constantes RBAC + MODULE_PERMISSIONS
│   ├── utils.ts                  # formatCLP, formatNumber, monthName, etc.
│   ├── features.ts               # hasFeature() — feature flags por empresa
│   ├── doc-types.ts              # Tipos de documentos SII (33, 34, 61, etc.)
│   └── libro-sii.ts              # Lógica libros SII (compras/ventas/honorarios)
├── middleware.ts                 # Auth guard global (redirige a /login)
└── types/
    └── database.ts               # Tipos TypeScript de las tablas Supabase
```

---

## Base de datos (Supabase / PostgreSQL)

El proyecto usa **dos esquemas** separados:

### Esquema `public` — Multi-tenant y usuarios

| Tabla | Descripción |
|-------|-------------|
| `companies` | Empresas (tenants). Cada empresa es un tenant aislado. |
| `user_profiles` | Perfil de cada usuario. `company_id` = empresa activa. |
| `user_company_memberships` | Relación usuario ↔ empresa con rol y estado. |
| `erp_roles` | Roles RBAC definidos por empresa (`admin`, `contador`, etc.). |
| `user_invitations` | Invitaciones pendientes por email (token UUID). |
| `invitations` | Sistema de invitaciones nuevo (email-based, sin pre-crear usuario). |
| `company_features` | Feature flags por empresa. |
| `company_sii_configs` | Credenciales SII (RUT, clave, certificado). |
| `audit_logs` | Log de acciones críticas. |
| `chat_sessions` / `chat_messages` | Historial del agente IA. |

### Esquema `conta` — Contabilidad

| Tabla | Descripción |
|-------|-------------|
| `accounts` | Plan de cuentas (código, nombre, tipo, naturaleza). |
| `cost_centers` | Centros de costo. |
| `auxiliaries` | Auxiliares (clientes, proveedores, empleados). |
| `periods` | Períodos contables (año/mes, estado abierto/cerrado). |
| `journal_entries` | Cabecera de asiento (glosa, fecha, período, estado). |
| `journal_lines` | Líneas de asiento (cuenta, debe, haber, CC, auxiliar). |
| `tax_documents` | Documentos SII importados (facturas, boletas, NC). |
| `asientos_borrador` | Asientos generados por IA en espera de validación. |
| `asiento_templates` | Plantillas de asientos recurrentes (JSONB con líneas). |
| `budgets` | Cabecera de presupuesto (año, tipo, estado, workflow). |
| `budget_lines` | Líneas presupuestarias (cuenta, CC, mes 1-12, monto). |
| `reglas_contables` | Reglas IA para contabilización automática de docs SII. |
| `configuracion_asistente` | Config del agente IA por empresa. |
| `memoria_aprendizaje` | Memoria del agente IA por empresa. |

### RPCs principales

| Función | Uso |
|---------|-----|
| `get_account_balances(company_id, year, month_from, month_to)` | Saldos por cuenta para EERR, Balance y Dashboard |
| `get_budget_vs_actual(company_id, budget_id, month_from, month_to, cc_id)` | Control presupuestario (presupuesto vs asientos reales) |
| `get_user_permissions(user_id, company_id)` | Array de permisos del usuario (RBAC) |
| `get_user_companies(user_id)` | Empresas accesibles por el usuario |
| `accept_invitation(user_id, email)` | Activa membresía al confirmar invitación |
| `get_invitation_by_token(token)` | Lookup público de invitación (SECURITY DEFINER, anon) |

---

## Arquitectura de autenticación y multi-tenancy

```
Usuario                Supabase Auth          Next.js
  │                        │                     │
  ├─ Login (email/Google) ─►│                     │
  │                        ├─── callback ────────►│
  │                        │              accept_invitation()
  │                        │              upsert user_profiles
  │                        │              set company_id activo
  │◄──────────────────────────────────── redirect /
  │
  │  Cada request:
  ├─ cookie sesión ────────────────────► middleware.ts
  │                                         └─ getUser() → si no hay sesión → /login
  │
  │  En Server Components:
  └─ createClient() usa cookies() → dinámico (sin caché Next.js)
     ├─ RLS de Supabase filtra por company_id automáticamente
     └─ get_my_company_id() → helper usado en todas las policies
```

**Multi-tenancy**: cada tabla del esquema `conta` tiene `company_id`. Las políticas RLS filtran automáticamente — el usuario solo ve sus propios datos. No hay filtro manual en el código.

---

## Sistema de permisos (RBAC)

Los permisos se definen en `src/lib/permissions.ts` como constantes (`PERMISSIONS`).

```
conta.diario.view       — ver asientos
conta.diario.create     — crear asientos
conta.reportes.view     — ver reportes
conta.reportes.export   — exportar Excel/PDF
gestion.view            — ver presupuestos
gestion.create          — crear presupuestos
gestion.approve         — aprobar presupuestos (no puede ser el mismo creador)
sistema.usuarios        — invitar/gestionar usuarios
sistema.roles           — gestionar roles
...
```

El permiso `*` es superadmin: acceso total.

En **Server Components**: se llama a `supabase.rpc('get_user_permissions', ...)` y se compara con `hasPermission(perms, PERMISSIONS.X)`.

En **Client Components**: los permisos se pasan como props desde el Server Component padre.

---

## Flujo de datos contables

```
Libro Diario (journal_entries + journal_lines)
        │
        ├──► Libro Mayor        (filtro por cuenta)
        ├──► EERR               (RPC get_account_balances, tipos INGRESO/COSTO/EGRESO)
        ├──► Balance Clasificado (RPC get_account_balances, tipos ACTIVO/PASIVO/PATRIMONIO)
        ├──► Balance 8 Columnas  (mismo RPC, formato diferente)
        ├──► Dashboard          (mismo RPC, últimos 6 meses en paralelo)
        └──► Control Presupuestario (RPC get_budget_vs_actual, full outer join vs budget_lines)
```

**Regla clave**: los informes leen directamente de `journal_lines` vía RPC. No hay tablas de saldos precalculados. Si un asiento se elimina, todos los informes reflejan el cambio inmediatamente.

**Naturaleza de cuentas**:
- `DEUDOR`: saldo normal = debit - credit (activos, gastos, costos)
- `ACREEDOR`: saldo normal = credit - debit (pasivos, patrimonio, ingresos)

---

## Flujo de invitaciones

```
1. Admin invita email → INSERT public.invitations (token UUID)
2. Se envía email con link /auth/aceptar-invitacion?token=XXX  (Resend)
3. Invitado abre link → ve nombre empresa, elige Google o email/contraseña
4. Auth callback (/auth/callback):
   - exchange code
   - upsert user_profiles
   - RPC accept_invitation(user_id, email) → crea membership, marca aceptada
   - redirect → /
```

---

## Workflow de presupuestos

```
draft  ──[Enviar a aprobación]──►  pending_approval
                                         │
                                   [Aprobar] (requiere gestion.approve
                                    y NO puede ser el mismo creador)
                                         │
                                       approved
                                         │
                                    [Activar]
                                         │
                                       active ──[Cerrar]──► closed
```

Tipos de presupuesto:
- **Año Calendario**: Jan–Dec año fijo
- **Rolling Forecast**: 12 meses móviles desde mes/año de inicio (cruza años)

---

## Módulos y sus layouts

Cada módulo tiene su propio layout que carga autenticación, permisos y empresa activa:

| Módulo | Layout | Shell | Sidebar |
|--------|--------|-------|---------|
| Contabilidad | `contabilidad/layout.tsx` | `contabilidad/shell.tsx` | `sidebar.tsx` |
| Gestión | `gestion/layout.tsx` | `gestion/shell.tsx` | `sidebar-gestion.tsx` |
| Remuneraciones | `remuneraciones/layout.tsx` | su propio shell | — |
| Sistema | dentro del layout raíz | — | — |

---

## Convenciones de código

### Server Components (por defecto)
```tsx
// Sin 'use client' → Server Component
export default async function MiPagina() {
  const supabase = await createClient()   // SSR client con cookies
  const { data } = await supabase.schema('conta').from('accounts')...
  return <MiClientComponent data={data} />
}
```

### Client Components
```tsx
'use client'
// Reciben datos como props, manejan estado interactivo
export function MiClientComponent({ data }: { data: MyType[] }) { ... }
```

### Server Actions
```ts
'use server'
// Mutations que se llaman desde Client Components
export async function crearAsiento(...)  {
  const supabase = await createClient()
  // supabase usa la sesión del usuario que hizo la request
  ...
  revalidatePath('/contabilidad/libro-diario')
}
```

### Cliente Admin (solo server)
```ts
import { createAdminClient } from '@/lib/supabase/admin'
// Usa SERVICE_ROLE_KEY → bypasea RLS
// Solo para: callbacks de auth, invitaciones, operaciones superadmin
const admin = createAdminClient()
```

---

## Desarrollo local

```bash
# Instalar dependencias
npm install

# Variables de entorno
cp .env.local.example .env.local  # completar con keys de Supabase

# Servidor de desarrollo
npm run dev        # http://localhost:3000

# Build de producción
npm run build

# Type-check sin compilar
npx tsc --noEmit
```

---

## Deploy

El proyecto se despliega en **Vercel** con integración GitHub. El push a `main` dispara el deploy automáticamente.

Para deploy manual:
```bash
vercel deploy --prod --yes --no-wait
```

El proyecto Vercel está en la organización `mrcontadorchile-cpus-projects`, proyecto `mister-erp-web`.

---

## Consideraciones importantes

1. **RLS siempre activa**: nunca desactivar RLS en producción. Usar `createAdminClient()` solo cuando sea estrictamente necesario (callbacks de auth, superadmin).

2. **Trigger en journal_lines**: `trg_prevent_closed_period` bloquea INSERT/UPDATE/DELETE en líneas de períodos cerrados. Para DELETE, el trigger retorna `OLD` (no `NEW`). Si se modifica este trigger, asegurarse de mantener ese comportamiento.

3. **get_account_balances y el LEFT JOIN**: el RPC hace LEFT JOIN de `accounts → journal_lines → journal_entries → periods`. Si hay `journal_lines` huérfanas (con `entry_id` apuntando a entradas eliminadas), aparecerán en los saldos. El trigger RLS en `journal_lines` filtra por `entry_id IN (company entries)`, lo que puede impedir borrar líneas huérfanas — usar `DISABLE ROW LEVEL SECURITY` + `ENABLE ROW LEVEL SECURITY` en la misma transacción si es necesario.

4. **Períodos contables**: los asientos solo pueden crearse en períodos abiertos. Crear el período primero desde `/contabilidad/periodos`.

5. **Schema `conta`**: todas las tablas contables están en el schema `conta`, no en `public`. Usar `.schema('conta').from('tabla')` en el cliente Supabase.
