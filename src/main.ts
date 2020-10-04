import App from './App.svelte'
import type { Field } from './fieldTypes'

const fields: Field[] = [
	{
		type: 'checkbox',
		property: 'try-checkbox',
		label: 'Try checkbox',
		value: true,
	},
	{
		type: 'color',
		property: 'try-color',
		label: 'Try color',
		value: '#A4F81B',
	},
	{
		type: 'date',
		property: 'try-date',
		label: 'Try date',
		value: '2020-01-01'
	},
	{
		type: 'email',
		property: 'try-email',
		label: 'Try email',
		value: 'hello@world.com'
	},
	{
		type: 'password',
		property: 'try-password',
		label: 'Try password'
	},
	{
		type: 'tel',
		property: 'try-tel',
		label: 'Try tel'
	},
	{
		type: 'text',
		property: 'try-text',
		label: 'Try text'
	},
	{
		type: 'number',
		property: 'try-number',
		label: 'Try number',
		min: 3,
		max: 8,
		step: 1,
	},
	{
		type: 'radio',
		property: 'try-radio',
		label: 'Try radio',
		options: [{ label: 'One', value: 'one'}, { label: 'Two', value: 'two'},],
		value: 'two'
	},
	{
		type: 'range',
		property: 'try-range',
		label: 'Try range',
		min: 3,
		max: 8,
		step: 0.5,
	},
	{
		type: 'textarea',
		property: 'try-textarea',
		label: 'Try textarea'
	},
	{
		type: 'select',
		property: 'try-select',
		label: 'Try select',
		options: [{ label: 'One', value: 'one'}, { label: 'Two', value: 'two'}],
		value: 'two'
	},
]

const app = new App({
	target: document.body,
	props: {
		fields: fields
	}
})

export default app