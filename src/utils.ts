import { Field, isSelect } from './fieldTypes'
import {
  isCheckbox,
  isRadio,
  isSelectOptions,
  isRange,
} from './fieldTypes'
import type { SubmitAction } from './submitTypes'

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

export const request = async (data: Data, submitAction: SubmitAction) => {
  const { method, data : where, url, headers } = submitAction
  const query = where === 'query'
    ? `?${new URLSearchParams(data).toString()}`
    : ''
  const res = await fetch(`${url}${query}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(headers || {}),
    },
    body: where === 'query'
      ? undefined
      : JSON.stringify(data)
  })
  if (res.status >= 400) {
    throw new Error(`status: ${res.status}`)
  }
  return await res.json()
}
