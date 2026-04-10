// ─────────────────────────────────────────────────────────────
// Permission constants & helpers for RBAC
// ─────────────────────────────────────────────────────────────

export const PERMISSIONS = {
  // ── Contabilidad / Libro Diario ──────────────────────────
  CONTA_DIARIO_VIEW:    'conta.diario.view',
  CONTA_DIARIO_CREATE:  'conta.diario.create',
  CONTA_DIARIO_EDIT:    'conta.diario.edit',
  CONTA_DIARIO_REVERSE: 'conta.diario.reverse',
  // ── Libro Mayor ──────────────────────────────────────────
  CONTA_MAYOR_VIEW:     'conta.mayor.view',
  // ── Auxiliares ───────────────────────────────────────────
  CONTA_AUXILIARES_VIEW:   'conta.auxiliares.view',
  CONTA_AUXILIARES_MANAGE: 'conta.auxiliares.manage',
  // ── Análisis ─────────────────────────────────────────────
  CONTA_ANALISIS_VIEW:  'conta.analisis.view',
  // ── Reportes ─────────────────────────────────────────────
  CONTA_REPORTES_VIEW:   'conta.reportes.view',
  CONTA_REPORTES_EXPORT: 'conta.reportes.export',
  // ── SII ──────────────────────────────────────────────────
  CONTA_SII_VIEW:   'conta.sii.view',
  CONTA_SII_IMPORT: 'conta.sii.import',
  // ── Plan de cuentas ──────────────────────────────────────
  CONTA_PLAN_VIEW:   'conta.plan.view',
  CONTA_PLAN_MANAGE: 'conta.plan.manage',
  // ── Períodos ─────────────────────────────────────────────
  CONTA_PERIODOS_VIEW:   'conta.periodos.view',
  CONTA_PERIODOS_MANAGE: 'conta.periodos.manage',
  // ── Configuración ────────────────────────────────────────
  CONTA_CONFIG_VIEW:   'conta.config.view',
  CONTA_CONFIG_MANAGE: 'conta.config.manage',
  // ── Sistema (RBAC) ───────────────────────────────────────
  SISTEMA_USUARIOS: 'sistema.usuarios',
  SISTEMA_ROLES:    'sistema.roles',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

/** Returns true if the user's permissions include the required permission (or '*'). */
export function hasPermission(userPermissions: string[], permission: string): boolean {
  return userPermissions.includes('*') || userPermissions.includes(permission)
}

/** Returns true if the user has ALL of the listed permissions. */
export function hasAllPermissions(userPermissions: string[], permissions: string[]): boolean {
  return permissions.every(p => hasPermission(userPermissions, p))
}

/** Returns true if the user has ANY of the listed permissions. */
export function hasAnyPermission(userPermissions: string[], permissions: string[]): boolean {
  return permissions.some(p => hasPermission(userPermissions, p))
}

/** Returns true if the user is a full admin ('*' permission). */
export function isAdmin(userPermissions: string[]): boolean {
  return userPermissions.includes('*')
}

// ─────────────────────────────────────────────────────────────
// Permission groups for the roles editor UI
// ─────────────────────────────────────────────────────────────
export const PERMISSION_GROUPS = [
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
      { key: PERMISSIONS.CONTA_REPORTES_EXPORT, label: 'Exportar reportes (Excel/PDF)' },
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
      { key: PERMISSIONS.CONTA_PERIODOS_MANAGE, label: 'Abrir/cerrar períodos' },
    ],
  },
  {
    group: 'Configuración',
    permissions: [
      { key: PERMISSIONS.CONTA_CONFIG_VIEW,   label: 'Ver configuración' },
      { key: PERMISSIONS.CONTA_CONFIG_MANAGE, label: 'Editar configuración empresa' },
    ],
  },
  {
    group: 'Sistema',
    permissions: [
      { key: PERMISSIONS.SISTEMA_USUARIOS, label: 'Gestionar usuarios' },
      { key: PERMISSIONS.SISTEMA_ROLES,    label: 'Gestionar roles' },
    ],
  },
]
