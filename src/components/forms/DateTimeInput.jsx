import * as React from "react"
import { Calendar, Clock, Info, AlertCircle } from "lucide-react"
import { cn } from "../../lib/utils"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip"
import { Button } from "../ui/button"

/**
 * DateTimeInput - Styled datetime picker with quick select options
 * Features: min/max constraints, quick presets, relative time display
 */

const DateTimeInput = React.forwardRef(({
  // Field configuration
  label,
  name,
  placeholder,
  helperText,
  tooltip,
  required = false,
  disabled = false,

  // Value handling
  value,
  onChange,
  onBlur,

  // Constraints
  minDate,
  maxDate,
  minTime,

  // Quick select presets
  showPresets = false,
  presets = [
    { label: "Now", minutes: 0 },
    { label: "+5 min", minutes: 5 },
    { label: "+15 min", minutes: 15 },
    { label: "+1 hour", minutes: 60 },
    { label: "+24 hours", minutes: 1440 },
  ],

  // Display options
  showRelativeTime = true,

  // Validation
  error,
  onValidationChange,

  // Styling
  className,
  inputClassName,

  ...props
}, ref) => {
  const [localValue, setLocalValue] = React.useState(value || "")
  const [validationError, setValidationError] = React.useState(null)

  // Sync local value with controlled value
  React.useEffect(() => {
    if (value !== undefined && value !== localValue) {
      setLocalValue(value)
    }
  }, [value])

  // Format datetime for input (local timezone)
  const formatForInput = React.useCallback((date) => {
    if (!date) return ""
    const d = new Date(date)
    if (isNaN(d.getTime())) return ""

    // Format as YYYY-MM-DDTHH:mm for datetime-local input
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    const hours = String(d.getHours()).padStart(2, "0")
    const minutes = String(d.getMinutes()).padStart(2, "0")

    return `${year}-${month}-${day}T${hours}:${minutes}`
  }, [])

  // Get relative time string
  const getRelativeTime = React.useCallback((dateStr) => {
    if (!dateStr) return null

    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return null

    const now = new Date()
    const diffMs = date.getTime() - now.getTime()
    const diffMins = Math.round(diffMs / 60000)
    const diffHours = Math.round(diffMs / 3600000)
    const diffDays = Math.round(diffMs / 86400000)

    if (diffMs < 0) {
      const absDiffMins = Math.abs(diffMins)
      if (absDiffMins < 60) return `${absDiffMins} minute${absDiffMins !== 1 ? "s" : ""} ago`
      const absDiffHours = Math.abs(diffHours)
      if (absDiffHours < 24) return `${absDiffHours} hour${absDiffHours !== 1 ? "s" : ""} ago`
      const absDiffDays = Math.abs(diffDays)
      return `${absDiffDays} day${absDiffDays !== 1 ? "s" : ""} ago`
    }

    if (diffMins < 1) return "Now"
    if (diffMins < 60) return `In ${diffMins} minute${diffMins !== 1 ? "s" : ""}`
    if (diffHours < 24) return `In ${diffHours} hour${diffHours !== 1 ? "s" : ""}`
    return `In ${diffDays} day${diffDays !== 1 ? "s" : ""}`
  }, [])

  // Validate datetime
  const validateDateTime = React.useCallback((dateStr) => {
    if (!dateStr || dateStr === "") {
      if (required) {
        return { isValid: false, error: "Date and time is required" }
      }
      return { isValid: true, error: null }
    }

    const date = new Date(dateStr)
    if (isNaN(date.getTime())) {
      return { isValid: false, error: "Invalid date" }
    }

    if (minDate) {
      const min = new Date(minDate)
      if (date < min) {
        return { isValid: false, error: `Date must be after ${min.toLocaleString()}` }
      }
    }

    if (maxDate) {
      const max = new Date(maxDate)
      if (date > max) {
        return { isValid: false, error: `Date must be before ${max.toLocaleString()}` }
      }
    }

    return { isValid: true, error: null }
  }, [required, minDate, maxDate])

  // Handle value change
  const handleChange = React.useCallback((e) => {
    const newValue = e.target.value
    setLocalValue(newValue)

    const { isValid, error } = validateDateTime(newValue)
    setValidationError(error)
    onValidationChange?.(isValid)

    onChange?.(e)
  }, [onChange, validateDateTime, onValidationChange])

  // Handle blur
  const handleBlur = React.useCallback((e) => {
    const { isValid, error } = validateDateTime(localValue)
    setValidationError(error)
    onValidationChange?.(isValid)
    onBlur?.(e)
  }, [localValue, validateDateTime, onValidationChange, onBlur])

  // Handle preset selection
  const handlePresetClick = React.useCallback((minutes) => {
    const date = new Date()
    date.setMinutes(date.getMinutes() + minutes)

    const formattedValue = formatForInput(date)
    setLocalValue(formattedValue)

    const { isValid, error } = validateDateTime(formattedValue)
    setValidationError(error)
    onValidationChange?.(isValid)

    // Create synthetic event
    const syntheticEvent = {
      target: { name, value: formattedValue },
    }
    onChange?.(syntheticEvent)
  }, [name, formatForInput, onChange, validateDateTime, onValidationChange])

  // Calculate minimum datetime for input
  const getMinDateTime = React.useCallback(() => {
    if (minDate) {
      return formatForInput(new Date(minDate))
    }
    if (minTime === "now") {
      return formatForInput(new Date())
    }
    return undefined
  }, [minDate, minTime, formatForInput])

  // Generate unique ID
  const fieldId = React.useId()
  const inputId = name || fieldId
  const displayError = error || validationError
  const relativeTime = showRelativeTime ? getRelativeTime(localValue) : null

  return (
    <div className={cn("space-y-2 w-full", className)}>
      {/* Label */}
      {label && (
        <div className="flex items-center justify-between">
          <Label htmlFor={inputId} className="flex items-center gap-2">
            {label}
            {required && <span className="text-destructive">*</span>}
            {tooltip && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                </TooltipTrigger>
                <TooltipContent>{tooltip}</TooltipContent>
              </Tooltip>
            )}
          </Label>

          {/* Relative time display */}
          {relativeTime && (
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {relativeTime}
            </span>
          )}
        </div>
      )}

      {/* Input with calendar icon */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
          <Calendar className="h-4 w-4" />
        </div>

        <Input
          ref={ref}
          id={inputId}
          name={name}
          type="datetime-local"
          value={localValue}
          onChange={handleChange}
          onBlur={handleBlur}
          min={getMinDateTime()}
          max={maxDate ? formatForInput(new Date(maxDate)) : undefined}
          disabled={disabled}
          required={required}
          state={displayError ? "error" : undefined}
          className={cn(
            "pl-10",
            inputClassName
          )}
          {...props}
        />
      </div>

      {/* Quick preset buttons */}
      {showPresets && (
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <Button
              key={preset.label}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handlePresetClick(preset.minutes)}
              disabled={disabled}
              className="h-7 px-2 text-xs"
            >
              {preset.label}
            </Button>
          ))}
        </div>
      )}

      {/* Helper text or error */}
      {(helperText || displayError) && (
        <p className={cn(
          "text-sm flex items-center gap-1",
          displayError ? "text-destructive" : "text-muted-foreground"
        )}>
          {displayError && <AlertCircle className="h-3.5 w-3.5" />}
          {displayError || helperText}
        </p>
      )}
    </div>
  )
})

DateTimeInput.displayName = "DateTimeInput"

export { DateTimeInput }
