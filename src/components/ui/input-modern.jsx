import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "../../lib/utils"

const Input = React.forwardRef(function Input(
  { 
    className, 
    type, 
    variant = "default",
    size = "default",
    error,
    label,
    helperText,
    leftIcon,
    rightIcon,
    loading,
    ...props 
  },
  ref
) {
  const [focused, setFocused] = React.useState(false)
  const [hasValue, setHasValue] = React.useState(false)

  const variants = {
    default: "bg-background border border-input hover:border-border focus:border-primary focus:ring-0",
    filled: "bg-muted border-transparent hover:bg-muted/80 focus:bg-background focus:border-primary focus:ring-0",
    outlined: "bg-transparent border-2 border-border hover:border-primary/50 focus:border-primary focus:ring-0",
    ghost: "bg-transparent border-transparent hover:bg-muted/50 focus:bg-muted focus:ring-0",
    glass: "glass-light border border-border/50 hover:border-border focus:border-primary focus:ring-0"
  }

  const sizes = {
    sm: "h-9 px-3 text-sm rounded-lg",
    default: "h-10 px-4 text-sm rounded-lg",
    lg: "h-12 px-5 text-base rounded-xl",
    xl: "h-14 px-6 text-lg rounded-xl"
  }

  React.useEffect(() => {
    setHasValue(props.value?.length > 0)
  }, [props.value])

  const handleFocus = (e) => {
    setFocused(true)
    props.onFocus?.(e)
  }

  const handleBlur = (e) => {
    setFocused(false)
    props.onBlur?.(e)
  }

  const inputElement = (
    <motion.input
      type={type}
      className={cn(
        "flex w-full transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 outline-none",
        variants[variant],
        sizes[size],
        leftIcon && "pl-10",
        rightIcon && "pr-10",
        (leftIcon || rightIcon) && "has-[:placeholder-shown]:text-center",
        error && "border-destructive focus:border-destructive focus:ring-0",
        className
      )}
      ref={ref}
      onFocus={handleFocus}
      onBlur={handleBlur}
      {...props}
    />
  )

  if (label || helperText || leftIcon || rightIcon) {
    return (
      <div className="space-y-2">
        {label && (
          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground pointer-events-none">
              {leftIcon}
            </div>
          )}
          {inputElement}
          {rightIcon && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground pointer-events-none">
              {loading ? (
                <motion.div
                  className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
              ) : (
                rightIcon
              )}
            </div>
          )}
        </div>
        {helperText && (
          <p className={cn(
            "text-xs",
            error ? "text-destructive" : "text-muted-foreground"
          )}>
            {helperText}
          </p>
        )}
      </div>
    )
  }

  return inputElement
})

Input.displayName = "Input"

// Floating label input
const FloatingLabelInput = React.forwardRef(function FloatingLabelInput(
  { 
    className, 
    type, 
    label,
    error,
    helperText,
    ...props 
  },
  ref
) {
  const [focused, setFocused] = React.useState(false)
  const [hasValue, setHasValue] = React.useState(false)

  React.useEffect(() => {
    setHasValue(props.value?.length > 0)
  }, [props.value])

  const handleFocus = (e) => {
    setFocused(true)
    props.onFocus?.(e)
  }

  const handleBlur = (e) => {
    setFocused(false)
    props.onBlur?.(e)
  }

  return (
    <div className="relative">
      <motion.input
        type={type}
        className={cn(
          "peer h-12 w-full rounded-lg border border-input bg-background px-4 pt-6 text-sm transition-all duration-200 placeholder-transparent focus:border-primary focus:ring-0 focus:pt-6 focus:pb-2 disabled:cursor-not-allowed disabled:opacity-50 outline-none",
          error && "border-destructive focus:border-destructive focus:ring-0",
          className
        )}
        placeholder=" "
        ref={ref}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      />
      <motion.label
        className={cn(
          "absolute left-4 top-4 text-sm text-muted-foreground transition-all duration-200 pointer-events-none",
          "peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-muted-foreground",
          "peer-focus:top-2 peer-focus:text-xs peer-focus:text-primary",
          hasValue && "top-2 text-xs text-primary",
          error && "text-destructive peer-focus:text-destructive"
        )}
        animate={{
          y: (focused || hasValue) ? -8 : 0,
          scale: (focused || hasValue) ? 0.85 : 1
        }}
        transition={{ duration: 0.2 }}
      >
        {label}
      </motion.label>
      {helperText && (
        <p className={cn(
          "mt-2 text-xs",
          error ? "text-destructive" : "text-muted-foreground"
        )}>
          {helperText}
        </p>
      )}
    </div>
  )
})

FloatingLabelInput.displayName = "FloatingLabelInput"

// Search input
const SearchInput = React.forwardRef(function SearchInput(
  { 
    className, 
    onClear,
    loading,
    ...props 
  },
  ref
) {
  const [value, setValue] = React.useState(props.value || '')

  React.useEffect(() => {
    setValue(props.value || '')
  }, [props.value])

  const handleClear = () => {
    setValue('')
    onClear?.()
  }

  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
        {loading ? (
          <motion.div
            className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
        ) : (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        )}
      </div>
      <Input
        ref={ref}
        type="search"
        className={cn("pl-10 pr-10", className)}
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          props.onChange?.(e)
        }}
        {...props}
      />
      {value && (
        <motion.button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </motion.button>
      )}
    </div>
  )
})

SearchInput.displayName = "SearchInput"

// Number input with controls
const NumberInput = React.forwardRef(function NumberInput(
  { 
    className,
    min,
    max,
    step = 1,
    onIncrement,
    onDecrement,
    ...props 
  },
  ref
) {
  const [value, setValue] = React.useState(props.value || 0)

  React.useEffect(() => {
    setValue(props.value || 0)
  }, [props.value])

  const handleIncrement = () => {
    const newValue = Math.min(max !== undefined ? max : Infinity, Number(value) + step)
    setValue(newValue)
    props.onChange?.({ target: { value: newValue } })
    onIncrement?.(newValue)
  }

  const handleDecrement = () => {
    const newValue = Math.max(min !== undefined ? min : -Infinity, Number(value) - step)
    setValue(newValue)
    props.onChange?.({ target: { value: newValue } })
    onDecrement?.(newValue)
  }

  return (
    <div className="relative flex items-center">
      <Input
        ref={ref}
        type="number"
        className={cn("pr-16", className)}
        value={value}
        onChange={(e) => {
          const newValue = e.target.value
          setValue(newValue)
          props.onChange?.(e)
        }}
        min={min}
        max={max}
        step={step}
        {...props}
      />
      <div className="absolute right-1 flex flex-col">
        <motion.button
          type="button"
          onClick={handleIncrement}
          className="h-5 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
          whileTap={{ scale: 0.95 }}
          disabled={max !== undefined && Number(value) >= max}
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </motion.button>
        <motion.button
          type="button"
          onClick={handleDecrement}
          className="h-5 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
          whileTap={{ scale: 0.95 }}
          disabled={min !== undefined && Number(value) <= min}
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </motion.button>
      </div>
    </div>
  )
})

NumberInput.displayName = "NumberInput"

export { 
  Input, 
  FloatingLabelInput, 
  SearchInput, 
  NumberInput 
}
