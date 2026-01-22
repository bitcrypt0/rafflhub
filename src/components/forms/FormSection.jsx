import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, CheckCircle2 } from "lucide-react"
import { cn } from "../../lib/utils"

/**
 * FormSection - Collapsible section with icon header
 * Supports expand/collapse animations, completion indicators, and gradient headers
 */

const FormSection = React.forwardRef(({
  // Section configuration
  title,
  subtitle,
  description,
  icon: Icon,

  // State
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  isComplete = false,
  isOptional = false,
  hasError = false,

  // Styling
  className,
  headerClassName,
  contentClassName,
  variant = "default", // "default" | "bordered" | "elevated"

  // Content
  children,

  ...props
}, ref) => {
  // Handle controlled vs uncontrolled state
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen

  const handleToggle = () => {
    const newValue = !isOpen
    setInternalOpen(newValue)
    onOpenChange?.(newValue)
  }

  // Variant styles
  const variantStyles = {
    default: {
      container: "border-b border-border/50 last:border-b-0",
      header: "py-4",
      content: "pb-6",
    },
    bordered: {
      container: "border border-border/50 rounded-xl overflow-hidden mb-4 last:mb-0",
      header: "p-4 bg-muted/30",
      content: "p-4 pt-0",
    },
    elevated: {
      container: "bg-card/50 backdrop-blur-sm border border-border/30 rounded-xl shadow-lg mb-4 last:mb-0",
      header: "p-5 border-b border-border/30",
      content: "p-5",
    },
  }

  const styles = variantStyles[variant]

  return (
    <div
      ref={ref}
      className={cn(styles.container, className)}
      {...props}
    >
      {/* Section Header */}
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          "w-full flex items-center justify-between gap-4 text-left transition-colors hover:bg-muted/20",
          styles.header,
          headerClassName
        )}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          {/* Icon with optional completion/error indicator */}
          {Icon && (
            <div className={cn(
              "flex items-center justify-center w-10 h-10 rounded-lg transition-colors",
              hasError
                ? "bg-destructive/10 text-destructive"
                : isComplete
                  ? "bg-success/10 text-success"
                  : "bg-primary/10 text-primary"
            )}>
              {isComplete && !hasError ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <Icon className="h-5 w-5" />
              )}
            </div>
          )}

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className={cn(
                "font-display text-[length:var(--text-lg)] font-semibold",
                hasError ? "text-destructive" : isComplete && "text-success"
              )}>
                {title}
              </span>
              {(subtitle || isOptional) && (
                <span className="text-[length:var(--text-sm)] font-normal text-muted-foreground">
                  {subtitle || '(Optional)'}
                </span>
              )}
            </div>
            {description && (
              <span className="text-[length:var(--text-sm)] text-muted-foreground mt-0.5">
                {description}
              </span>
            )}
          </div>
        </div>

        {/* Expand/Collapse indicator */}
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        </motion.div>
      </button>

      {/* Collapsible Content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className={cn(styles.content, contentClassName)}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})

FormSection.displayName = "FormSection"

/**
 * FormSectionGroup - Container for multiple FormSections
 * Handles spacing and visual grouping
 */
const FormSectionGroup = React.forwardRef(({
  className,
  variant = "default",
  children,
  ...props
}, ref) => {
  // Clone children to pass variant prop
  const enhancedChildren = React.Children.map(children, (child) => {
    if (React.isValidElement(child) && child.type === FormSection) {
      return React.cloneElement(child, { variant })
    }
    return child
  })

  return (
    <div
      ref={ref}
      className={cn(
        variant === "default" && "divide-y divide-border/50",
        className
      )}
      {...props}
    >
      {enhancedChildren}
    </div>
  )
})

FormSectionGroup.displayName = "FormSectionGroup"

export { FormSection, FormSectionGroup }
