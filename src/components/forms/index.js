// Phase 1: Shared Form Components
// These components provide a consistent form experience across all pages

// Core form components
export { FormField, formFieldVariants } from './FormField'
export { FormSection, FormSectionGroup } from './FormSection'

// Specialized input components
export { AddressInput } from './AddressInput'
export { TokenAmountInput } from './TokenAmountInput'
export { DateTimeInput } from './DateTimeInput'

// Layout components
export { PageHero } from './PageHero'
export { StepIndicator, useSteps } from './StepIndicator'
export { SummaryCard, SummaryItem, SummaryGroup } from './SummaryCard'

// Re-export from ui/form for convenience
export {
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  useFormField,
} from '../ui/form'
