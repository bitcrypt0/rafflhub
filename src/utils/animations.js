import React from 'react';
import { motion } from 'framer-motion';

// Animation presets for consistent motion design
export const animations = {
  // Fade animations
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.3 }
  },

  fadeInUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.4, ease: "easeOut" }
  },

  fadeInDown: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.4, ease: "easeOut" }
  },

  fadeInLeft: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
    transition: { duration: 0.4, ease: "easeOut" }
  },

  fadeInRight: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
    transition: { duration: 0.4, ease: "easeOut" }
  },

  // Scale animations
  scaleIn: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
    transition: { duration: 0.3, ease: "easeOut" }
  },

  scaleUp: {
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.8 },
    transition: { duration: 0.3, ease: "easeOut" }
  },

  // Slide animations
  slideUp: {
    initial: { y: 100, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: -100, opacity: 0 },
    transition: { duration: 0.5, ease: "easeInOut" }
  },

  slideDown: {
    initial: { y: -100, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: -100, opacity: 0 },
    transition: { duration: 0.5, ease: "easeInOut" }
  },

  // Stagger animations for lists
  staggerContainer: {
    initial: { opacity: 0 },
    animate: { 
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    },
    exit: { opacity: 0 }
  },

  staggerItem: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.4, ease: "easeOut" }
  },

  // Spring animations
  springIn: {
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1 },
    transition: { 
      type: "spring", 
      stiffness: 100, 
      damping: 20 
    }
  },

  bounceIn: {
    initial: { opacity: 0, scale: 0.3 },
    animate: { opacity: 1, scale: 1 },
    transition: { 
      type: "spring", 
      stiffness: 300, 
      damping: 20 
    }
  },

  // Page transitions
  pageTransition: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.3, ease: "easeInOut" }
  },

  // Modal animations
  modalOverlay: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 }
  },

  modalContent: {
    initial: { opacity: 0, scale: 0.95, y: 20 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95, y: 20 },
    transition: { duration: 0.2, ease: "easeOut" }
  },

  // Hover effects
  hoverLift: {
    whileHover: { 
      y: -4, 
      transition: { duration: 0.2, ease: "easeOut" }
    },
    whileTap: { 
      scale: 0.98, 
      transition: { duration: 0.1 }
    }
  },

  hoverScale: {
    whileHover: { 
      scale: 1.05, 
      transition: { duration: 0.2, ease: "easeOut" }
    },
    whileTap: { 
      scale: 0.95, 
      transition: { duration: 0.1 }
    }
  },

  hoverGlow: {
    whileHover: { 
      boxShadow: "0 10px 30px -10px rgba(97, 78, 65, 0.3)",
      transition: { duration: 0.2 }
    }
  }
};

// Animation utility functions
export const createStaggerAnimation = (delay = 0.1, staggerDelay = 0.1) => ({
  initial: { opacity: 0, y: 20 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      delay,
      staggerChildren: staggerDelay,
      when: "beforeChildren"
    }
  },
  exit: { opacity: 0, y: -20 }
});

export const createSlideInAnimation = (direction = 'up', distance = 100) => {
  const directions = {
    up: { y: distance },
    down: { y: -distance },
    left: { x: -distance },
    right: { x: distance }
  };

  return {
    initial: { ...directions[direction], opacity: 0 },
    animate: { opacity: 1, y: 0, x: 0 },
    exit: { ...directions[direction], opacity: 0 },
    transition: { duration: 0.4, ease: "easeOut" }
  };
};

