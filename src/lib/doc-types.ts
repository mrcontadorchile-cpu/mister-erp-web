// Tipos de documentos tributarios electrónicos (DTE) Chile
export const DOC_TYPES = [
  { value: '33',  label: 'Factura Afecta',          short: 'FA-33'  },
  { value: '34',  label: 'Factura Exenta',           short: 'FE-34'  },
  { value: '46',  label: 'Factura de Compra',        short: 'FC-46'  },
  { value: '39',  label: 'Boleta Afecta',            short: 'BA-39'  },
  { value: '41',  label: 'Boleta Exenta',            short: 'BE-41'  },
  { value: '52',  label: 'Guía de Despacho',         short: 'GD-52'  },
  { value: '56',  label: 'Nota de Débito',           short: 'ND-56'  },
  { value: '61',  label: 'Nota de Crédito',          short: 'NC-61'  },
  { value: 'BHE', label: 'Boleta de Honorarios',     short: 'BHE'    },
  { value: 'LIQ', label: 'Liquidación Factura',      short: 'LIQ'    },
  { value: 'OTR', label: 'Otro documento',           short: 'OTR'    },
] as const

export type DocTypeValue = typeof DOC_TYPES[number]['value']

export function docTypeLabel(value: string): string {
  return DOC_TYPES.find(d => d.value === value)?.label ?? value
}

export function docTypeShort(value: string): string {
  return DOC_TYPES.find(d => d.value === value)?.short ?? value
}
