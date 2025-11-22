import { toast } from '../components/ui/sonner'
import { decodeError } from './errorDecoder'

export const notifySuccess = (message, meta) => {
  toast.success(message, { description: meta?.description })
}

export const notifyInfo = (message, meta) => {
  toast(message, { description: meta?.description })
}

export const notifyWarning = (message, meta) => {
  toast(message, { description: meta?.description })
}

export const notifyError = (errOrMessage, ctx) => {
  let message = 'Transaction failed'
  if (typeof errOrMessage === 'string') {
    message = errOrMessage
  } else if (errOrMessage) {
    const { message: friendly } = decodeError(errOrMessage)
    message = friendly
    if (process.env.NODE_ENV !== 'production') {
      console.error('❌ On-chain error', { ctx, err: errOrMessage })
    }
  }
  toast.error(message)
  return message
}