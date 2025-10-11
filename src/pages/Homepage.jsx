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
  Eye
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as Accordion from '@radix-ui/react-accordion';

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

const Section = ({ id, className = '', containerClassName = '', children }) => (
  <section id={id} className={`w-full ${className}`}>
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${containerClassName}`}>{children}</div>
  </section>
);

const SectionTitle = ({ eyebrow, title, subtitle, className = '' }) => (
  <div className={`text-center mb-10 sm:mb-14 ${className}`}>
    {eyebrow && (
      <div className="text-sm tracking-wide uppercase text-primary mb-2 font-semibold">{eyebrow}</div>
    )}
    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-3 text-foreground">{title}</h2>
    {subtitle && <p className="text-base sm:text-lg text-muted-foreground max-w-3xl mx-auto">{subtitle}</p>}
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
    <div className="bg-background text-foreground overflow-x-hidden">
      {/* Hero Section */}
      <Section id="hero" className="min-h-[100vh] flex items-center justify-center relative bg-gradient-to-br from-background via-card to-muted">
        <GeometricBackground />
        <div className="relative z-10 w-full py-20">
          <div className="text-center max-w-6xl mx-auto">
            <h1 className="hero-headline text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 text-foreground leading-tight">
              Explore New Strategies for{' '}
              <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                NFT Drops
              </span>{' '}
              and{' '}
              <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Community Rewards
              </span>
            </h1>
            <p className="hero-subtext text-xl sm:text-2xl text-muted-foreground mb-8 max-w-4xl mx-auto leading-relaxed">
              Transparent whitelist allocations • Inter-community collaboration • Disincentivize mint bots • Earn community trust
            </p>
            
            <div className="hero-cta flex flex-col items-center gap-6 mb-12">
              <Link
                to="/app"
                className="pulse-btn inline-flex items-center justify-center px-8 py-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 shadow-lg hover:shadow-xl font-semibold text-lg"
              >
                Launch Your Raffle
              </Link>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <button
                  onClick={() => document.getElementById('video-demo').scrollIntoView({ behavior: 'smooth' })}
                  className="hero-cta inline-flex items-center justify-center px-8 py-4 rounded-xl border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300 font-semibold text-lg"
                >
                  <Play className="mr-2 h-5 w-5" />
                  Watch Demo
                </button>
                <a
                  href="https://docs.rafflhub.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hero-cta inline-flex items-center justify-center px-8 py-4 rounded-xl border border-muted-foreground text-muted-foreground hover:border-primary hover:text-primary transition-all duration-300 font-semibold"
                >
                  <BookOpen className="mr-2 h-5 w-5" />
                  Read Documentation
                </a>
              </div>
            </div>

            {/* Trust signals */}
            <div className="hero-cta flex flex-wrap justify-center items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span>Chainlink VRF Powered</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span>Fairness Guaranteed</span>
              </div>
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" />
                <span>Fully Transparent</span>
              </div>
              <div className="flex items-center gap-2">
                <LockKeyhole className="h-4 w-4 text-primary" />
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
            title="The End of Opaque Whitelists Allocations, Botted Mints, and Rigged Giveaways"
            subtitle="Traditional Web3 distribution methods are broken. Rafflhub fixes them with innovative raffle-based technology."
          />
        </div>
        
        <div className="card-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-16">
          <div className="card-item bg-background rounded-2xl p-8 text-center hover:shadow-xl transition-all duration-300 border border-border">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-foreground">No More Insider Favoritism</h3>
            <p className="text-muted-foreground">Cryptographically secure randomness ensures every participant has an equal chance</p>
          </div>
          
          <div className="card-item bg-background rounded-2xl p-8 text-center hover:shadow-xl transition-all duration-300 border border-border">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Cpu className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-foreground">Discourage Bot Attacks</h3>
            <p className="text-muted-foreground">The Winner selection algorithm largely disincentivizes bot manipulation during NFT Drops</p>
          </div>
          
          <div className="card-item bg-background rounded-2xl p-8 text-center hover:shadow-xl transition-all duration-300 border border-border">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-foreground">Build Community Trust</h3>
            <p className="text-muted-foreground">Transparent, verifiable processes that communities can audit and trust</p>
          </div>
          
          <div className="card-item bg-background rounded-2xl p-8 text-center hover:shadow-xl transition-all duration-300 border border-border">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Zap className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-foreground">Automated Prize Distribution</h3>
            <p className="text-muted-foreground">Smart contracts handle prize distribution without need for manual intervention</p>
          </div>
        </div>
      </Section>

      {/* How It Works */}
      <Section id="how-it-works" className="py-20 bg-card">
        <div className="reveal">
          <SectionTitle 
            title="How It Works"
            subtitle="Three simple steps to create provably fair raffles that your community will trust"
          />
        </div>

        <div className="card-grid mt-16">
          <div className="relative">
            {/* Timeline line */}
            <div className="hidden lg:block absolute top-24 left-0 right-0 h-0.5 bg-primary/20"></div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
              <div className="card-item relative">
                <div className="bg-background rounded-2xl p-8 text-center hover:shadow-xl transition-all duration-300 border border-border">
                  <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto mb-6 relative z-10">
                    <span className="text-2xl font-bold text-primary-foreground">1</span>
                  </div>
                  <h3 className="text-2xl font-bold mb-4 text-foreground">Create Raffle</h3>
                  <p className="text-muted-foreground mb-4">Set raffle parameters - participation limits, start time, duration, number of winners, and prizes.</p>
                  <div className="flex items-center justify-center gap-2 text-sm text-primary">
                    <Target className="h-4 w-4" />
                    <span>Flexible Configuration</span>
                  </div>
                </div>
              </div>

              <div className="card-item relative">
                <div className="bg-background rounded-2xl p-8 text-center hover:shadow-xl transition-all duration-300 border border-border">
                  <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto mb-6 relative z-10">
                    <span className="text-2xl font-bold text-primary-foreground">2</span>
                  </div>
                  <h3 className="text-2xl font-bold mb-4 text-foreground">Chainlink VRF</h3>
                  <p className="text-muted-foreground mb-4">Verifiable randomness ensures fair winner selection. Every draw is cryptographically secure and auditable.</p>
                  <div className="flex items-center justify-center gap-2 text-sm text-primary">
                    <Shuffle className="h-4 w-4" />
                    <span>Provably Fair</span>
                  </div>
                </div>
              </div>

              <div className="card-item relative">
                <div className="bg-background rounded-2xl p-8 text-center hover:shadow-xl transition-all duration-300 border border-border">
                  <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto mb-6 relative z-10">
                    <span className="text-2xl font-bold text-primary-foreground">3</span>
                  </div>
                  <h3 className="text-2xl font-bold mb-4 text-foreground">Automatic Distribution</h3>
                  <p className="text-muted-foreground mb-4">Winners claim prizes directly from smart contracts. No manual intervention or trust required.</p>
                  <div className="flex items-center justify-center gap-2 text-sm text-primary">
                    <Award className="h-4 w-4" />
                    <span>Instant Claims</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Video Explainer Section */}
      <Section id="video-demo" className="py-20 bg-background">
        <div className="reveal">
          <SectionTitle 
            title="Watch Rafflhub in Action"
          />
        </div>
        
        <div className="reveal mt-12">
          <div className="max-w-4xl mx-auto">
            <div className="relative aspect-video rounded-2xl overflow-hidden shadow-2xl bg-primary/5 border border-border">
              {/* Placeholder for video embed */}
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                <div className="text-center">
                  <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 hover:scale-110 transition-transform cursor-pointer">
                    <Play className="h-12 w-12 text-primary-foreground ml-1" />
                  </div>
                  <p className="text-foreground font-semibold">Video Coming Soon</p>
                  <p className="text-muted-foreground text-sm mt-2">Complete walkthrough of the Rafflhub platform</p>
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
             title="Built for Web3 Communities"
             subtitle="Whether you're launching NFTs, rewarding holders, or building engagement"
           />
        </div>

        <div className="card-grid grid grid-cols-1 lg:grid-cols-3 gap-8 mt-16">
          <div className="card-item bg-card rounded-2xl p-8 hover:shadow-xl transition-all duration-300 border border-border">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-2xl font-bold mb-4 text-foreground">For Projects</h3>
            <p className="text-muted-foreground mb-6">Fair whitelist distribution for new mints. Eliminate gas wars and ensure equal opportunity for all community members.</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span>Supports ERC721 & ERC1155 standards</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span>Flexible launch strategies</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span>Inter-community collabs simplified</span>
              </li>
            </ul>
          </div>

          <div className="card-item bg-card rounded-2xl p-8 hover:shadow-xl transition-all duration-300 border border-border">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-2xl font-bold mb-4 text-foreground">For Influencers/KOLs</h3>
            <p className="text-muted-foreground mb-6">Trusted giveaways that protect your reputation. Build authentic engagement with provably fair mechanics.</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
               <li className="flex items-center gap-2">
                 <CheckCircle className="h-4 w-4 text-primary" />
                 <span>Build reputation and trust</span>
               </li>
               <li className="flex items-center gap-2">
                 <CheckCircle className="h-4 w-4 text-primary" />
                 <span>Flexible prize options for community rewards</span>
               </li>
               <li className="flex items-center gap-2">
                 <CheckCircle className="h-4 w-4 text-primary" />
                 <span>Project collabs made easy</span>
               </li>
             </ul>
          </div>

          <div className="card-item bg-card rounded-2xl p-8 hover:shadow-xl transition-all duration-300 border border-border">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
              <Globe className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-2xl font-bold mb-4 text-foreground">For Creators</h3>
            <p className="text-muted-foreground mb-6">Transparent distribution of rewards to holders of CCM tokens by creators.</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
               <li className="flex items-center gap-2">
                 <CheckCircle className="h-4 w-4 text-primary" />
                 <span>Token-gated raffles for holder rewards</span>
               </li>
               <li className="flex items-center gap-2">
                 <CheckCircle className="h-4 w-4 text-primary" />
                 <span>Flexible prize options for holder rewards</span>
               </li>
               <li className="flex items-center gap-2">
                 <CheckCircle className="h-4 w-4 text-primary" />
                 <span>Easy collabs with projects and other creators</span>
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
                  <Accordion.Trigger className="w-full p-6 flex items-center justify-between text-left font-semibold hover:bg-primary/5 transition-colors group">
                    <span className="pr-4 text-foreground group-hover:text-primary">{item.q}</span>
                    <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-200 data-[state=open]:rotate-180 text-primary" />
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="px-6 pb-6 pt-2 border-t border-border overflow-hidden data-[state=open]:animate-slideDown data-[state=closed]:animate-slideUp">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: (props) => <p className="text-muted-foreground mb-3 leading-relaxed" {...props} />,
                      li: (props) => <li className="list-disc ml-5 text-muted-foreground mb-1" {...props} />,
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
      <Section id="final-cta" className="py-20 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
        <div className="reveal text-center">
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
            Ready to Build Community Trust?
          </h2>
          <p className="text-xl sm:text-2xl mb-8 opacity-90 max-w-3xl mx-auto">
            Deploy Your First Raffle - No Code Required
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              to="/app"
              className="pulse-btn inline-flex items-center justify-center px-10 py-5 rounded-xl bg-background text-foreground hover:bg-card transition-all duration-300 shadow-lg hover:shadow-xl font-bold text-xl"
            >
              Launch Your Raffle Now
            </Link>
            <a
              href="https://rafflhub.gitbook.io/rafflhub"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-10 py-5 rounded-xl border-2 border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary transition-all duration-300 font-bold text-xl"
            >
              <BookOpen className="mr-3 h-6 w-6" />
              View Documentation
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

