<script lang="ts">
    import type { Field } from '../fieldTypes'
    import {
      isCheckbox,
      isColor,
      isDate,
      isTextField,
      isNumber,
      isRadio,
      isRange,
      isTextarea,
      isSelect,
    } from '../fieldTypes'
    import Checkbox from './Checkbox.svelte'
    import Color from './Color.svelte'
    import Date from './Date.svelte'
    import Text from './Text.svelte'
    import Number from './Number.svelte'
    import Radio from './Radio.svelte'
    import Range from './Range.svelte'
    import Textarea from './Textarea.svelte'
    import Select from './Select.svelte'
    export let field: Field
    export let onChange: (key: string, value: any) => void
</script>

{#if isCheckbox(field)}
  <Checkbox field={field} onChange={onChange} />
{:else if isColor(field)}
  <Color field={field} onChange={onChange} />
{:else if isDate(field)}
  <Date field={field} onChange={onChange} />
{:else if isTextField(field)}
  <Text field={field} onChange={onChange} />
{:else if isNumber(field)}
  <Number field={field} onChange={onChange} />
{:else if isRadio(field)}
  <Radio field={field} onChange={onChange} />
{:else if isRange(field)}
  <Range field={field} onChange={onChange} />
{:else if isTextarea(field)}
  <Textarea field={field} onChange={onChange} />
{:else if isSelect(field)}
  <Select field={field} onChange={onChange}/>
{/if}