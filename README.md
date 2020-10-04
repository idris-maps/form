# @idris-maps/form

Define forms in JSON. This library makes no assumptions about esthetics, use your own CSS.

## Usage

### without a bundler

```html
<html>
  <body>
    <div id="login-form"></div>
    <script src="form.js"></script>
    <script>

form(document.getElementById('login-form'), {
  fields: [
    { type: 'email', property: 'email' },
    { type: 'password', property: 'password', minLength: 8  },
  ],
  submit: {
    method: 'POST',
    url: 'https://my.api/login',
    errorMessage: 'You are not welcome here',
    successRedirect: '/home',
  },
})

    </script>
  </body>
</html>
```

Download [form.js here]().

### with a bundler

```bash
npm install @idris-maps/form
```

Types are included.

```ts
import form { Field, SubmitAction } from 'form'

const fields: Field[] = [
  { type: 'email', property: 'email' },
  { type: 'password', property: 'password', minLength: 8  },
]

const submit: SubmitAction = {
  method: 'POST',
  url: 'https://my.api/login',
  errorMessage: 'You are not welcome here',
  successRedirect: '/home',
}

form(document.getElementById('login-form'), {
  fields,
  submit,
})
```

See the [type definitions]() for more details.
