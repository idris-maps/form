export interface Checkbox {
  type: 'checkbox'
  property: string
  label?: string
  value?: boolean
}

export interface Color {
  type: 'color'
  property: string
  label?: string
  value?: string
  notRequired?: boolean
}

export interface Date {
  type: 'date'
  property: string
  label?: string
  min?: string
  max?: string
  value?: string
  notRequired?: boolean
}

export interface Email {
  type: 'email'
  property: string
  label?: string
  pattern?: string
  maxLength?: number
  minLength?: number
  value?: string
  notRequired?: boolean
}

export interface Number {
  type: 'number'
  property: string
  label?: string
  min?: number
  max?: number
  step?: number
  value?: number
  notRequired?: boolean
}

export interface Password {
  type: 'password'
  property: string
  label?: string
  maxLength?: number
  minLength?: number
  pattern?: string
  value?: string
  notRequired?: boolean
}

export interface Radio {
  type: 'radio'
  property: string
  label?: string
  options: string[] | SelectOption[]
  value?: string
}

export interface Range {
  type: 'range'
  property: string
  label?: string
  min: number
  max: number
  step: number
  value?: number
  notRequired?: boolean
}

export interface Tel {
  type: 'tel'
  property: string
  label?: string
  maxLength?: number
  minLength?: number
  pattern?: string
  value?: string
  notRequired?: boolean
}

export interface Text {
  type: 'text'
  property: string
  label?: string
  maxLength?: number
  minLength?: number
  pattern?: string
  value?: string
  notRequired?: boolean
}

export interface Textarea {
  type: 'textarea'
  property: string
  label?: string
  value?: string
  notRequired?: boolean
}

export interface SelectOption {
  label: string
  value: string
}

export interface Select {
  type: 'select'
  property: string
  label?: string
  options: SelectOption[] | string[]
  value?: string
}

export type TextField = Email | Password | Tel | Text

export type Field = Checkbox
  | Color
  | Date
  | Number
  | Radio
  | Range
  | TextField
  | Textarea
  | Select

export const isCheckbox = (d: Field): d is Checkbox => d.type === 'checkbox' 
export const isColor = (d: Field): d is Color => d.type === 'color' 
export const isDate = (d: Field): d is Date => d.type === 'date' 
export const isEmail = (d: Field): d is Email => d.type === 'email' 
export const isNumber = (d: Field): d is Number => d.type === 'number' 
export const isPassword = (d: Field): d is Password => d.type === 'password' 
export const isRadio = (d: Field): d is Radio => d.type === 'radio' 
export const isRange = (d: Field): d is Range => d.type === 'range' 
export const isTel = (d: Field): d is Tel => d.type === 'tel' 
export const isText = (d: Field): d is Tel => d.type === 'text' 
export const isTextarea = (d: Field): d is Textarea => d.type === 'textarea' 
export const isSelect = (d: Field): d is Select => d.type === 'select'
export const isTextField = (d: Field): d is TextField =>
  isEmail(d) || isPassword(d) || isTel(d) || isText(d)


const isSelectOption = (d: string | SelectOption | undefined): d is SelectOption =>
  d && !(typeof d === 'string')
export const isSelectOptions = (d: string[] | SelectOption[]): d is SelectOption[] =>
  // @ts-ignore
  d && d.every(isSelectOption)