// Scroll-triggered animation variants
export const scrollAnimations = {
  fadeInUp: {
    initial: { opacity: 0, y: 60 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-100px" },
    transition: { duration: 0.6, ease: "easeOut" }
  },

  fadeInLeft: {
    initial: { opacity: 0, x: -60 },
    whileInView: { opacity: 1, x: 0 },
    viewport: { once: true, margin: "-100px" },
    transition: { duration: 0.6, ease: "easeOut" }
  },

  fadeInRight: {
    initial: { opacity: 0, x: 60 },
    whileInView: { opacity: 1, x: 0 },
    viewport: { once: true, margin: "-100px" },
    transition: { duration: 0.6, ease: "easeOut" }
  },

  scaleIn: {
    initial: { opacity: 0, scale: 0.8 },
    whileInView: { opacity: 1, scale: 1 },
    viewport: { once: true, margin: "-100px" },
    transition: { duration: 0.5, ease: "easeOut" }
  }
};

// Loading animations
export const loadingAnimations = {
  pulse: {
    animate: { 
      opacity: [0.5, 1, 0.5],
      transition: { 
        duration: 1.5, 
        repeat: Infinity, 
        ease: "easeInOut" 
      }
    }
  },

  spin: {
    animate: { 
      rotate: 360,
      transition: { 
        duration: 1, 
        repeat: Infinity, 
        ease: "linear" 
      }
    }
  },

  bounce: {
    animate: { 
      y: [0, -10, 0],
      transition: { 
        duration: 0.8, 
        repeat: Infinity, 
        ease: "easeOut" 
      }
    }
  },

  shimmer: {
    initial: { x: -100 },
    animate: { 
      x: 100,
      transition: { 
        duration: 1.5, 
        repeat: Infinity, 
        ease: "linear" 
      }
    }
  }
};

// Micro-interactions
export const microInteractions = {
  buttonPress: {
    whileTap: { scale: 0.95 },
    whileHover: { scale: 1.05 }
  },

  cardHover: {
    whileHover: { 
      y: -8,
      boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.2)",
      transition: { duration: 0.3, ease: "easeOut" }
    }
  },

  linkHover: {
    whileHover: { 
      x: 4,
      transition: { duration: 0.2 }
    }
  },

  iconBounce: {
    whileHover: { 
      scale: 1.2,
      rotate: 5,
      transition: { duration: 0.2 }
    }
  }
};

// Responsive animation variants
export const responsiveAnimations = {
  mobile: {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3 }
  },

  desktop: {
    initial: { opacity: 0, y: 50 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5 }
  }
};

// Custom hooks for animations
export const useScrollAnimation = (threshold = 0.1) => {
  const [isInView, setIsInView] = React.useState(false);
  const ref = React.useRef();

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [threshold]);

  return { ref, isInView };
};

// Animation components
export const AnimatedContainer = ({ 
  children, 
  animation = "fadeInUp", 
  delay = 0,
  className,
  ...props 
}) => {
  const animationConfig = animations[animation] || animations.fadeInUp;
  
  return (
    <motion.div
      className={className}
      initial={{ ...animationConfig.initial }}
      animate={{ ...animationConfig.animate }}
      exit={{ ...animationConfig.exit }}
      transition={{ 
        ...animationConfig.transition, 
        delay 
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export const AnimatedSection = ({ 
  children, 
  animation = "fadeInUp", 
  className,
  ...props 
}) => {
  const scrollConfig = scrollAnimations[animation] || scrollAnimations.fadeInUp;
  
  return (
    <motion.section
      className={className}
      {...scrollConfig}
      {...props}
    >
      {children}
    </motion.section>
  );
};

export const StaggerContainer = ({ 
  children, 
  staggerDelay = 0.1,
  className,
  ...props 
}) => {
  return (
    <motion.div
      className={className}
      variants={animations.staggerContainer}
      initial="initial"
      animate="animate"
      exit="exit"
      {...props}
    >
      {React.Children.map(children, (child, index) => (
        <motion.div
          key={index}
          variants={animations.staggerItem}
          transition={{ delay: index * staggerDelay }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
};

// Reduced motion support
export const reducedMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.01 }
};

// Check for reduced motion preference
export const prefersReducedMotion = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// Get appropriate animation based on motion preference
export const getMotionAnimation = (animation) => {
  return prefersReducedMotion() ? reducedMotion : animations[animation];
};

export default animations;
