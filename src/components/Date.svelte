<script lang="ts">
  import type { Date } from '../fieldTypes'
  export let field: Date
  export let onChange: (key: string, value: string) => void
  let value: string = field.value
</script>

<div class="field date-field">
  <label for={field.property}>{ field.label || field.property }</label>
  <input
    type="date"
    id={field.property}
    name={field.property}
    value={value}
    min={field.min}
    max={field.max}
    required={!field.notRequired}
    on:change={e => {
      value = e.currentTarget.value
      onChange(field.property, value)
    }}
  />
</div>