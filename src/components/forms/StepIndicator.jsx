import * as React from "react"
import { motion } from "framer-motion"
import { Check, Circle } from "lucide-react"
import { cn } from "../../lib/utils"

/**
 * StepIndicator - Visual progress indicator for multi-step flows
 * Supports horizontal and vertical layouts with animated transitions
 */

const StepIndicator = React.forwardRef(({
  // Steps configuration
  steps = [],
  currentStep = 0,
  onStepClick,

  // Display options
  layout = "horizontal", // "horizontal" | "vertical"
  showLabels = true,
  showNumbers = true,
  allowClickPrevious = true,
  allowClickCompleted = true,

  // Styling
  className,
  size = "default", // "sm" | "default" | "lg"

  ...props
}, ref) => {
  // Size configurations
  const sizeConfig = {
    sm: {
      step: "w-8 h-8",
      icon: "h-4 w-4",
      connector: layout === "horizontal" ? "h-0.5" : "w-0.5",
      text: "text-xs",
      gap: layout === "horizontal" ? "gap-2" : "gap-4",
    },
    default: {
      step: "w-10 h-10",
      icon: "h-5 w-5",
      connector: layout === "horizontal" ? "h-0.5" : "w-0.5",
      text: "text-sm",
      gap: layout === "horizontal" ? "gap-3" : "gap-6",
    },
    lg: {
      step: "w-12 h-12",
      icon: "h-6 w-6",
      connector: layout === "horizontal" ? "h-1" : "w-1",
      text: "text-base",
      gap: layout === "horizontal" ? "gap-4" : "gap-8",
    },
  }

  const config = sizeConfig[size]

  // Determine step state
  const getStepState = (index) => {
    if (index < currentStep) return "completed"
    if (index === currentStep) return "current"
    return "upcoming"
  }

  // Handle step click
  const handleStepClick = (index) => {
    if (!onStepClick) return

    const state = getStepState(index)

    if (state === "completed" && allowClickCompleted) {
      onStepClick(index)
    } else if (state === "upcoming" && allowClickPrevious) {
      // Only allow clicking previous steps
      return
    } else if (index < currentStep && allowClickPrevious) {
      onStepClick(index)
    }
  }

  // Check if step is clickable
  const isClickable = (index) => {
    if (!onStepClick) return false

    const state = getStepState(index)
    if (state === "completed" && allowClickCompleted) return true
    if (index < currentStep && allowClickPrevious) return true

    return false
  }

  return (
    <div
      ref={ref}
      className={cn(
        "flex",
        layout === "horizontal" ? "flex-row items-center" : "flex-col",
        className
      )}
      role="navigation"
      aria-label="Progress"
      {...props}
    >
      {steps.map((step, index) => {
        const state = getStepState(index)
        const clickable = isClickable(index)
        const isLast = index === steps.length - 1

        return (
          <React.Fragment key={step.id || index}>
            {/* Step item */}
            <div
              className={cn(
                "flex",
                layout === "horizontal" ? "flex-col items-center" : "flex-row items-start",
                config.gap
              )}
            >
              {/* Step circle */}
              <button
                type="button"
                onClick={() => handleStepClick(index)}
                disabled={!clickable}
                className={cn(
                  "relative flex items-center justify-center rounded-full font-medium transition-all duration-300",
                  config.step,
                  clickable && "cursor-pointer hover:scale-110",
                  !clickable && state !== "current" && "cursor-default",
                  state === "completed" && "bg-success text-success-foreground",
                  state === "current" && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                  state === "upcoming" && "bg-muted text-muted-foreground border-2 border-border"
                )}
                aria-current={state === "current" ? "step" : undefined}
              >
                {state === "completed" ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  >
                    <Check className={config.icon} />
                  </motion.div>
                ) : showNumbers ? (
                  <span className={config.text}>{index + 1}</span>
                ) : (
                  <Circle className={cn(config.icon, "fill-current")} />
                )}

                {/* Pulse animation for current step */}
                {state === "current" && (
                  <motion.div
                    className="absolute inset-0 rounded-full bg-primary/20"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
              </button>

              {/* Label and description */}
              {showLabels && (step.label || step.description) && (
                <div
                  className={cn(
                    "flex flex-col",
                    layout === "horizontal" ? "items-center text-center" : "items-start"
                  )}
                >
                  {step.label && (
                    <span
                      className={cn(
                        "font-medium transition-colors",
                        config.text,
                        state === "completed" && "text-success",
                        state === "current" && "text-foreground",
                        state === "upcoming" && "text-muted-foreground"
                      )}
                    >
                      {step.label}
                    </span>
                  )}
                  {step.description && (
                    <span className={cn("text-muted-foreground mt-0.5", config.text)}>
                      {step.description}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Connector line */}
            {!isLast && (
              <div
                className={cn(
                  "relative flex-1",
                  layout === "horizontal"
                    ? cn("mx-2 min-w-[2rem]", config.connector)
                    : cn("my-2 ml-5 min-h-[1.5rem]", config.connector)
                )}
              >
                {/* Background line */}
                <div
                  className={cn(
                    "absolute bg-border",
                    layout === "horizontal" ? "inset-x-0 top-1/2 -translate-y-1/2 h-0.5" : "inset-y-0 left-1/2 -translate-x-1/2 w-0.5"
                  )}
                />

                {/* Progress line */}
                <motion.div
                  className={cn(
                    "absolute bg-success",
                    layout === "horizontal" ? "top-1/2 -translate-y-1/2 h-0.5 left-0" : "left-1/2 -translate-x-1/2 w-0.5 top-0"
                  )}
                  initial={false}
                  animate={{
                    [layout === "horizontal" ? "width" : "height"]:
                      state === "completed" || index < currentStep ? "100%" : "0%",
                  }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                />
              </div>
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
})

StepIndicator.displayName = "StepIndicator"

/**
 * useSteps - Hook for managing step state
 */
const useSteps = (totalSteps, initialStep = 0) => {
  const [currentStep, setCurrentStep] = React.useState(initialStep)
  const [completedSteps, setCompletedSteps] = React.useState(new Set())

  const goToStep = React.useCallback((step) => {
    if (step >= 0 && step < totalSteps) {
      setCurrentStep(step)
    }
  }, [totalSteps])

  const nextStep = React.useCallback(() => {
    if (currentStep < totalSteps - 1) {
      setCompletedSteps((prev) => new Set([...prev, currentStep]))
      setCurrentStep((prev) => prev + 1)
    }
  }, [currentStep, totalSteps])

  const prevStep = React.useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1)
    }
  }, [currentStep])

  const completeStep = React.useCallback((step) => {
    setCompletedSteps((prev) => new Set([...prev, step]))
  }, [])

  const resetSteps = React.useCallback(() => {
    setCurrentStep(initialStep)
    setCompletedSteps(new Set())
  }, [initialStep])

  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === totalSteps - 1
  const progress = ((currentStep + 1) / totalSteps) * 100

  return {
    currentStep,
    completedSteps,
    goToStep,
    nextStep,
    prevStep,
    completeStep,
    resetSteps,
    isFirstStep,
    isLastStep,
    progress,
  }
}

export { StepIndicator, useSteps }
