import { Field, isSelect } from './fieldTypes'
import {
  isCheckbox,
  isRadio,
  isSelectOptions,
  isRange,
} from './fieldTypes'

interface Data {
  [key: string]: any
}

export const getInitialData = (fields: Field[]): Data =>
  fields.reduce(
    (result: Data, field: Field): Data => {
      if (isCheckbox(field)) {
        return {
          ...result,
          [field.property]: Boolean(field.value)
        }
      }
      if (isRadio(field) || isSelect(field)) {
        return {
          ...result,
          [field.property]: field.value
            ? field.value
            : isSelectOptions(field.options)
              ? field.options[0].value
              : field.options[0]
        }
      }
      if (isRange(field) && !field.notRequired) {
        return {
          ...result,
          [field.property]: field.value || field.min,
        }
      }
      if (field.value) {
        return {
          ...result,
          [field.property]: field.value
        }
      }
      return result
    },
    {},
  )