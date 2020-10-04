<script lang="ts">
  import type { Number } from '../fieldTypes'
  export let field: Number
  export let onChange: (key: string, value: number) => void
  let value: number = field.value
</script>

<div class="field number-field">
  <label for={field.property}>{ field.label || field.property }</label>
  <input
    type="number"
    id={field.property}
    name={field.property}
    value={value}
    min={field.min}
    max={field.max}
    step={field.step}
    required={!field.notRequired}
    on:keyup={e => {
      const v = Number(e.currentTarget.value)
      if (!Number.isNaN(v)) {
        value = v
        onChange(field.property, value)
      }
    }}
    on:change={e => {
      const v = Number(e.currentTarget.value)
      if (!Number.isNaN(v)) {
        value = v
        onChange(field.property, value)
      }
    }}
  />
</div>
