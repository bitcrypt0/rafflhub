import * as React from "react"
import { cva } from "class-variance-authority"
import { AlertCircle, CheckCircle2, Info } from "lucide-react"
import { cn } from "../../lib/utils"
import { Label } from "../ui/label"
import { Input } from "../ui/input"
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip"

/**
 * FormField - Unified wrapper with label, input, helper text, and error state
 * Supports validation states, tooltips, and various input types
 */

const formFieldVariants = cva(
  "space-y-2 w-full",
  {
    variants: {
      layout: {
        vertical: "flex flex-col",
        horizontal: "flex flex-row items-center gap-4",
      },
    },
    defaultVariants: {
      layout: "vertical",
    },
  }
)

const FormField = React.forwardRef(({
  // Field configuration
  label,
  name,
  type = "text",
  placeholder,
  helperText,
  tooltip,
  required = false,
  disabled = false,
  readOnly = false,

  // Value handling
  value,
  defaultValue,
  onChange,
  onBlur,

  // Validation
  error,
  success,
  warning,

  // Styling
  className,
  inputClassName,
  labelClassName,
  layout = "vertical",

  // Additional input props
  min,
  max,
  step,
  maxLength,
  pattern,
  autoComplete,

  // Custom render
  children,
  prefix,
  suffix,

  ...props
}, ref) => {
  // Determine input state for styling
  const getInputState = () => {
    if (error) return "error"
    if (success) return "success"
    if (warning) return "warning"
    return "default"
  }

  // Generate unique ID for accessibility
  const fieldId = React.useId()
  const inputId = name || fieldId
  const helperId = `${inputId}-helper`
  const errorId = `${inputId}-error`

  // Handle number input wheel scrolling prevention
  const handleWheel = (e) => {
    if (type === "number" && e.target instanceof HTMLElement) {
      e.target.blur()
    }
  }

  return (
    <div className={cn(formFieldVariants({ layout }), className)}>
      {/* Label with optional tooltip */}
      {label && (
        <Label
          htmlFor={inputId}
          className={cn(
            "flex items-center gap-2",
            error && "text-destructive",
            labelClassName
          )}
        >
          {label}
          {required && <span className="text-destructive">*</span>}
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
              </TooltipTrigger>
              <TooltipContent sideOffset={6}>
                {typeof tooltip === 'string' ? <p>{tooltip}</p> : tooltip}
              </TooltipContent>
            </Tooltip>
          )}
        </Label>
      )}

      {/* Input wrapper with optional prefix/suffix */}
      <div className="relative">
        {prefix && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            {prefix}
          </div>
        )}

        {children || (
          <Input
            ref={ref}
            id={inputId}
            name={name}
            type={type}
            value={value}
            defaultValue={defaultValue}
            onChange={onChange}
            onBlur={onBlur}
            onWheel={handleWheel}
            placeholder={placeholder}
            disabled={disabled}
            readOnly={readOnly}
            required={required}
            min={min}
            max={max}
            step={step}
            maxLength={maxLength}
            pattern={pattern}
            autoComplete={autoComplete}
            state={getInputState()}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            aria-invalid={!!error}
            className={cn(
              prefix && "pl-10",
              suffix && "pr-10",
              inputClassName
            )}
            {...props}
          />
        )}

        {suffix && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            {suffix}
          </div>
        )}

        {/* Validation icon */}
        {(error || success) && !suffix && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {error && <AlertCircle className="h-4 w-4 text-destructive" />}
            {success && !error && <CheckCircle2 className="h-4 w-4 text-success" />}
          </div>
        )}
      </div>

      {/* Helper text or error message */}
      {(helperText || error || warning) && (
        <p
          id={error ? errorId : helperId}
          className={cn(
            "text-sm",
            error ? "text-destructive" : warning ? "text-warning" : "text-muted-foreground"
          )}
        >
          {error || warning || helperText}
        </p>
      )}
    </div>
  )
})

FormField.displayName = "FormField"

export { FormField, formFieldVariants }
