import App from './App.svelte'
import type { Field } from './fieldTypes'
import type { SubmitAction } from './submitTypes'

interface Props {
	fields: Field[],
	submit: SubmitAction
}

const form = (target: Element, props: Props) =>
	new App({ target, props })

export default form
