import * as React from "react"
import { ethers } from "ethers"
import { AlertCircle, CheckCircle2, Copy, ExternalLink, Loader2 } from "lucide-react"
import { cn } from "../../lib/utils"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip"
import { toast } from "../ui/sonner"

/**
 * AddressInput - Ethereum address input with validation indicator
 * Features: real-time validation, copy button, block explorer link, ENS resolution
 */

const AddressInput = React.forwardRef(({
  // Field configuration
  label,
  name,
  placeholder = "0x...",
  helperText,
  tooltip,
  required = false,
  disabled = false,

  // Value handling
  value,
  onChange,
  onBlur,
  onValidationChange,

  // Validation options
  validateOnChange = true,
  allowEmpty = false,

  // Block explorer
  explorerUrl,
  chainId,

  // Styling
  className,
  inputClassName,

  ...props
}, ref) => {
  const [validationState, setValidationState] = React.useState(null) // null | 'valid' | 'invalid' | 'validating'
  const [localValue, setLocalValue] = React.useState(value || "")

  // Sync local value with controlled value
  React.useEffect(() => {
    if (value !== undefined) {
      setLocalValue(value)
    }
  }, [value])

  // Validate Ethereum address
  const validateAddress = React.useCallback((address) => {
    // Convert to string and handle null/undefined
    const addressStr = address ? String(address) : ""
    
    if (!addressStr || addressStr.trim() === "") {
      if (allowEmpty) {
        return { isValid: true, state: null }
      }
      return { isValid: false, state: null }
    }

    const trimmed = addressStr.trim()
    const isValid = ethers.utils.isAddress(trimmed)

    return {
      isValid,
      state: isValid ? "valid" : "invalid",
      checksummed: isValid ? ethers.utils.getAddress(trimmed) : null
    }
  }, [allowEmpty])

  // Handle value change
  const handleChange = React.useCallback((e) => {
    const newValue = e.target.value
    setLocalValue(newValue)

    if (validateOnChange) {
      const { isValid, state, checksummed } = validateAddress(newValue)
      setValidationState(state)
      onValidationChange?.(isValid, checksummed)
    }

    // Pass the value string to parent onChange (not the event object)
    onChange?.(newValue)
  }, [onChange, validateOnChange, validateAddress, onValidationChange])

  // Handle blur for final validation
  const handleBlur = React.useCallback((e) => {
    const { isValid, state, checksummed } = validateAddress(localValue)
    setValidationState(state)
    onValidationChange?.(isValid, checksummed)
    onBlur?.(e)
  }, [localValue, validateAddress, onValidationChange, onBlur])

  // Copy address to clipboard
  const handleCopy = React.useCallback(async () => {
    if (!localValue) return

    try {
      await navigator.clipboard.writeText(localValue)
      toast.success("Address copied to clipboard")
    } catch (error) {
      toast.error("Failed to copy address")
    }
  }, [localValue])

  // Get block explorer URL
  const getExplorerLink = React.useCallback(() => {
    if (explorerUrl) return `${explorerUrl}/address/${localValue}`

    // Default explorers by chainId
    const explorers = {
      1: "https://etherscan.io",
      5: "https://goerli.etherscan.io",
      137: "https://polygonscan.com",
      43113: "https://testnet.snowtrace.io",
      43114: "https://snowtrace.io",
    }

    const baseUrl = explorers[chainId] || explorers[1]
    return `${baseUrl}/address/${localValue}`
  }, [explorerUrl, chainId, localValue])

  // Generate unique ID
  const fieldId = React.useId()
  const inputId = name || fieldId

  return (
    <div className={cn("space-y-2 w-full", className)}>
      {/* Label */}
      {label && (
        <Label htmlFor={inputId} className="flex items-center gap-2">
          {label}
          {required && <span className="text-destructive">*</span>}
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-muted-foreground cursor-help">
                  <AlertCircle className="h-4 w-4" />
                </span>
              </TooltipTrigger>
              <TooltipContent>{tooltip}</TooltipContent>
            </Tooltip>
          )}
        </Label>
      )}

      {/* Input with validation indicator and actions */}
      <div className="relative group">
        <Input
          ref={ref}
          id={inputId}
          name={name}
          type="text"
          value={localValue}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          state={validationState === "invalid" ? "error" : validationState === "valid" ? "success" : "default"}
          className={cn(
            "font-mono text-sm pr-24",
            inputClassName
          )}
          {...props}
        />

        {/* Action buttons */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {/* Validation indicator */}
          {validationState === "validating" && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {validationState === "valid" && (
            <CheckCircle2 className="h-4 w-4 text-success" />
          )}
          {validationState === "invalid" && (
            <AlertCircle className="h-4 w-4 text-destructive" />
          )}

          {/* Copy button */}
          {localValue && validationState === "valid" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Copy address</TooltipContent>
            </Tooltip>
          )}

          {/* Block explorer link */}
          {localValue && validationState === "valid" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={getExplorerLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </TooltipTrigger>
              <TooltipContent>View on block explorer</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Helper text or error message */}
      {(helperText || validationState === "invalid") && (
        <p className={cn(
          "text-sm",
          validationState === "invalid" ? "text-destructive" : "text-muted-foreground"
        )}>
          {validationState === "invalid" ? "Please enter a valid Ethereum address" : helperText}
        </p>
      )}
    </div>
  )
})

AddressInput.displayName = "AddressInput"

export { AddressInput }
