interface Checkbox {
  type: 'checkbox'
  property: string
  label?: string
  value?: boolean
}

interface Color {
  type: 'color'
  property: string
  label?: string
  value?: string
  notRequired?: boolean
}

interface Date {
  type: 'date'
  property: string
  label?: string
  min?: string
  max?: string
  value?: string
  notRequired?: boolean
}

interface Email {
  type: 'email'
  property: string
  label?: string
  pattern?: string
  maxLength?: number
  minLength?: number
  value?: string
  notRequired?: boolean
}

interface Number {
  type: 'number'
  property: string
  label?: string
  min?: number
  max?: number
  step?: number
  value?: number
  notRequired?: boolean
}

interface Password {
  type: 'password'
  property: string
  label?: string
  maxLength?: number
  minLength?: number
  pattern?: string
  value?: string
  notRequired?: boolean
}

interface Radio {
  type: 'radio'
  property: string
  label?: string
  options: string[] | SelectOption[]
  value?: string
}

interface Range {
  type: 'range'
  property: string
  label?: string
  min: number
  max: number
  step: number
  value?: number
  notRequired?: boolean
}

interface Tel {
  type: 'tel'
  property: string
  label?: string
  maxLength?: number
  minLength?: number
  pattern?: string
  value?: string
  notRequired?: boolean
}

interface Text {
  type: 'text'
  property: string
  label?: string
  maxLength?: number
  minLength?: number
  pattern?: string
  value?: string
  notRequired?: boolean
}

interface Textarea {
  type: 'textarea'
  property: string
  label?: string
  value?: string
  notRequired?: boolean
}

interface SelectOption {
  label: string
  value: string
}

interface Select {
  type: 'select'
  property: string
  label?: string
  options: SelectOption[] | string[]
  value?: string
}

type TextField = Email | Password | Tel | Text

export type Field = Checkbox
  | Color
  | Date
  | Number
  | Radio
  | Range
  | TextField
  | Textarea
  | Select

export interface SubmitAction {
  buttonLabel?: string
  method: 'POST' | 'GET' | 'PUT' | 'PATCH' | 'DELETE'
  url: string
  data?: 'body' | 'query'
  headers?: { [key: string]: string }
  loadingMessage?: string
  errorMessage?: string
  errorRedirectUrl?: string
  successMessage?: string
  successRedirectUrl?: string
}

interface FormaliseProps {
  fields: Field[]
  submit: SubmitAction
}

declare const formalise: (target: Element, props: FormaliseProps) => void;
export default formalise;