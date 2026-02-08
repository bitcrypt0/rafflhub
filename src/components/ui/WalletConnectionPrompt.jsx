import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'

/**
 * UnpluggedIllustration — Artistic SVG of a power cable unplugged from a wall socket.
 * The dangling cable sways gently, tiny sparks flicker near the socket,
 * and a subtle ambient glow pulses behind the scene.
 */
const UnpluggedIllustration = ({ className }) => (
  <svg
    viewBox="0 0 280 220"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={cn('w-full max-w-[280px]', className)}
    aria-hidden="true"
  >
    <defs>
      {/* Ambient glow behind socket */}
      <radialGradient id="ambient-glow" cx="50%" cy="45%" r="45%">
        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.12" />
        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
      </radialGradient>

      {/* Cable gradient */}
      <linearGradient id="cable-grad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.7" />
        <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.4" />
      </linearGradient>

      {/* Plug metallic gradient */}
      <linearGradient id="plug-metal" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity="0.6" />
        <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity="0.3" />
      </linearGradient>

      {/* Spark glow filter */}
      <filter id="spark-blur" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2" />
      </filter>

      {/* Socket shadow */}
      <filter id="socket-shadow" x="-20%" y="-10%" width="140%" height="130%">
        <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="hsl(var(--foreground))" floodOpacity="0.08" />
      </filter>
    </defs>

    {/* Ambient background glow */}
    <ellipse cx="140" cy="95" rx="120" ry="90" fill="url(#ambient-glow)">
      <animate attributeName="rx" values="120;125;120" dur="4s" repeatCount="indefinite" />
      <animate attributeName="ry" values="90;95;90" dur="4s" repeatCount="indefinite" />
    </ellipse>

    {/* ─── WALL PLATE ─── */}
    <g filter="url(#socket-shadow)">
      {/* Plate body */}
      <rect x="100" y="40" width="80" height="100" rx="12" 
        fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1.5" />
      
      {/* Mounting screw holes */}
      <circle cx="140" cy="52" r="2.5" fill="hsl(var(--muted-foreground))" opacity="0.25" />
      <circle cx="140" cy="128" r="2.5" fill="hsl(var(--muted-foreground))" opacity="0.25" />

      {/* Socket face — inner recessed area */}
      <rect x="115" y="62" width="50" height="56" rx="8" 
        fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="1" />

      {/* Socket holes (two vertical slots + ground) */}
      <rect x="127" y="73" width="4" height="14" rx="2" fill="hsl(var(--foreground))" opacity="0.35" />
      <rect x="149" y="73" width="4" height="14" rx="2" fill="hsl(var(--foreground))" opacity="0.35" />
      {/* Ground slot (semicircle at bottom) */}
      <path d="M 140 102 a 5 5 0 0 1 0 -10 a 5 5 0 0 1 0 10" fill="hsl(var(--foreground))" opacity="0.2" />
    </g>

    {/* ─── SPARKS near socket ─── */}
    <g>
      {/* Spark 1 */}
      <circle cx="118" cy="78" r="2" fill="hsl(var(--primary))" filter="url(#spark-blur)">
        <animate attributeName="opacity" values="0;0.8;0" dur="2.2s" repeatCount="indefinite" begin="0s" />
        <animate attributeName="r" values="1;2.5;1" dur="2.2s" repeatCount="indefinite" begin="0s" />
      </circle>
      {/* Spark 2 */}
      <circle cx="165" cy="85" r="1.5" fill="hsl(var(--primary))" filter="url(#spark-blur)">
        <animate attributeName="opacity" values="0;0.6;0" dur="1.8s" repeatCount="indefinite" begin="0.7s" />
        <animate attributeName="r" values="1;2;1" dur="1.8s" repeatCount="indefinite" begin="0.7s" />
      </circle>
      {/* Spark 3 — small line burst */}
      <line x1="110" y1="90" x2="105" y2="86" stroke="hsl(var(--primary))" strokeWidth="1" strokeLinecap="round">
        <animate attributeName="opacity" values="0;0.5;0" dur="3s" repeatCount="indefinite" begin="1.2s" />
      </line>
      <line x1="170" y1="72" x2="175" y2="68" stroke="hsl(var(--primary))" strokeWidth="1" strokeLinecap="round">
        <animate attributeName="opacity" values="0;0.4;0" dur="2.5s" repeatCount="indefinite" begin="0.3s" />
      </line>
    </g>

    {/* ─── DANGLING CABLE with gentle sway ─── */}
    <g>
      <animateTransform 
        attributeName="transform" 
        type="rotate" 
        values="0 140 140;3 140 140;0 140 140;-2 140 140;0 140 140" 
        dur="5s" 
        repeatCount="indefinite" 
      />
      
      {/* Cable cord — thick rubber cable drooping down */}
      <path 
        d="M 140 140 C 140 155, 128 170, 120 185 S 115 200, 118 210" 
        stroke="url(#cable-grad)" 
        strokeWidth="5" 
        strokeLinecap="round" 
        fill="none" 
      />
      {/* Cable inner highlight */}
      <path 
        d="M 140 140 C 140 155, 128 170, 120 185 S 115 200, 118 210" 
        stroke="hsl(var(--muted-foreground))" 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        fill="none" 
        opacity="0.15"
      />

      {/* ─── PLUG HEAD ─── */}
      <g>
        {/* Plug body */}
        <rect x="126" y="128" width="28" height="18" rx="4" fill="url(#plug-metal)" />
        {/* Plug grip ridges */}
        <line x1="131" y1="132" x2="131" y2="142" stroke="hsl(var(--foreground))" strokeWidth="0.5" opacity="0.2" />
        <line x1="135" y1="132" x2="135" y2="142" stroke="hsl(var(--foreground))" strokeWidth="0.5" opacity="0.2" />
        <line x1="145" y1="132" x2="145" y2="142" stroke="hsl(var(--foreground))" strokeWidth="0.5" opacity="0.2" />
        <line x1="149" y1="132" x2="149" y2="142" stroke="hsl(var(--foreground))" strokeWidth="0.5" opacity="0.2" />

        {/* Prongs sticking up from plug */}
        <rect x="133" y="120" width="3.5" height="12" rx="1" fill="hsl(var(--foreground))" opacity="0.45" />
        <rect x="143.5" y="120" width="3.5" height="12" rx="1" fill="hsl(var(--foreground))" opacity="0.45" />
      </g>
    </g>
  </svg>
)

