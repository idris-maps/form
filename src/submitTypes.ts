export interface SubmitAction {
  buttonLabel?: string
  method: 'POST' | 'GET' | 'PUT' | 'PATCH' | 'DELETE'
  url: string
  data?: 'body' | 'query'
  headers?: { [key: string]: string }
  loadingMessage?: string
  errorMessage?: string
  errorRedirectUrl?: string
  successMessage?: string
  successRedirectUrl?: string
}
