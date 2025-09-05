import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Shuffle, Layers, Users, LockKeyhole, Sparkles, BookOpen, Info, GitBranch, Coins } from 'lucide-react';

const Section = ({ id, className = '', containerClassName = '', children }) => (
  <section id={id} className={`w-full ${className}`}>
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${containerClassName}`}>{children}</div>
  </section>
);

const SectionTitle = ({ eyebrow, title, subtitle }) => (
  <div className="text-center mb-10 sm:mb-14">
    {eyebrow && (
      <div className="text-sm tracking-wide uppercase text-muted-foreground mb-2">{eyebrow}</div>
    )}
    <h2 className="text-3xl sm:text-4xl font-bold mb-3">{title}</h2>
    {subtitle && <p className="text-base sm:text-lg text-muted-foreground">{subtitle}</p>}
  </div>
);



export default function Homepage() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      document.querySelectorAll('.reveal').forEach(el => el.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { root: null, rootMargin: '0px 0px -10% 0px', threshold: 0.1 });

    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);




  return (
    <div className="bg-background text-foreground">
      {/* Hero */}
      <Section id="hero" className="py-12 sm:py-16" containerClassName="max-w-[1400px]">
        <div className="rounded-2xl bg-card/80 border border-border p-6 sm:p-10 relative overflow-hidden">
          <div className="flex flex-col lg:flex-row items-center lg:items-start gap-8 lg:gap-12">
          {/* Decorative, theme-aware orbs */}
          <div className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-8 -left-8 w-48 h-48 rounded-full bg-muted/40 blur-2xl" />

            <div className="flex-1 text-center lg:text-left">
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-4">
                The Future of Decentralized Digital Asset Distribution
              </h1>
              <p className="reveal text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                Rafflhub is a permissionless raffling protocol that empowers creators and protects participants through
                cryptographic security and intelligent economics. With the implementation of Chainlink VRF 2.5, NFTs and
                digital currencies can be fairly distributed within Web3 communities.
              </p>

              <div className="reveal reveal-delay-1 mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start">
                <a
                  href="/app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-[#614E41] text-white hover:bg-[#4a3a30] transition-colors shadow-sm"
                >
                  <span className="font-semibold">Enter App</span>
                </a>

                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center px-5 py-3 rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
                >
                  <Info className="mr-2 h-4 w-4 opacity-80" />
                  How it works
                </a>

                <a
                  href="https://medium.com/@rafflhub/announcing-rafflhub-revolutionizing-web3-engagement-with-provably-fair-raffles-c5195d8f26fe"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center px-5 py-3 rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
                >
                  <BookOpen className="mr-2 h-4 w-4 opacity-80" />
                  Read announcement
                </a>
              </div>


            </div>
            <div className="flex-1 w-full">
              <div className="w-full rounded-xl overflow-hidden border border-border bg-transparent">
                <img
                  src="/images/Raffle Lifecycle.png"
                  alt="Raffle Lifecycle"
                  className="w-full max-h-[520px] sm:max-h-[640px] object-contain block"
                  loading="eager"
                  decoding="async"
                />
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Built for Web3 Community (moved up) */}
      <Section id="audience" className="py-12 sm:py-16">
        <SectionTitle title="Built for the Web3 Community" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 reveal">
          <div className="rounded-xl border border-border p-6 bg-card hover-lift">
            <div className="text-lg font-semibold mb-2">For Creators</div>
            <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
              <li>Flexible launch options and pricing models</li>
              <li>Optional token-gated access for community rewards</li>
              <li>Transparent and fair revenue model</li>
            </ul>
          </div>
          <div className="rounded-xl border border-border p-6 bg-card hover-lift">
            <div className="text-lg font-semibold mb-2">For Participants</div>
            <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
              <li>Provably fair selection with on-chain transparency</li>
              <li>Guaranteed prize delivery via smart contracts</li>
              <li>Access premium assets at flexible entry points</li>
            </ul>
          </div>
        </div>
      </Section>




      {/* How it works / Prize Models */}
      <Section id="how-it-works" className="py-12 sm:py-16">
        <SectionTitle title="How it works" />
        {/* Top row: Lifecycle + Economics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 reveal">
          <div className="rounded-xl border border-border p-6 bg-card hover-lift">
            <div className="flex items-center gap-2 mb-2">
              <GitBranch className="h-5 w-5 text-[#614E41]" />
              <div className="text-lg font-semibold">Raffle Lifecycle</div>
            </div>
            <p className="text-sm text-muted-foreground">
              Pending → Active → Ended → Drawing → Completed → AllPrizesClaimed.
            </p>
            <p className="text-sm text-muted-foreground">
              Edge cases: ActivationFailed, Deleted, Unengaged.
            </p>
          </div>
          <div className="rounded-xl border border-border p-6 bg-card hover-lift">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="h-5 w-5 text-[#614E41]" />
              <div className="text-lg font-semibold">Revenue and Refunds</div>
            </div>
            <p className="text-sm text-muted-foreground">
              Ticket fees remain refundable until raffle viability is confirmed. Unengaged and Deleted raffles trigger ticket fee refunds. Fair and transparent revenue handling for creators.
            </p>
          </div>
        </div>

        {/* Bottom row: Prize models */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 reveal">
          <div className="rounded-xl border border-border p-6 bg-card hover-lift">
            <div className="flex items-center gap-2 mb-2">
              <LockKeyhole className="h-5 w-5 text-[#614E41]" />
              <div className="text-lg font-semibold">Escrowed Prizes</div>
            </div>
            <p className="text-sm text-muted-foreground">
              Lock high-value assets (NFTs, ETH, ERC-20) in secure raffle contracts. Prize availability is verifiable.
            </p>
          </div>
          <div className="rounded-xl border border-border p-6 bg-card hover-lift">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-[#614E41]" />
              <div className="text-lg font-semibold">Mintable Prizes</div>
            </div>
            <p className="text-sm text-muted-foreground">
              Winners mint NFT prizes on demand — no gas wars, no bots. Ideal for new launches and all collection types.
            </p>
          </div>
          <div className="rounded-xl border border-border p-6 bg-card hover-lift">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-5 w-5 text-[#614E41]" />
              <div className="text-lg font-semibold">External Prizes</div>
            </div>
            <p className="text-sm text-muted-foreground">
              Integrate with existing collections and enable cross-project collaborations and utility.
            </p>
          </div>
        </div>
      </Section>

      {/* Fairness & Security (moved below How it works) */}
      <Section id="fairness" className="py-12 sm:py-16">
        <SectionTitle title="Why it’s fair and secure" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 reveal">
          <div className="rounded-xl border border-border p-6 bg-card hover-lift">
            <div className="flex items-center gap-2 mb-2">
              <Shuffle className="h-5 w-5 text-[#614E41]" />
              <div className="text-lg font-semibold">Chainlink VRF 2.5</div>
            </div>
            <p className="text-sm text-muted-foreground">Verifiable, tamper-proof randomness for winner selection.</p>
          </div>
          <div className="rounded-xl border border-border p-6 bg-card hover-lift">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="h-5 w-5 text-[#614E41]" />
              <div className="text-lg font-semibold">OpenZeppelin Security</div>
            </div>
            <p className="text-sm text-muted-foreground">Audited libraries, reentrancy guards, and robust access control.</p>
          </div>
          <div className="rounded-xl border border-border p-6 bg-card hover-lift">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="h-5 w-5 text-[#614E41]" />
              <div className="text-lg font-semibold">Upgradeable & Scalable</div>
            </div>
            <p className="text-sm text-muted-foreground">Efficient batch processing and upgradeable architecture.</p>
          </div>
        </div>
      </Section>








      {/* Use cases */}
      <Section id="use-cases" className="py-12 sm:py-16">
        <SectionTitle title="Use cases" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 reveal">
          <div className="rounded-xl border border-border p-6 bg-card hover-lift">
            <div className="text-lg font-semibold mb-2">NFT Launches Reimagined</div>
            <p className="text-sm text-muted-foreground">Eliminate unfair whitelist allocations, gas wars, and botted mints. Raffle winners mint on demand.</p>
          </div>
          <div className="rounded-xl border border-border p-6 bg-card hover-lift">
            <div className="text-lg font-semibold mb-2">Advanced Community Engagement</div>
            <p className="text-sm text-muted-foreground">Create token-gated raffles for holder-only rewards and cross-community campaigns.</p>
          </div>
          <div className="rounded-xl border border-border p-6 bg-card hover-lift">
            <div className="text-lg font-semibold mb-2">Gamified Asset Sales</div>
            <p className="text-sm text-muted-foreground">Turn static traditional marketplace listings and giveaways into dynamic community events.</p>
          </div>
        </div>
      </Section>


    </div>
  );
}