/**
 * WalletConnectionPrompt — A shared, artistic "connect wallet" empty state.
 *
 * @param {string}  title     — Heading text (default: "Connect Your Wallet")
 * @param {string}  subtitle  — Contextual description
 * @param {string}  className — Additional wrapper classes
 */
const WalletConnectionPrompt = ({
  title = 'Connect Your Wallet',
  subtitle = 'Please connect your wallet to continue.',
  className,
}) => {
  return (
    <div className={cn('min-h-[60vh] flex items-center justify-center px-4', className)}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="text-center max-w-sm mx-auto"
      >
        {/* Illustration */}
        <div className="mb-2">
          <UnpluggedIllustration />
        </div>

        {/* Title */}
        <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground mb-2 tracking-tight">
          {title}
        </h2>

        {/* Subtitle */}
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xs mx-auto">
          {subtitle}
        </p>

        {/* Subtle animated accent line */}
        <motion.div
          className="mt-6 mx-auto h-0.5 rounded-full bg-gradient-to-r from-transparent via-primary/40 to-transparent"
          initial={{ width: 0 }}
          animate={{ width: '50%' }}
          transition={{ delay: 0.4, duration: 0.8, ease: 'easeOut' }}
        />
      </motion.div>
    </div>
  )
}

export default WalletConnectionPrompt
