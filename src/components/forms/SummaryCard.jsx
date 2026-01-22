import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Coins,
  Users,
  Calendar,
  Gift,
  ExternalLink,
  Copy,
  Edit2,
  ChevronDown,
  Loader2,
} from "lucide-react"
import { cn } from "../../lib/utils"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "../ui/card"
import { Button } from "../ui/button"
import { toast } from "../ui/sonner"

/**
 * SummaryCard - Preview/confirmation card before submission
 * Shows a summary of form data with visual organization
 */

const SummaryCard = React.forwardRef(({
  // Content
  title = "Summary",
  description,
  data = [],
  warnings = [],
  errors = [],

  // Status
  status = "preview", // "preview" | "submitting" | "success" | "error"
  statusMessage,

  // Actions
  onEdit,
  onSubmit,
  onCancel,
  submitLabel = "Confirm",
  cancelLabel = "Cancel",
  editLabel = "Edit",

  // Display options
  variant = "elevated", // "default" | "elevated" | "glass"
  showCopyButton = false,
  collapsible = false,
  defaultCollapsed = false,

  // Styling
  className,

  children,
  ...props
}, ref) => {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed)

  // Status configurations
  const statusConfig = {
    preview: {
      icon: null,
      color: "text-foreground",
      bgColor: "bg-muted/30",
    },
    submitting: {
      icon: Loader2,
      color: "text-primary",
      bgColor: "bg-primary/10",
      iconAnimation: "animate-spin",
    },
    success: {
      icon: CheckCircle2,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    error: {
      icon: AlertCircle,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
    },
  }

  const currentStatus = statusConfig[status]

  // Copy all data to clipboard
  const handleCopyAll = async () => {
    try {
      const text = data
        .map((item) => `${item.label}: ${item.value}`)
        .join("\n")
      await navigator.clipboard.writeText(text)
      toast.success("Summary copied to clipboard")
    } catch {
      toast.error("Failed to copy summary")
    }
  }

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3, staggerChildren: 0.05 },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: { opacity: 1, x: 0 },
  }

  return (
    <motion.div
      ref={ref}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <Card variant={variant} className={cn("overflow-hidden", className)} {...props}>
        {/* Header */}
        <CardHeader className="border-b border-border/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {currentStatus.icon && (
                <div className={cn("p-2 rounded-lg", currentStatus.bgColor)}>
                  <currentStatus.icon
                    className={cn("h-5 w-5", currentStatus.color, currentStatus.iconAnimation)}
                  />
                </div>
              )}
              <div>
                <CardTitle className="text-lg">{title}</CardTitle>
                {description && (
                  <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {showCopyButton && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyAll}
                  className="h-8 w-8 p-0"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              )}

              {collapsible && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className="h-8 w-8 p-0"
                >
                  <motion.div
                    animate={{ rotate: isCollapsed ? 0 : 180 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </motion.div>
                </Button>
              )}
            </div>
          </div>

          {/* Status message */}
          {statusMessage && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className={cn("text-sm mt-2", currentStatus.color)}
            >
              {statusMessage}
            </motion.p>
          )}
        </CardHeader>

        {/* Content */}
        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <CardContent className="p-0">
                {/* Warnings */}
                {warnings.length > 0 && (
                  <div className="px-6 py-3 bg-warning/10 border-b border-warning/20">
                    {warnings.map((warning, index) => (
                      <motion.div
                        key={index}
                        variants={itemVariants}
                        className="flex items-start gap-2 text-sm text-warning"
                      >
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>{warning}</span>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Errors */}
                {errors.length > 0 && (
                  <div className="px-6 py-3 bg-destructive/10 border-b border-destructive/20">
                    {errors.map((error, index) => (
                      <motion.div
                        key={index}
                        variants={itemVariants}
                        className="flex items-start gap-2 text-sm text-destructive"
                      >
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>{error}</span>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Data items */}
                <div className="divide-y divide-border/30">
                  {data.map((item, index) => (
                    <SummaryItem key={item.key || index} item={item} index={index} />
                  ))}
                </div>

                {/* Custom children */}
                {children && (
                  <div className="px-6 py-4 border-t border-border/30">
                    {children}
                  </div>
                )}
              </CardContent>

              {/* Footer with actions */}
              {(onSubmit || onCancel || onEdit) && (
                <CardFooter className="flex justify-between gap-3 border-t border-border/30 bg-muted/20">
                  <div>
                    {onEdit && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={onEdit}
                        disabled={status === "submitting"}
                      >
                        <Edit2 className="h-4 w-4 mr-2" />
                        {editLabel}
                      </Button>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {onCancel && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={onCancel}
                        disabled={status === "submitting"}
                      >
                        {cancelLabel}
                      </Button>
                    )}

                    {onSubmit && (
                      <Button
                        type="button"
                        variant="primary"
                        onClick={onSubmit}
                        disabled={status === "submitting" || errors.length > 0}
                        loading={status === "submitting"}
                        loadingText="Processing..."
                      >
                        {submitLabel}
                      </Button>
                    )}
                  </div>
                </CardFooter>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  )
})

SummaryCard.displayName = "SummaryCard"

/**
 * SummaryItem - Individual item in the summary
 */
const SummaryItem = ({ item, index }) => {
  // Icon mapping for common types
  const iconMap = {
    time: Clock,
    date: Calendar,
    amount: Coins,
    users: Users,
    prize: Gift,
    link: ExternalLink,
  }

  const Icon = item.icon || iconMap[item.type]

  const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { delay: index * 0.03 }
    },
  }

  return (
    <motion.div
      variants={itemVariants}
      className={cn(
        "flex items-start justify-between gap-4 px-6 py-3.5",
        item.highlight && "bg-primary/5"
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className="p-1.5 rounded-md bg-muted/50 text-muted-foreground shrink-0">
            <Icon className="h-4 w-4" />
          </div>
        )}
        <span className="text-sm text-muted-foreground truncate">{item.label}</span>
      </div>

      <div className="flex items-center gap-2 text-right min-w-0">
        <span
          className={cn(
            "text-sm font-medium truncate",
            item.variant === "success" && "text-success",
            item.variant === "warning" && "text-warning",
            item.variant === "error" && "text-destructive",
            item.variant === "muted" && "text-muted-foreground"
          )}
        >
          {item.value}
        </span>

        {item.suffix && (
          <span className="text-sm text-muted-foreground shrink-0">{item.suffix}</span>
        )}

        {item.link && (
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary/80 shrink-0"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </motion.div>
  )
}

/**
 * SummaryGroup - Group related summary items
 */
const SummaryGroup = ({ title, items, className }) => (
  <div className={cn("space-y-1", className)}>
    {title && (
      <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground px-6 py-2 bg-muted/30">
        {title}
      </h4>
    )}
    {items.map((item, index) => (
      <SummaryItem key={item.key || index} item={item} index={index} />
    ))}
  </div>
)

export { SummaryCard, SummaryItem, SummaryGroup }
