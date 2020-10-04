<script lang="ts">
  import type { TextField } from '../fieldTypes'
  export let field: TextField
  export let onChange: (key: string, value: string) => void
  let value: string = field.value || ''
</script>

<div class="field text-field">
  <label for={field.property}>{ field.label || field.property }</label>
  <input
    type={field.type}
    id={field.property}
    name={field.property}
    value={value}
    minlength={field.minLength}
    maxLength={field.maxLength}
    pattern={field.pattern}
    on:keyup={e => {
      value = e.currentTarget.value
      onChange(field.property, value)
    }}
  />
</div>