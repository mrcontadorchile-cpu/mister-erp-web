// ─────────────────────────────────────────────────────────────
// Permission constants & helpers for RBAC
// ─────────────────────────────────────────────────────────────

export const PERMISSIONS = {
  // ── Contabilidad ─────────────────────────────────────────
  CONTA_DIARIO_VIEW:       'conta.diario.view',
  CONTA_DIARIO_CREATE:     'conta.diario.create',
  CONTA_DIARIO_EDIT:       'conta.diario.edit',
  CONTA_DIARIO_REVERSE:    'conta.diario.reverse',
  CONTA_MAYOR_VIEW:        'conta.mayor.view',
  CONTA_AUXILIARES_VIEW:   'conta.auxiliares.view',
  CONTA_AUXILIARES_MANAGE: 'conta.auxiliares.manage',
  CONTA_ANALISIS_VIEW:     'conta.analisis.view',
  CONTA_REPORTES_VIEW:     'conta.reportes.view',
  CONTA_REPORTES_EXPORT:   'conta.reportes.export',
  CONTA_SII_VIEW:          'conta.sii.view',
  CONTA_SII_IMPORT:        'conta.sii.import',
  CONTA_PLAN_VIEW:         'conta.plan.view',
  CONTA_PLAN_MANAGE:       'conta.plan.manage',
  CONTA_PERIODOS_VIEW:     'conta.periodos.view',
  CONTA_PERIODOS_MANAGE:   'conta.periodos.manage',
  CONTA_CONFIG_VIEW:       'conta.config.view',
  CONTA_CONFIG_MANAGE:     'conta.config.manage',
  // ── Remuneraciones ───────────────────────────────────────
  REMU_DASHBOARD_VIEW:       'remu.dashboard.view',
  REMU_EMPLEADOS_VIEW:       'remu.empleados.view',
  REMU_EMPLEADOS_MANAGE:     'remu.empleados.manage',
  REMU_LIQUIDACIONES_VIEW:   'remu.liquidaciones.view',
  REMU_LIQUIDACIONES_CREATE: 'remu.liquidaciones.create',
  REMU_PERIODOS_VIEW:        'remu.periodos.view',
  REMU_PERIODOS_MANAGE:      'remu.periodos.manage',
  REMU_CONFIG_VIEW:          'remu.config.view',
  REMU_CONFIG_MANAGE:        'remu.config.manage',
  // ── Sistema (RBAC) ───────────────────────────────────────
  SISTEMA_USUARIOS: 'sistema.usuarios',
  SISTEMA_ROLES:    'sistema.roles',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

export function hasPermission(userPermissions: string[], permission: string): boolean {
  return userPermissions.includes('*') || userPermissions.includes(permission)
}

export function hasAllPermissions(userPermissions: string[], permissions: string[]): boolean {
  return permissions.every(p => hasPermission(userPermissions, p))
}

export function hasAnyPermission(userPermissions: string[], permissions: string[]): boolean {
  return permissions.some(p => hasPermission(userPermissions, p))
}

export function isAdmin(userPermissions: string[]): boolean {
  return userPermissions.includes('*')
}

/** Returns true if the user has access to any permission in the given module prefix. */
export function hasModuleAccess(userPermissions: string[], modulePrefix: string): boolean {
  if (userPermissions.includes('*')) return true
  return userPermissions.some(p => p.startsWith(`${modulePrefix}.`))
}

// ─────────────────────────────────────────────────────────────
// Module-based permission groups for the roles editor UI
// ─────────────────────────────────────────────────────────────

export const MODULE_PERMISSIONS = [
  {
    module: 'conta',
    label: 'Contabilidad',
    description: 'Libro diario, mayor, reportes, SII, plan de cuentas',
    groups: [
      {
        group: 'Libro Diario',
        permissions: [
          { key: PERMISSIONS.CONTA_DIARIO_VIEW,    label: 'Ver asientos' },
          { key: PERMISSIONS.CONTA_DIARIO_CREATE,  label: 'Crear asientos' },
          { key: PERMISSIONS.CONTA_DIARIO_EDIT,    label: 'Editar asientos' },
          { key: PERMISSIONS.CONTA_DIARIO_REVERSE, label: 'Revertir asientos' },
        ],
      },
      {
        group: 'Libro Mayor',
        permissions: [
          { key: PERMISSIONS.CONTA_MAYOR_VIEW, label: 'Ver libro mayor' },
        ],
      },
      {
        group: 'Auxiliares',
        permissions: [
          { key: PERMISSIONS.CONTA_AUXILIARES_VIEW,   label: 'Ver auxiliares' },
          { key: PERMISSIONS.CONTA_AUXILIARES_MANAGE, label: 'Gestionar auxiliares' },
        ],
      },
      {
        group: 'Análisis',
        permissions: [
          { key: PERMISSIONS.CONTA_ANALISIS_VIEW, label: 'Ver análisis de documentos' },
        ],
      },
      {
        group: 'Reportes',
        permissions: [
          { key: PERMISSIONS.CONTA_REPORTES_VIEW,   label: 'Ver reportes' },
          { key: PERMISSIONS.CONTA_REPORTES_EXPORT, label: 'Exportar (Excel / PDF)' },
        ],
      },
      {
        group: 'Documentos SII',
        permissions: [
          { key: PERMISSIONS.CONTA_SII_VIEW,   label: 'Ver documentos SII' },
          { key: PERMISSIONS.CONTA_SII_IMPORT, label: 'Importar desde SII' },
        ],
      },
      {
        group: 'Plan de Cuentas',
        permissions: [
          { key: PERMISSIONS.CONTA_PLAN_VIEW,   label: 'Ver plan de cuentas' },
          { key: PERMISSIONS.CONTA_PLAN_MANAGE, label: 'Gestionar plan de cuentas' },
        ],
      },
      {
        group: 'Períodos',
        permissions: [
          { key: PERMISSIONS.CONTA_PERIODOS_VIEW,   label: 'Ver períodos' },
          { key: PERMISSIONS.CONTA_PERIODOS_MANAGE, label: 'Abrir / cerrar períodos' },
        ],
      },
      {
        group: 'Configuración',
        permissions: [
          { key: PERMISSIONS.CONTA_CONFIG_VIEW,   label: 'Ver configuración' },
          { key: PERMISSIONS.CONTA_CONFIG_MANAGE, label: 'Editar configuración empresa' },
        ],
      },
    ],
  },
  {
    module: 'remu',
    label: 'Remuneraciones',
    description: 'Empleados, liquidaciones de sueldo, cotizaciones',
    groups: [
      {
        group: 'Dashboard',
        permissions: [
          { key: PERMISSIONS.REMU_DASHBOARD_VIEW, label: 'Ver dashboard' },
        ],
      },
      {
        group: 'Empleados',
        permissions: [
          { key: PERMISSIONS.REMU_EMPLEADOS_VIEW,   label: 'Ver empleados' },
          { key: PERMISSIONS.REMU_EMPLEADOS_MANAGE, label: 'Gestionar empleados' },
        ],
      },
      {
        group: 'Liquidaciones',
        permissions: [
          { key: PERMISSIONS.REMU_LIQUIDACIONES_VIEW,   label: 'Ver liquidaciones' },
          { key: PERMISSIONS.REMU_LIQUIDACIONES_CREATE, label: 'Crear liquidaciones' },
        ],
      },
      {
        group: 'Períodos',
        permissions: [
          { key: PERMISSIONS.REMU_PERIODOS_VIEW,   label: 'Ver períodos' },
          { key: PERMISSIONS.REMU_PERIODOS_MANAGE, label: 'Abrir / cerrar períodos' },
        ],
      },
      {
        group: 'Configuración',
        permissions: [
          { key: PERMISSIONS.REMU_CONFIG_VIEW,   label: 'Ver configuración' },
          { key: PERMISSIONS.REMU_CONFIG_MANAGE, label: 'Editar configuración' },
        ],
      },
    ],
  },
  {
    module: 'sistema',
    label: 'Seguridad',
    description: 'Gestión de usuarios, roles y permisos de acceso',
    groups: [
      {
        group: 'Administración',
        permissions: [
          { key: PERMISSIONS.SISTEMA_USUARIOS, label: 'Gestionar usuarios' },
          { key: PERMISSIONS.SISTEMA_ROLES,    label: 'Gestionar roles y permisos' },
        ],
      },
    ],
  },
]

/** Returns all permission keys for a module prefix (used for "select all" toggle). */
export function getModuleAllPermissions(modulePrefix: string): string[] {
  const mod = MODULE_PERMISSIONS.find(m => m.module === modulePrefix)
  if (!mod) return []
  return mod.groups.flatMap(g => g.permissions.map(p => p.key))
}

// Legacy flat list kept for any existing imports
export const PERMISSION_GROUPS = MODULE_PERMISSIONS.flatMap(m =>
  m.groups.map(g => ({
    group: `${m.label} — ${g.group}`,
    permissions: g.permissions,
  }))
)
