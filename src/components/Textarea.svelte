<script lang="ts">
  import type { Textarea } from '../fieldTypes'
  export let field: Textarea
  export let onChange: (key: string, value: string) => void
  let value: string = field.value || ''
</script>

<div class="field text-field">
  <label for={field.property}>{ field.label || field.property }</label>
  <textarea
    type={field.type}
    id={field.property}
    name={field.property}
    value={value}
    on:keyup={e => {
      value = e.currentTarget.value
      onChange(field.property, value)
    }}
  />
</div>