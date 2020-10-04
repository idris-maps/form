<script lang="ts">
	import type { Field } from './fieldTypes'
	import type { SubmitAction} from './submitTypes'
	import { getInitialData, request } from './utils'
	import RenderField from './components/Field.svelte'
	export let submitAction: SubmitAction
	export let fields: Field[] = []

	let message: string
	let data = getInitialData(fields)
	const setData = (key: string, value: any) => {
		data = { ...data, [key]: value }
		console.log(data)
	}

	const onSubmit: svelte.JSX.EventHandler<Event, HTMLFormElement> = e => {
		e.preventDefault()
		if (e.currentTarget.checkValidity() && submitAction) {
			const { loadingMessage } = submitAction
			if (loadingMessage) { message = loadingMessage }
			request(data, submitAction)
				.then(() => {
					const { successMessage, successRedirectUrl } = submitAction
					if (successMessage) { message = successMessage }
					if (successRedirectUrl) { window.location.assign(successRedirectUrl) }
				})
				.catch(err => {
					const { errorMessage, errorRedirectUrl } = submitAction
					console.log(err, errorMessage)
					if (errorMessage) { message = errorMessage }
					if (errorRedirectUrl) { window.location.assign(errorRedirectUrl) }
				})
		}
	}
</script>

<form on:submit={onSubmit}>
	{#each fields as field}
		<RenderField field={field} onChange={setData} />
	{/each}
	<div class="field submit-field">
		<input type="submit" label={submitAction?.buttonLabel}/>
	</div>
	{#if message}
		<p class="submit-message">{ message }</p>
	{/if}
</form>
