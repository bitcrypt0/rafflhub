import * as React from "react"
import { ethers } from "ethers"
import { Info, Coins, AlertCircle } from "lucide-react"
import { cn } from "../../lib/utils"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip"
import { Button } from "../ui/button"

/**
 * TokenAmountInput - Number input with currency symbol and formatting
 * Features: decimal handling, max button, unit display, validation
 */

const TokenAmountInput = React.forwardRef(({
  // Field configuration
  label,
  name,
  placeholder = "0.0",
  helperText,
  tooltip,
  required = false,
  disabled = false,

  // Value handling
  value,
  onChange,
  onBlur,

  // Token configuration
  symbol = "ETH",
  decimals = 18,
  maxValue,
  minValue = "0",

  // Display options
  showMaxButton = false,
  showBalance = false,
  balance,
  formatDisplay = true,

  // Validation
  error,
  onValidationChange,

  // Styling
  className,
  inputClassName,

  ...props
}, ref) => {
  const [localValue, setLocalValue] = React.useState(value || "")
  const [isFocused, setIsFocused] = React.useState(false)
  const [validationError, setValidationError] = React.useState(null)

  // Sync local value with controlled value
  React.useEffect(() => {
    if (value !== undefined && value !== localValue) {
      setLocalValue(value)
    }
  }, [value])

  // Format display value
  const formatValue = React.useCallback((val) => {
    if (!val || val === "") return ""
    if (!formatDisplay || isFocused) return val

    try {
      const num = parseFloat(val)
      if (isNaN(num)) return val

      // Smart formatting based on value magnitude
      if (num === 0) return "0"
      if (num < 0.0001) return num.toExponential(4)
      if (num < 1) return num.toFixed(6).replace(/\.?0+$/, "")
      if (num < 1000) return num.toFixed(4).replace(/\.?0+$/, "")
      return num.toLocaleString(undefined, { maximumFractionDigits: 2 })
    } catch {
      return val
    }
  }, [formatDisplay, isFocused])

  // Validate amount
  const validateAmount = React.useCallback((val) => {
    if (!val || val === "") {
      if (required) {
        return { isValid: false, error: "Amount is required" }
      }
      return { isValid: true, error: null }
    }

    try {
      const num = parseFloat(val)

      if (isNaN(num)) {
        return { isValid: false, error: "Invalid number" }
      }

      if (num < 0) {
        return { isValid: false, error: "Amount cannot be negative" }
      }

      if (minValue && num < parseFloat(minValue)) {
        return { isValid: false, error: `Minimum amount is ${minValue} ${symbol}` }
      }

      if (maxValue && num > parseFloat(maxValue)) {
        return { isValid: false, error: `Maximum amount is ${maxValue} ${symbol}` }
      }

      // Check decimal precision
      const decimalParts = val.split(".")
      if (decimalParts[1] && decimalParts[1].length > decimals) {
        return { isValid: false, error: `Maximum ${decimals} decimal places allowed` }
      }

      return { isValid: true, error: null }
    } catch {
      return { isValid: false, error: "Invalid amount" }
    }
  }, [required, minValue, maxValue, decimals, symbol])

  // Handle value change
  const handleChange = React.useCallback((e) => {
    const newValue = e.target.value

    // Allow empty, numbers, and single decimal point
    if (newValue === "" || /^[0-9]*\.?[0-9]*$/.test(newValue)) {
      setLocalValue(newValue)

      const { isValid, error } = validateAmount(newValue)
      setValidationError(error)
      onValidationChange?.(isValid)

      // Create synthetic event with formatted value
      const syntheticEvent = {
        ...e,
        target: {
          ...e.target,
          name,
          value: newValue,
        },
      }
      onChange?.(syntheticEvent)
    }
  }, [name, onChange, validateAmount, onValidationChange])

  // Handle focus
  const handleFocus = React.useCallback(() => {
    setIsFocused(true)
  }, [])

  // Handle blur
  const handleBlur = React.useCallback((e) => {
    setIsFocused(false)
    const { isValid, error } = validateAmount(localValue)
    setValidationError(error)
    onValidationChange?.(isValid)
    onBlur?.(e)
  }, [localValue, validateAmount, onValidationChange, onBlur])

  // Handle max button click
  const handleMaxClick = React.useCallback(() => {
    const maxAmount = balance || maxValue
    if (maxAmount) {
      setLocalValue(maxAmount)
      const syntheticEvent = {
        target: { name, value: maxAmount },
      }
      onChange?.(syntheticEvent)
    }
  }, [balance, maxValue, name, onChange])

  // Prevent scroll wheel changes
  const handleWheel = React.useCallback((e) => {
    if (e.target instanceof HTMLElement) {
      e.target.blur()
    }
  }, [])

  // Generate unique ID
  const fieldId = React.useId()
  const inputId = name || fieldId
  const displayError = error || validationError

  return (
    <div className={cn("space-y-2 w-full", className)}>
      {/* Label with optional balance display */}
      {(label || showBalance) && (
        <div className="flex items-center justify-between">
          {label && (
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
          )}

          {showBalance && balance && (
            <span className="text-sm text-muted-foreground">
              Balance: {formatValue(balance)} {symbol}
            </span>
          )}
        </div>
      )}

      {/* Input with symbol and max button */}
      <div className="relative">
        {/* Token icon/symbol prefix */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-muted-foreground pointer-events-none">
          <Coins className="h-4 w-4" />
          <span className="text-sm font-medium">{symbol}</span>
        </div>

        <Input
          ref={ref}
          id={inputId}
          name={name}
          type="text"
          inputMode="decimal"
          value={isFocused ? localValue : formatValue(localValue)}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onWheel={handleWheel}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          state={displayError ? "error" : undefined}
          className={cn(
            "pl-20",
            showMaxButton && "pr-16",
            inputClassName
          )}
          {...props}
        />

        {/* Max button */}
        {showMaxButton && (balance || maxValue) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleMaxClick}
            disabled={disabled}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-7 px-2 text-xs font-medium text-primary hover:text-primary"
          >
            MAX
          </Button>
        )}
      </div>

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

TokenAmountInput.displayName = "TokenAmountInput"

export { TokenAmountInput }
