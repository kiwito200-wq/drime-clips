// Field types supported by the document builder
export type FieldType = 
  | 'signature' 
  | 'initials' 
  | 'checkbox' 
  | 'date' 
  | 'text' 
  | 'name' 
  | 'email'
  | 'number'
  | 'phone'
  | 'select'
  | 'radio'
  | 'image'
  | 'file'
  | 'stamp'

// A field placed on the document
export interface Field {
  id: string
  type: FieldType
  recipientId: string
  page: number
  // Position as percentage of page (0-1)
  x: number
  y: number
  // Size as percentage of page (0-1)
  width: number
  height: number
  // Field settings
  required: boolean
  label: string
  placeholder: string
  // Optional default value
  defaultValue?: string
  // For text fields
  fontSize?: number
  // Filled value (signature data URL, text, checkbox state, etc.)
  value?: string | boolean | string[]
  // For select/radio fields - options
  options?: string[]
  // For number fields
  min?: number
  max?: number
}

// A recipient who needs to sign the document
export interface Recipient {
  id: string
  name: string
  email: string
  color: string
}

// The complete document template
export interface DocumentTemplate {
  id: string
  name: string
  fileName: string
  recipients: Recipient[]
  fields: Field[]
  createdAt: string
}

// Field palette item for drag & drop
export interface FieldPaletteItem {
  type: FieldType
  label: string
  icon: string
  description: string
}

// PDF page info
export interface PDFPageInfo {
  width: number
  height: number
  pageNumber: number
}
