import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { 
  ShieldCheck, 
  Shuffle, 
  Layers, 
  Users, 
  LockKeyhole, 
  Sparkles, 
  BookOpen, 
  Info, 
  GitBranch, 
  Coins, 
  ChevronDown,
  Play,
  CheckCircle,
  Zap,
  Target,
  Award,
  TrendingUp,
  Lock,
  Globe,
  ArrowRight,
  Star,
  Shield,
  Cpu,
  Eye,
  X
} from 'lucide-react';
import { Button } from '../components/ui/button';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as Accordion from '@radix-ui/react-accordion';
import { useTheme } from '../contexts/ThemeContext';

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

const Section = ({ id, className = '', containerClassName = '', children }) => (
  <section id={id} className={`w-full ${className}`}>
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${containerClassName}`}>{children}</div>
  </section>
);

const SectionTitle = ({ eyebrow, title, subtitle, className = '' }) => (
  <div className={`text-center mb-8 sm:mb-10 lg:mb-14 ${className}`}>
    {eyebrow && (
      <div className="font-display text-[length:var(--text-sm)] tracking-wider uppercase text-primary mb-2 font-semibold">{eyebrow}</div>
    )}
    <h2 className="font-display text-[length:var(--text-4xl)] font-bold mb-3 text-foreground leading-tight tracking-tighter" style={{ textWrap: 'balance' }}>{title}</h2>
    {subtitle && <p className="font-body text-[length:var(--text-lg)] text-muted-foreground max-w-3xl mx-auto leading-relaxed">{subtitle}</p>}
  </div>
);

// Animated geometric background component with enhanced visuals
const GeometricBackground = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Respect prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    // Create floating geometric shapes
    const shapes = [];
    for (let i = 0; i < 8; i++) {
      const shape = document.createElement('div');
      const isLarge = i < 3;
      const size = isLarge ? Math.random() * 300 + 200 : Math.random() * 150 + 80;

      // Use theme-aware colors with better visibility
      shape.className = `absolute rounded-full
        ${isLarge ? 'bg-primary/10 dark:bg-primary/15 dim-blue:bg-primary/12' : 'bg-primary/5 dark:bg-primary/10 dim-blue:bg-primary/8'}
        blur-3xl`;
      shape.style.width = `${size}px`;
      shape.style.height = shape.style.width;
      shape.style.left = `${Math.random() * 100}%`;
      shape.style.top = `${Math.random() * 100}%`;
      container.appendChild(shape);
      shapes.push(shape);

      // Animate each shape with slower, more organic movement
      gsap.to(shape, {
        x: Math.random() * 150 - 75,
        y: Math.random() * 150 - 75,
        duration: Math.random() * 15 + 20,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut"
      });
    }

    return () => {
      shapes.forEach(shape => shape.remove());
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0 overflow-hidden pointer-events-none" />;
};

// Floating card visual element for hero
const HeroVisual = () => {
  const visualRef = useRef(null);

  useEffect(() => {
    const element = visualRef.current;
    if (!element) return;

    // Respect prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    // Subtle floating animation
    gsap.to(element, {
      y: -15,
      duration: 3,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut"
    });
  }, []);

  return (
    <div ref={visualRef} className="relative w-full max-w-lg mx-auto">
      {/* Main visual card stack */}
      <div className="relative">
        {/* Background glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-primary/10 rounded-3xl blur-2xl transform scale-110" />

        {/* Stacked cards effect */}
        <div className="absolute -top-4 -left-4 w-full h-full bg-card/50 rounded-2xl border border-border/30 transform rotate-[-6deg]" />
        <div className="absolute -top-2 -left-2 w-full h-full bg-card/70 rounded-2xl border border-border/50 transform rotate-[-3deg]" />

        {/* Main card */}
        <div className="relative bg-card rounded-2xl border border-border shadow-2xl p-6 backdrop-blur-sm">
          {/* Card header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <div className="font-display font-semibold text-foreground text-sm">NFT Drop</div>
                <div className="text-xs text-muted-foreground">Powered by VRF</div>
              </div>
            </div>
            <div className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
              Live
            </div>
          </div>

          {/* Progress visualization */}
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Participants</span>
              <span className="font-semibold text-foreground">2,847 / 5,000</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full" style={{ width: '57%' }} />
            </div>

            {/* Mini stats */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <div className="text-lg font-bold text-foreground">500</div>
                <div className="text-xs text-muted-foreground">Winners</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <div className="text-lg font-bold text-foreground">24h</div>
                <div className="text-xs text-muted-foreground">Duration</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <div className="text-lg font-bold text-primary">5000</div>
                <div className="text-xs text-muted-foreground">Slot Limit</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating badges */}
      <div className="absolute -right-4 top-1/4 animate-pulse">
        <div className="bg-card/90 backdrop-blur-sm rounded-full px-3 py-2 shadow-lg border border-border flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium text-foreground">Verified</span>
        </div>
      </div>
      <div className="absolute -left-4 bottom-1/4 animate-pulse" style={{ animationDelay: '1s' }}>
        <div className="bg-card/90 backdrop-blur-sm rounded-full px-3 py-2 shadow-lg border border-border flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium text-foreground">Secure</span>
        </div>
      </div>
    </div>
  );
};

// Counter animation component
const AnimatedCounter = ({ end, duration = 2, suffix = '' }) => {
  const [count, setCount] = useState(0);
  const elementRef = useRef(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          gsap.to({ value: 0 }, {
            value: end,
            duration,
            ease: "power2.out",
            onUpdate: function() {
              setCount(Math.floor(this.targets()[0].value));
            }
          });
          observer.unobserve(element);
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [end, duration]);

  return <span ref={elementRef}>{count}{suffix}</span>;
};

// FAQ parsing function
function parseFaq(md) {
  if (!md) return [];
  const lines = md.split('\n').map((l) => l.replace(/\r$/, ''));
  let i = 0;
  while (i < lines.length && (lines[i].trim() === '' || lines[i].trim().startsWith('##'))) i++;
  const items = [];
  while (i < lines.length) {
    if (!lines[i].trim().startsWith('**Q:')) { i++; continue; }
    const q = lines[i].trim().replace(/^\*\*Q:\s*/, '').replace(/\*\*$/, '').trim();
    i++;
    while (i < lines.length && lines[i].trim() === '') i++;
    const ans = [];
    if (i < lines.length && lines[i].trim().startsWith('A:')) {
      ans.push(lines[i].trim().replace(/^A:\s*/, ''));
      i++;
    }
    while (i < lines.length && !lines[i].trim().startsWith('**Q:')) {
      ans.push(lines[i]);
      i++;
    }
    items.push({ q, aMd: ans.join('\n').trim() });
  }
  return items;
}

export default function Homepage() {
  const [faqMd, setFaqMd] = useState('');
  const heroRef = useRef(null);
  const problemRef = useRef(null);
  const howItWorksRef = useRef(null);
  const { getCurrentTheme } = useTheme();

  // Initialize GSAP animations
  useEffect(() => {
    // Respect prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    // Hero animations
    const heroTl = gsap.timeline();
    heroTl
      .from('.hero-headline', { 
        opacity: 0, 
        y: 50, 
        duration: 1, 
        ease: "power3.out" 
      })
      .from('.hero-subtext', { 
        opacity: 0, 
        y: 30, 
        duration: 0.8, 
        ease: "power3.out" 
      }, "-=0.5")
      .from('.hero-cta', { 
        opacity: 0, 
        y: 20, 
        duration: 0.6, 
        stagger: 0.1, 
        ease: "power3.out" 
      }, "-=0.3");

    // Scroll-triggered animations
    gsap.utils.toArray('.reveal').forEach((element) => {
      gsap.fromTo(element, 
        { opacity: 0, y: 50 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: {
            trigger: element,
            start: "top 80%",
            end: "bottom 20%",
            toggleActions: "play none none reverse"
          }
        }
      );
    });

    // Staggered card animations
    gsap.utils.toArray('.card-grid').forEach((grid) => {
      const cards = grid.querySelectorAll('.card-item');
      gsap.fromTo(cards,
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          stagger: 0.1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: grid,
            start: "top 80%",
            toggleActions: "play none none reverse"
          }
        }
      );
    });

    // Subtle one-time attention animation for CTA button (not infinite pulse)
    gsap.fromTo('.pulse-btn', 
      { scale: 1 },
      {
        scale: 1.03,
        duration: 0.8,
        repeat: 2,
        yoyo: true,
        ease: "power2.inOut"
      }
    );

    return () => {
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    };
  }, []);

  // Load FAQ content
  useEffect(() => {
    let isMounted = true;
    fetch('/FAQ.md')
      .then((res) => res.text())
      .then((txt) => { if (isMounted) setFaqMd(txt); })
      .catch(() => { if (isMounted) setFaqMd('## FAQ\nContent unavailable.'); });
    return () => { isMounted = false; };
  }, []);

  const faqItems = parseFaq(faqMd);

  return (
    <div className="bg-background text-foreground overflow-x-hidden -mb-8">
      {/* Skip to content link for keyboard navigation */}
      <a href="#problem" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:shadow-lg focus:outline-none">
        Skip to main content
      </a>

      {/* Hero Section */}
      <Section id="hero" className="min-h-0 sm:min-h-[90vh] lg:min-h-[100vh] flex items-center justify-center relative overflow-hidden pt-16 sm:pt-0">
        {/* Background */}
        <div className="absolute inset-0 bg-background" />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }}
        />

        <div className="relative z-10 w-full py-12 sm:py-20">
          <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-16 xl:gap-20 items-center max-w-7xl mx-auto">
            {/* Left side - Content */}
            <div className="text-center lg:text-left order-2 lg:order-1">
              {/* Eyebrow tag */}
              <div className="hero-headline inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-body text-[length:var(--text-sm)] font-medium text-primary">Provably Fair Distribution</span>
              </div>

              <h1 className="hero-headline font-display text-[length:var(--text-5xl)] font-bold mb-8 text-foreground leading-[1.1] tracking-tighter">
                Explore New Strategies to Distribute{' '}
                <span className="relative inline-block">
                  <span className="bg-gradient-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent">
                    NFTs
                  </span>
                  <span className="absolute -bottom-1 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/50 rounded-full" />
                </span>{' '}
                and{' '}
                <span className="relative inline-block">
                  <span className="bg-gradient-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent">
                    Community Rewards
                  </span>
                  <span className="absolute -bottom-1 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/50 rounded-full" />
                </span>
              </h1>

              {/* Trust signals as animated inline ticker */}
              <div className="hero-subtext mb-8">
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-1.5 sm:gap-x-2 gap-y-2 sm:gap-y-3">
                  {/* Chainlink VRF */}
                  <div className="group relative flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full bg-transparent border border-primary/20 hover:border-primary/40 transition-colors transition-border duration-300 cursor-default">
                    <div className="relative flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary/20 group-hover:bg-primary/30 transition-colors">
                      <Shield className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary" aria-hidden="true" />
                    </div>
                    <span className="relative font-body text-[length:var(--text-sm)] font-medium text-foreground/80 group-hover:text-foreground transition-colors">Chainlink VRF Powered</span>
                  </div>

                  {/* Separator dot */}
                  <div className="hidden sm:block w-1 h-1 rounded-full bg-primary/40" />

                  {/* Fairness Guaranteed */}
                  <div className="group relative flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full bg-transparent border border-primary/20 hover:border-primary/40 transition-colors transition-border duration-300 cursor-default">
                    <div className="relative flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary/20 group-hover:bg-primary/30 transition-colors">
                      <CheckCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary" aria-hidden="true" />
                    </div>
                    <span className="relative font-body text-[length:var(--text-sm)] font-medium text-foreground/80 group-hover:text-foreground transition-colors">Permissionless</span>
                  </div>

                  {/* Separator dot */}
                  <div className="hidden sm:block w-1 h-1 rounded-full bg-primary/40" />

                  {/* Fully Transparent */}
                  <div className="group relative flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full bg-transparent border border-primary/20 hover:border-primary/40 transition-colors transition-border duration-300 cursor-default">
                    <div className="relative flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary/20 group-hover:bg-primary/30 transition-colors">
                      <Eye className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary" aria-hidden="true" />
                    </div>
                    <span className="relative font-body text-[length:var(--text-sm)] font-medium text-foreground/80 group-hover:text-foreground transition-colors">Fully Transparent</span>
                  </div>

                  {/* Separator dot */}
                  <div className="hidden sm:block w-1 h-1 rounded-full bg-primary/40" />

                  {/* Trustless */}
                  <div className="group relative flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full bg-transparent border border-primary/20 hover:border-primary/40 transition-colors transition-border duration-300 cursor-default">
                    <div className="relative flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary/20 group-hover:bg-primary/30 transition-colors">
                      <LockKeyhole className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary" aria-hidden="true" />
                    </div>
                    <span className="relative font-body text-[length:var(--text-sm)] font-medium text-foreground/80 group-hover:text-foreground transition-colors">Trustless</span>
                  </div>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="hero-cta flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link
                  to="/app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pulse-btn group inline-flex items-center justify-center gap-2 px-5 py-2.5 sm:px-8 sm:py-4 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors transition-shadow transition-transform duration-300 shadow-lg hover:shadow-xl hover:shadow-primary/25 font-semibold text-sm sm:text-[length:var(--text-lg)]"
                >
                  Launch Dapp
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  to="/docs"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 sm:px-8 sm:py-4 rounded-full bg-card border border-border text-foreground hover:border-primary hover:bg-card/80 transition-colors transition-shadow duration-300 font-semibold text-sm sm:text-[length:var(--text-base)]"
                >
                  <BookOpen className="h-5 w-5" />
                  Read Documentation
                </Link>
              </div>
            </div>

            {/* Right side - Visual (desktop/tablet) */}
            <div className="hero-cta order-1 lg:order-2 hidden sm:block">
              <HeroVisual />
            </div>

          </div>
        </div>
      </Section>

      {/* Problem Statement */}
      <Section id="problem" className="py-12 sm:py-16 lg:py-20 bg-card">
        <div className="reveal">
          <SectionTitle 
            title="The End of Opaque Whitelist Allocations, Botted Mints, and Rigged Giveaways"
            subtitle="Traditional Web3 distribution methods are broken. Dropr introduces new distribution mechanisms built on provably fair technology."
          />
        </div>
        
        {/* Phase 3: Enhanced problem cards with hover animations and staggered reveal */}
        <div className="card-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mt-10 sm:mt-16">
          <div className="card-item group bg-background rounded-2xl p-5 sm:p-6 lg:p-8 text-center hover:shadow-xl hover:shadow-primary/5 transition-shadow transition-transform transition-colors duration-300 border border-border hover:border-primary/30 hover:-translate-y-1">
            <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 group-hover:scale-110 transition-colors transition-transform duration-300">
              <Shield className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-primary" aria-hidden="true" />
            </div>
            <h3 className="font-display text-[length:var(--text-xl)] font-bold mb-3 text-foreground leading-snug group-hover:text-primary transition-colors">No More Insider Favoritism</h3>
            <p className="font-body text-[length:var(--text-sm)] text-muted-foreground leading-relaxed">Cryptographically secure randomness ensures every participant has an equal chance</p>
          </div>
          
          <div className="card-item group bg-background rounded-2xl p-5 sm:p-6 lg:p-8 text-center hover:shadow-xl hover:shadow-primary/5 transition-shadow transition-transform transition-colors duration-300 border border-border hover:border-primary/30 hover:-translate-y-1">
            <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 group-hover:scale-110 transition-colors transition-transform duration-300">
              <Cpu className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-primary" aria-hidden="true" />
            </div>
            <h3 className="font-display text-[length:var(--text-xl)] font-bold mb-3 text-foreground leading-snug group-hover:text-primary transition-colors">Discourage Bot Attacks</h3>
            <p className="font-body text-[length:var(--text-sm)] text-muted-foreground leading-relaxed">The Winner selection algorithm largely disincentivizes bot manipulation during NFT Drops</p>
          </div>
          
          <div className="card-item group bg-background rounded-2xl p-5 sm:p-6 lg:p-8 text-center hover:shadow-xl hover:shadow-primary/5 transition-shadow transition-transform transition-colors duration-300 border border-border hover:border-primary/30 hover:-translate-y-1">
            <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 group-hover:scale-110 transition-colors transition-transform duration-300">
              <Users className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-primary" aria-hidden="true" />
            </div>
            <h3 className="font-display text-[length:var(--text-xl)] font-bold mb-3 text-foreground leading-snug group-hover:text-primary transition-colors">Build Community Trust</h3>
            <p className="font-body text-[length:var(--text-sm)] text-muted-foreground leading-relaxed">Transparent, verifiable processes that communities can audit and trust</p>
          </div>
          
          <div className="card-item group bg-background rounded-2xl p-5 sm:p-6 lg:p-8 text-center hover:shadow-xl hover:shadow-primary/5 transition-shadow transition-transform transition-colors duration-300 border border-border hover:border-primary/30 hover:-translate-y-1">
            <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 group-hover:scale-110 transition-colors transition-transform duration-300">
              <Zap className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-primary" aria-hidden="true" />
            </div>
            <h3 className="font-display text-[length:var(--text-xl)] font-bold mb-3 text-foreground leading-snug group-hover:text-primary transition-colors">Trustless Asset Distribution</h3>
            <p className="font-body text-[length:var(--text-sm)] text-muted-foreground leading-relaxed">Smart contracts securely manage prizes without need for intervention from creators</p>
          </div>
        </div>
      </Section>

      {/* Why Dropr is a Gamechanger */}
      <Section id="why-dropr-gamechanger" className="py-12 sm:py-16 lg:py-20 bg-card">
        <div className="reveal">
          <SectionTitle 
            title="Why Dropr is a Gamechanger"
            subtitle="Revolutionary features that set Dropr apart from traditional NFT launchpads"
          />
        </div>

        <div className="reveal mt-12">
          <div className="max-w-6xl mx-auto">
            {/* Mobile: Stacked feature cards (no horizontal scroll) */}
            <div className="md:hidden space-y-3">
              {[
                { feature: 'Community-centred distribution', dropr: true, opensea: false, magiceden: false },
                { feature: 'Anti-sybil measures', dropr: true, opensea: false, magiceden: false },
                { feature: 'Team allocations & vesting', dropr: true, opensea: false, magiceden: false },
                { feature: 'Ultra flexible drop experience', dropr: true, opensea: false, magiceden: false },
                { feature: 'Guaranteed healthy post-mint price action', dropr: true, opensea: false, magiceden: false },
                { feature: 'Permissionless', dropr: true, opensea: true, magiceden: true },
              ].map((row, i) => (
                <div key={i} className={`rounded-xl border border-border p-4 ${i % 2 === 1 ? 'bg-muted/30' : 'bg-background'}`}>
                  <p className="font-body text-sm font-medium text-foreground mb-3 text-center">{row.feature}</p>
                  <div className="flex items-center justify-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${row.dropr ? 'bg-primary/10' : 'bg-muted'}`}>
                        {row.dropr ? <CheckCircle className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> : <X className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />}
                      </span>
                      <span className="text-xs font-medium text-primary">Dropr</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${row.opensea ? '' : 'opacity-50'}`}>
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${row.opensea ? 'bg-primary/10' : 'bg-muted'}`}>
                        {row.opensea ? <CheckCircle className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> : <X className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />}
                      </span>
                      <span className={`text-xs ${row.opensea ? 'font-medium text-primary' : 'text-muted-foreground'}`}>OS</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${row.magiceden ? '' : 'opacity-50'}`}>
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${row.magiceden ? 'bg-primary/10' : 'bg-muted'}`}>
                        {row.magiceden ? <CheckCircle className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> : <X className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />}
                      </span>
                      <span className={`text-xs ${row.magiceden ? 'font-medium text-primary' : 'text-muted-foreground'}`}>ME</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: Full comparison table */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-border">
              <table className="w-full border-collapse">
                <caption className="sr-only">Feature comparison between Dropr, OpenSea, and MagicEden</caption>
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className="text-center p-4 font-display text-[length:var(--text-lg)] font-semibold text-foreground">Narratives</th>
                    <th scope="col" className="text-center p-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-2 p-1 ${getCurrentTheme().id === 'light' ? 'bg-background border-2 border-primary' : 'bg-primary'}`}>
                          <img 
                            src={getCurrentTheme().id === 'light' ? "/images/logo/Asset 25.svg" : "/images/logo/Asset 26.svg"}
                            alt="Dropr"
                            width={40}
                            height={40}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <span className="font-display text-[length:var(--text-base)] font-semibold text-primary">Dropr</span>
                      </div>
                    </th>
                    <th scope="col" className="text-center p-4">
                      <div className="flex flex-col items-center opacity-50">
                        <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mb-2">
                          <span className="text-muted-foreground font-bold text-lg">OS</span>
                        </div>
                        <span className="font-display text-[length:var(--text-base)] font-semibold text-muted-foreground">OpenSea</span>
                      </div>
                    </th>
                    <th scope="col" className="text-center p-4">
                      <div className="flex flex-col items-center opacity-50">
                        <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mb-2">
                          <span className="text-muted-foreground font-bold text-lg">ME</span>
                        </div>
                        <span className="font-display text-[length:var(--text-base)] font-semibold text-muted-foreground">MagicEden</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border hover:bg-primary/5 transition-colors">
                    <td className="p-4 text-center font-body text-[length:var(--text-sm)] text-foreground">
                      <span>Community-centred distribution</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full">
                        <CheckCircle className="h-5 w-5 text-primary" aria-hidden="true" />
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-muted rounded-full">
                        <X className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-muted rounded-full">
                        <X className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-border bg-muted/30 hover:bg-primary/5 transition-colors">
                    <td className="p-4 text-center font-body text-[length:var(--text-sm)] text-foreground">
                      <span>Anti-sybil measures</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full">
                        <CheckCircle className="h-5 w-5 text-primary" aria-hidden="true" />
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-muted rounded-full">
                        <X className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-muted rounded-full">
                        <X className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-border hover:bg-primary/5 transition-colors">
                    <td className="p-4 text-center font-body text-[length:var(--text-sm)] text-foreground">
                      <span>Team allocations & vesting</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full">
                        <CheckCircle className="h-5 w-5 text-primary" aria-hidden="true" />
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-muted rounded-full">
                        <X className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-muted rounded-full">
                        <X className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-border bg-muted/30 hover:bg-primary/5 transition-colors">
                    <td className="p-4 text-center font-body text-[length:var(--text-sm)] text-foreground">
                      <span>Ultra flexible drop experience</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full">
                        <CheckCircle className="h-5 w-5 text-primary" aria-hidden="true" />
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-muted rounded-full">
                        <X className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-muted rounded-full">
                        <X className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-border hover:bg-primary/5 transition-colors">
                    <td className="p-4 text-center font-body text-[length:var(--text-sm)] text-foreground">
                      <span>Guaranteed healthy post-mint price action</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full">
                        <CheckCircle className="h-5 w-5 text-primary" aria-hidden="true" />
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-muted rounded-full">
                        <X className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-muted rounded-full">
                        <X className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      </span>
                    </td>
                  </tr>
                  <tr className="bg-muted/30 hover:bg-primary/5 transition-colors">
                    <td className="p-4 text-center font-body text-[length:var(--text-sm)] text-foreground">
                      <span>Permissionless</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full">
                        <CheckCircle className="h-5 w-5 text-primary" aria-hidden="true" />
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full">
                        <CheckCircle className="h-5 w-5 text-primary" aria-hidden="true" />
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full">
                        <CheckCircle className="h-5 w-5 text-primary" aria-hidden="true" />
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div className="mt-8 sm:mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="card-item bg-background rounded-2xl p-4 sm:p-6 text-center hover:shadow-xl transition-shadow transition-colors duration-300 border border-border">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="h-5 w-5 sm:h-6 sm:w-6 text-primary" aria-hidden="true" />
                </div>
                <h3 className="font-display text-[length:var(--text-lg)] font-bold mb-2 text-foreground">Community First</h3>
                <p className="font-body text-[length:var(--text-sm)] text-muted-foreground">Fair distribution mechanisms that put your community at the center</p>
              </div>
              
              <div className="card-item bg-background rounded-2xl p-4 sm:p-6 text-center hover:shadow-xl transition-shadow transition-colors duration-300 border border-border">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-primary" aria-hidden="true" />
                </div>
                <h3 className="font-display text-[length:var(--text-lg)] font-bold mb-2 text-foreground">Bot Resistant</h3>
                <p className="font-body text-[length:var(--text-sm)] text-muted-foreground">Anti-sybil measures ensure genuine participation</p>
              </div>
              
              <div className="card-item bg-background rounded-2xl p-4 sm:p-6 text-center hover:shadow-xl transition-shadow transition-colors duration-300 border border-border">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-primary" aria-hidden="true" />
                </div>
                <h3 className="font-display text-[length:var(--text-lg)] font-bold mb-2 text-foreground">Price Stability</h3>
                <p className="font-body text-[length:var(--text-sm)] text-muted-foreground">Healthy supply distribution guarantees healthy price action post-mint</p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Use Cases */}
      <Section id="use-cases" className="py-12 sm:py-16 lg:py-20 bg-background">
        <div className="reveal">
          <SectionTitle 
             title="Built for Web3"
             subtitle="Launch NFT drops, grow and reward communities, build genuine engagement"
           />
        </div>

        <div className="card-grid grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 mt-10 sm:mt-16">
          <div className="card-item bg-card rounded-2xl p-5 sm:p-6 lg:p-8 hover:shadow-xl transition-shadow transition-colors duration-300 border border-border">
            <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 sm:mb-6">
              <Sparkles className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-primary" aria-hidden="true" />
            </div>
            <h3 className="font-display text-[length:var(--text-2xl)] font-bold mb-4 text-foreground leading-snug">Projects</h3>
            <p className="font-body text-[length:var(--text-sm)] text-muted-foreground mb-6 leading-relaxed">Fairly distribute whitelist spots for new mints. Eliminate gas wars and ensure equal opportunity for all community members.</p>
            <ul className="space-y-2 font-body text-[length:var(--text-sm)] text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span className="font-body text-[length:var(--text-sm)] text-muted-foreground">Supports ERC721 & ERC1155 standards</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span className="font-body text-[length:var(--text-sm)] text-muted-foreground">Flexible launch strategies</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span className="font-body text-[length:var(--text-sm)] text-muted-foreground">Inter-community collabs simplified</span>
              </li>
            </ul>
          </div>

          <div className="card-item bg-card rounded-2xl p-5 sm:p-6 lg:p-8 hover:shadow-xl transition-shadow transition-colors duration-300 border border-border">
            <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 sm:mb-6">
              <TrendingUp className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-primary" aria-hidden="true" />
            </div>
            <h3 className="font-display text-[length:var(--text-2xl)] font-bold mb-4 text-foreground leading-snug">KOLs & Influencers</h3>
            <p className="font-body text-[length:var(--text-sm)] text-muted-foreground mb-6 leading-relaxed">Host trustless giveaways that protect your reputation. Build authentic engagement with your community using provably fair raffling mechanics.</p>
            <ul className="space-y-2 font-body text-[length:var(--text-sm)] text-muted-foreground">
               <li className="flex items-center gap-2">
                 <CheckCircle className="h-4 w-4 text-primary" />
                 <span className="font-body text-[length:var(--text-sm)] text-muted-foreground">Build reputation and trust</span>
               </li>
               <li className="flex items-center gap-2">
                 <CheckCircle className="h-4 w-4 text-primary" />
                 <span className="font-body text-[length:var(--text-sm)] text-muted-foreground">Flexible prize options for community rewards</span>
               </li>
               <li className="flex items-center gap-2">
                 <CheckCircle className="h-4 w-4 text-primary" />
                 <span className="font-body text-[length:var(--text-sm)] text-muted-foreground">Project collabs made easy</span>
               </li>
             </ul>
          </div>

          <div className="card-item bg-card rounded-2xl p-5 sm:p-6 lg:p-8 hover:shadow-xl transition-shadow transition-colors duration-300 border border-border">
            <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 sm:mb-6">
              <Globe className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-primary" aria-hidden="true" />
            </div>
            <h3 className="font-display text-[length:var(--text-2xl)] font-bold mb-4 text-foreground leading-snug">Creators</h3>
            <p className="font-body text-[length:var(--text-sm)] text-muted-foreground mb-6 leading-relaxed">Grow your community and holder base by transparently distributing rewards to holders of creator tokens.</p>
            <ul className="space-y-2 font-body text-[length:var(--text-sm)] text-muted-foreground">
               <li className="flex items-center gap-2">
                 <CheckCircle className="h-4 w-4 text-primary" />
                 <span className="font-body text-[length:var(--text-sm)] text-muted-foreground">Token-gated raffles for holder rewards</span>
               </li>
               <li className="flex items-center gap-2">
                 <CheckCircle className="h-4 w-4 text-primary" />
                 <span className="font-body text-[length:var(--text-sm)] text-muted-foreground">Flexible prize options for holder rewards</span>
               </li>
               <li className="flex items-center gap-2">
                 <CheckCircle className="h-4 w-4 text-primary" />
                 <span className="font-body text-[length:var(--text-sm)] text-muted-foreground">Easy collabs with projects and other creators</span>
               </li>
             </ul>
          </div>
        </div>
      </Section>

      {/* FAQ Section */}
      <Section id="faq" className="py-12 sm:py-16 lg:py-20 bg-background">
        <div className="reveal">
          <SectionTitle 
            title="Frequently Asked Questions"
          />
        </div>
        
        {/* Phase 3: Enhanced FAQ accordion with improved animations */}
        <div className="reveal max-w-4xl mx-auto mt-12">
          <Accordion.Root type="single" collapsible className="space-y-4">
            {faqItems.map((item, idx) => (
              <Accordion.Item 
                key={idx} 
                value={`item-${idx}`} 
                className="rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
              >
                <Accordion.Header>
                  <Accordion.Trigger className="w-full p-4 sm:p-6 flex items-center justify-between text-left font-semibold hover:bg-primary/5 transition-all duration-300 group">
                    <span className="pr-4 text-base sm:text-lg text-foreground group-hover:text-primary leading-relaxed transition-colors">{item.q}</span>
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-all duration-300">
                      <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-300 data-[state=open]:rotate-180 text-primary" aria-hidden="true" />
                    </div>
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="px-4 sm:px-6 pb-4 sm:pb-6 pt-2 border-t border-border/50 overflow-hidden data-[state=open]:animate-slideDown data-[state=closed]:animate-slideUp">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: (props) => <p className="text-sm text-muted-foreground" {...props} />,
                      li: (props) => <li className="list-disc ml-5 text-sm text-muted-foreground" {...props} />,
                      strong: (props) => <strong className="text-primary font-semibold" {...props} />,
                      a: (props) => <a className="text-primary underline hover:text-primary/80" {...props} />
                    }}
                  >
                    {item.aMd}
                  </ReactMarkdown>
                </Accordion.Content>
              </Accordion.Item>
            ))}
          </Accordion.Root>
        </div>
      </Section>

      {/* Phase 3: Enhanced Final CTA with animated gradient */}
      <Section id="final-cta" className="py-16 sm:py-20 relative overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-500 via-brand-400 to-brand-600 bg-[length:200%_200%] animate-gradient-shift" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.08),transparent_50%)]" />
        
        <div className="reveal text-center relative z-10 text-white">
          <h2 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 drop-shadow-lg">
            Ready to Build Trust with Your Community?
          </h2>
          <p className="text-base sm:text-xl md:text-2xl mb-6 sm:mb-8 opacity-90 max-w-3xl mx-auto">
            Create Your Distribution Event - No Code Required
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              to="/create-raffle"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center justify-center gap-2 px-5 py-2.5 sm:px-8 sm:py-4 lg:px-10 lg:py-5 rounded-full bg-white text-brand-600 hover:bg-white/90 transition-colors transition-shadow transition-transform duration-300 shadow-lg hover:shadow-2xl hover:shadow-white/20 font-bold text-sm sm:text-lg lg:text-xl hover:-translate-y-0.5"
            >
              Launch Your Event Now
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/docs"
              className="inline-flex items-center justify-center px-5 py-2.5 sm:px-8 sm:py-4 lg:px-10 lg:py-5 rounded-full border-2 border-white/80 text-white hover:bg-white hover:text-brand-600 transition-colors transition-shadow transition-transform duration-300 font-bold text-sm sm:text-lg lg:text-xl hover:-translate-y-0.5"
            >
              <BookOpen className="mr-3 h-5 w-5 sm:h-6 sm:w-6" />
              Read Documentation
            </Link>
          </div>
          
          <div className="mt-10 flex flex-wrap justify-center items-center gap-6 sm:gap-8 lg:gap-12 text-sm">
            <div className="flex items-center gap-2 opacity-90 hover:opacity-100 transition-opacity">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <Star className="h-4 w-4" aria-hidden="true" />
              </div>
              <span>Permissionless</span>
            </div>
            <div className="flex items-center gap-2 opacity-90 hover:opacity-100 transition-opacity">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <Shield className="h-4 w-4" aria-hidden="true" />
              </div>
              <span>Secure</span>
            </div>
            <div className="flex items-center gap-2 opacity-90 hover:opacity-100 transition-opacity">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <Zap className="h-4 w-4" aria-hidden="true" />
              </div>
              <span>Deploy in seconds</span>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}

