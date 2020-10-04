<script lang="ts">
  import type { Color } from '../fieldTypes'
  export let field: Color
  export let onChange: (key: string, value: string) => void
  let value: string = field.value
</script>

<div class="field color-field">
  <label for={field.property}>{ field.label || field.property }</label>
  <input
    type="color"
    id={field.property}
    name={field.property}
    value={value}
    on:change={e => {
      value = e.currentTarget.value
      onChange(field.property, value)
    }}
  />
</div>