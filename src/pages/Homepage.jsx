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
    <h2 className="font-display text-[length:var(--text-4xl)] font-bold mb-3 text-foreground leading-tight tracking-tighter">{title}</h2>
    {subtitle && <p className="font-body text-[length:var(--text-lg)] text-muted-foreground max-w-3xl mx-auto leading-relaxed">{subtitle}</p>}
  </div>
);

// Animated geometric background component
const GeometricBackground = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Create floating geometric shapes
    const shapes = [];
    for (let i = 0; i < 6; i++) {
      const shape = document.createElement('div');
      // Use theme-aware colors with better visibility
      shape.className = `absolute rounded-full animate-pulse
        bg-primary/20 dark:bg-primary/30 dim-blue:bg-primary/25
        border border-primary/30 dark:border-primary/40 dim-blue:border-primary/35
        shadow-lg dark:shadow-primary/20 dim-blue:shadow-primary/25`;
      shape.style.width = `${Math.random() * 200 + 100}px`;
      shape.style.height = shape.style.width;
      shape.style.left = `${Math.random() * 100}%`;
      shape.style.top = `${Math.random() * 100}%`;
      container.appendChild(shape);
      shapes.push(shape);

      // Animate each shape
      gsap.to(shape, {
        x: Math.random() * 100 - 50,
        y: Math.random() * 100 - 50,
        duration: Math.random() * 10 + 10,
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

    // Pulse animation for CTA buttons
    gsap.to('.pulse-btn', {
      scale: 1.05,
      duration: 1,
      repeat: -1,
      yoyo: true,
      ease: "power2.inOut"
    });

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
      {/* Hero Section */}
      <Section id="hero" className="min-h-[90vh] sm:min-h-[100vh] flex items-center justify-center relative bg-gradient-to-br from-background via-card to-muted pt-16 sm:pt-0">
        <div className="relative z-10 w-full py-12 sm:py-20">
          <div className="text-center max-w-6xl mx-auto">
            <h1 className="hero-headline font-display text-[length:var(--text-5xl)] font-bold mb-4 sm:mb-6 text-foreground leading-tight tracking-tighter">
              Explore New Strategies to Distribute{' '}
              <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                NFTs
              </span>{' '}
              and{' '}
              <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Community Rewards
              </span>
            </h1>
            <p className="hero-subtext font-body text-[length:var(--text-lg)] text-muted-foreground mb-6 sm:mb-8 max-w-4xl mx-auto leading-relaxed">
              Transparent whitelist allocations • Inter-community collaboration • Disincentivize mint bots • Earn community trust
            </p>
            
            <div className="hero-cta flex flex-col items-center gap-6 mb-6 sm:mb-12">
              <Link
                to="/app"
                target="_blank"
                rel="noopener noreferrer"
                className="pulse-btn inline-flex items-center justify-center px-8 py-4 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 shadow-lg hover:shadow-xl font-semibold text-[length:var(--text-lg)]"
              >
                Launch Dapp
              </Link>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Button
                  onClick={() => document.getElementById('video-demo').scrollIntoView({ behavior: 'smooth' })}
                  variant="secondary"
                  size="lg"
                  className="hero-cta"
                >
                  <Play className="mr-2 h-5 w-5" />
                  Watch Demo
                </Button>
                <a
                  href="https://docs.rafflhub.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hero-cta inline-flex items-center justify-center px-8 py-4 rounded-full border border-muted-foreground text-muted-foreground hover:border-primary hover:text-primary transition-all duration-300 font-semibold text-[length:var(--text-base)]"
                >
                  <BookOpen className="mr-2 h-5 w-5" />
                  Read Documentation
                </a>
              </div>
            </div>

            {/* Trust signals */}
            <div className="hero-cta flex flex-wrap justify-center items-center gap-6 font-body text-[length:var(--text-base)] text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <span>Chainlink VRF Powered</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                <span>Fairness Guaranteed</span>
              </div>
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" />
                <span>Fully Transparent</span>
              </div>
              <div className="flex items-center gap-2">
                <LockKeyhole className="h-5 w-5 text-primary" />
                <span>Trustless</span>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Problem Statement */}
      <Section id="problem" className="py-20 bg-card">
        <div className="reveal">
          <SectionTitle 
            title="The End of Opaque Whitelist Allocations, Botted Mints, and Rigged Giveaways"
            subtitle="Traditional Web3 distribution methods are broken. Dropr introduces new distribution mechanisms built on provably fair technology."
          />
        </div>
        
        <div className="card-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-16">
          <div className="card-item bg-background rounded-2xl p-8 text-center hover:shadow-xl transition-all duration-300 border border-border">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-display text-[length:var(--text-xl)] font-bold mb-3 text-foreground leading-snug">No More Insider Favoritism</h3>
            <p className="font-body text-[length:var(--text-sm)] text-muted-foreground leading-relaxed">Cryptographically secure randomness ensures every participant has an equal chance</p>
          </div>
          
          <div className="card-item bg-background rounded-2xl p-8 text-center hover:shadow-xl transition-all duration-300 border border-border">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Cpu className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-display text-[length:var(--text-xl)] font-bold mb-3 text-foreground leading-snug">Discourage Bot Attacks</h3>
            <p className="font-body text-[length:var(--text-sm)] text-muted-foreground leading-relaxed">The Winner selection algorithm largely disincentivizes bot manipulation during NFT Drops</p>
          </div>
          
          <div className="card-item bg-background rounded-2xl p-8 text-center hover:shadow-xl transition-all duration-300 border border-border">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-display text-[length:var(--text-xl)] font-bold mb-3 text-foreground leading-snug">Build Community Trust</h3>
            <p className="font-body text-[length:var(--text-sm)] text-muted-foreground leading-relaxed">Transparent, verifiable processes that communities can audit and trust</p>
          </div>
          
          <div className="card-item bg-background rounded-2xl p-8 text-center hover:shadow-xl transition-all duration-300 border border-border">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Zap className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-display text-[length:var(--text-xl)] font-bold mb-3 text-foreground leading-snug">Trustless Asset Distribution</h3>
            <p className="font-body text-[length:var(--text-sm)] text-muted-foreground leading-relaxed">Smart contracts securely manage prizes without need for intervention from creators</p>
          </div>
        </div>
      </Section>

      {/* Why Dropr is a Gamechanger */}
      <Section id="why-dropr-gamechanger" className="py-20 bg-card">
        <div className="reveal">
          <SectionTitle 
            title="Why Dropr is a Gamechanger"
            subtitle="Revolutionary features that set Dropr apart from traditional NFT launchpads"
          />
        </div>

        <div className="reveal mt-12">
          <div className="max-w-6xl mx-auto">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-center p-4 font-display text-[length:var(--text-lg)] font-semibold text-foreground">Narratives</th>
                    <th className="text-center p-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-2 p-1 ${getCurrentTheme().id === 'light' ? 'bg-background border-2 border-primary' : 'bg-primary'}`}>
                          <img 
                            src={getCurrentTheme().id === 'light' ? "/images/logo/Asset 25.svg" : "/images/logo/Asset 26.svg"}
                            alt="Dropr"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <span className="font-display text-[length:var(--text-base)] font-semibold text-primary">Dropr</span>
                      </div>
                    </th>
                    <th className="text-center p-4">
                      <div className="flex flex-col items-center opacity-50">
                        <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mb-2">
                          <span className="text-muted-foreground font-bold text-lg">OS</span>
                        </div>
                        <span className="font-display text-[length:var(--text-base)] font-semibold text-muted-foreground">OpenSea</span>
                      </div>
                    </th>
                    <th className="text-center p-4">
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
                        <CheckCircle className="h-5 w-5 text-primary" />
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-muted rounded-full">
                        <X className="h-5 w-5 text-muted-foreground" />
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-muted rounded-full">
                        <X className="h-5 w-5 text-muted-foreground" />
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-border hover:bg-primary/5 transition-colors">
                    <td className="p-4 text-center font-body text-[length:var(--text-sm)] text-foreground">
                      <span>Anti-sybil measures</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full">
                        <CheckCircle className="h-5 w-5 text-primary" />
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-muted rounded-full">
                        <X className="h-5 w-5 text-muted-foreground" />
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-muted rounded-full">
                        <X className="h-5 w-5 text-muted-foreground" />
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-border hover:bg-primary/5 transition-colors">
                    <td className="p-4 text-center font-body text-[length:var(--text-sm)] text-foreground">
                      <span>Team allocations & vesting</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full">
                        <CheckCircle className="h-5 w-5 text-primary" />
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-muted rounded-full">
                        <X className="h-5 w-5 text-muted-foreground" />
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-muted rounded-full">
                        <X className="h-5 w-5 text-muted-foreground" />
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-border hover:bg-primary/5 transition-colors">
                    <td className="p-4 text-center font-body text-[length:var(--text-sm)] text-foreground">
                      <span>Ultra flexible drop experience</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full">
                        <CheckCircle className="h-5 w-5 text-primary" />
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-muted rounded-full">
                        <X className="h-5 w-5 text-muted-foreground" />
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-muted rounded-full">
                        <X className="h-5 w-5 text-muted-foreground" />
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-border hover:bg-primary/5 transition-colors">
                    <td className="p-4 text-center font-body text-[length:var(--text-sm)] text-foreground">
                      <span>Guaranteed healthy post-mint price action</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full">
                        <CheckCircle className="h-5 w-5 text-primary" />
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-muted rounded-full">
                        <X className="h-5 w-5 text-muted-foreground" />
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-muted rounded-full">
                        <X className="h-5 w-5 text-muted-foreground" />
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-primary/5 transition-colors">
                    <td className="p-4 text-center font-body text-[length:var(--text-sm)] text-foreground">
                      <span>Permissionless</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full">
                        <CheckCircle className="h-5 w-5 text-primary" />
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full">
                        <CheckCircle className="h-5 w-5 text-primary" />
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full">
                        <CheckCircle className="h-5 w-5 text-primary" />
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="card-item bg-background rounded-2xl p-6 text-center hover:shadow-xl transition-all duration-300 border border-border">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display text-[length:var(--text-lg)] font-bold mb-2 text-foreground">Community First</h3>
                <p className="font-body text-[length:var(--text-sm)] text-muted-foreground">Fair distribution mechanisms that put your community at the center</p>
              </div>
              
              <div className="card-item bg-background rounded-2xl p-6 text-center hover:shadow-xl transition-all duration-300 border border-border">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display text-[length:var(--text-lg)] font-bold mb-2 text-foreground">Bot Resistant</h3>
                <p className="font-body text-[length:var(--text-sm)] text-muted-foreground">Anti-sybil measures ensure genuine participation</p>
              </div>
              
              <div className="card-item bg-background rounded-2xl p-6 text-center hover:shadow-xl transition-all duration-300 border border-border">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display text-[length:var(--text-lg)] font-bold mb-2 text-foreground">Price Stability</h3>
                <p className="font-body text-[length:var(--text-sm)] text-muted-foreground">Healthy supply distribution guarantees healthy price action post-mint</p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Video Explainer Section */}
      <Section id="video-demo" className="py-20 bg-background">
        <div className="reveal">
          <SectionTitle 
            title="Watch Dropr in Action"
          />
        </div>
        
        <div className="reveal mt-12">
          <div className="max-w-4xl mx-auto">
            <div className="relative aspect-[16/9] sm:aspect-video rounded-2xl overflow-hidden shadow-2xl bg-primary/5 border border-border">
              {/* Placeholder for video embed */}
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                <div className="text-center px-4">
                  <div className="w-16 h-16 sm:w-24 sm:h-24 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 hover:scale-110 transition-transform cursor-pointer">
                    <Play className="h-8 w-8 sm:h-12 sm:w-12 text-primary-foreground ml-1" />
                  </div>
                  <p className="text-foreground font-semibold font-body text-[length:var(--text-base)]">Video Coming Soon</p>
                  <p className="text-muted-foreground font-body text-[length:var(--text-sm)] mt-2">Complete walkthrough of the Dropr platform</p>
                </div>
              </div>
              {/* This is where the actual video embed would go */}
              {/* <iframe 
                src="https://www.youtube.com/embed/VIDEO_ID" 
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe> */}
            </div>
          </div>
        </div>
      </Section>



      {/* Use Cases */}
      <Section id="use-cases" className="py-20 bg-background">
        <div className="reveal">
          <SectionTitle 
             title="Built for Web3"
             subtitle="Launch NFT drops, grow and reward communities, build genuine engagement"
           />
        </div>

        <div className="card-grid grid grid-cols-1 lg:grid-cols-3 gap-8 mt-16">
          <div className="card-item bg-card rounded-2xl p-8 hover:shadow-xl transition-all duration-300 border border-border">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
              <Sparkles className="h-8 w-8 text-primary" />
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

          <div className="card-item bg-card rounded-2xl p-8 hover:shadow-xl transition-all duration-300 border border-border">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-display text-[length:var(--text-2xl)] font-bold mb-4 text-foreground whitespace-nowrap leading-snug">KOLs & Influencers</h3>
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

          <div className="card-item bg-card rounded-2xl p-8 hover:shadow-xl transition-all duration-300 border border-border">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
              <Globe className="h-8 w-8 text-primary" />
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
      <Section id="faq" className="py-20 bg-background">
        <div className="reveal">
          <SectionTitle 
            title="Frequently Asked Questions"
          />
        </div>
        
        <div className="reveal max-w-4xl mx-auto mt-12">
          <Accordion.Root type="single" collapsible className="space-y-4">
            {faqItems.map((item, idx) => (
              <Accordion.Item 
                key={idx} 
                value={`item-${idx}`} 
                className="rounded-2xl border border-border bg-card overflow-hidden"
              >
                <Accordion.Header>
                  <Accordion.Trigger className="w-full p-4 sm:p-6 flex items-center justify-between text-left font-semibold hover:bg-primary/5 transition-colors group">
                    <span className="pr-4 text-base sm:text-lg text-foreground group-hover:text-primary leading-relaxed">{item.q}</span>
                    <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-200 data-[state=open]:rotate-180 text-primary" />
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="px-4 sm:px-6 pb-4 sm:pb-6 pt-2 border-t border-border overflow-hidden data-[state=open]:animate-slideDown data-[state=closed]:animate-slideUp">
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

      {/* Final CTA */}
      <Section id="final-cta" className="py-16 sm:py-20 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
        <div className="reveal text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6">
            Ready to Build Trust with Your Community?
          </h2>
          <p className="text-lg sm:text-xl md:text-2xl mb-6 sm:mb-8 opacity-90 max-w-3xl mx-auto">
            Deploy Your First Raffle - No Code Required
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              to="/app"
              target="_blank"
              rel="noopener noreferrer"
              className="pulse-btn inline-flex items-center justify-center px-8 sm:px-10 py-4 sm:py-5 rounded-full bg-background text-foreground hover:bg-card transition-all duration-300 shadow-lg hover:shadow-xl font-bold text-lg sm:text-xl"
            >
              Launch Your Raffle Now
            </Link>
            <a
              href="https://rafflhub.gitbook.io/rafflhub"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-8 sm:px-10 py-4 sm:py-5 rounded-full border-2 border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary transition-all duration-300 font-bold text-lg sm:text-xl"
            >
              <BookOpen className="mr-3 h-5 w-5 sm:h-6 sm:w-6" />
              Read Documentation
            </a>
          </div>
          
          <div className="mt-8 flex flex-wrap justify-center items-center gap-6 text-sm opacity-75">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              <span>Permissionless</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span>Secure</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              <span>Deploy in minutes</span>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}

