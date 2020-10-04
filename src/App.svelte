<script lang="ts">
	import type { Field } from './fieldTypes'
	import RenderField from './components/Field.svelte'
	export let fields: Field[] = []
	let data = {}
	const setData = (key: string, value: any) => {
		data = { ...data, [key]: value }
		console.log(data)
	}
</script>

<form>
	{#each fields as field}
		<RenderField field={field} onChange={setData} />
	{/each}
</form>
<p style="margin-top:100px">{JSON.stringify(fields)}</p>