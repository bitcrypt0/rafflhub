import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  BookOpen, 
  Code, 
  Zap, 
  Shield, 
  Users, 
  ChevronRight,
  Search,
  FileText,
  Terminal,
  Globe,
  Lock,
  Trophy,
  Cpu,
  ArrowRight,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { cn } from '../lib/utils';

const DocumentationPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedCode, setCopiedCode] = useState(null);

  // Documentation sections
  const sections = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      description: 'Learn the basics of Dropr and start creating fair distribution events',
      icon: Zap,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      articles: [
        {
          title: 'What is Dropr?',
          description: 'Understanding provably fair asset distribution',
          difficulty: 'Beginner',
          readTime: '5 min'
        },
        {
          title: 'Creating Your First Raffle',
          description: 'Launch your first provably fair raffle',
          difficulty: 'Beginner',
          readTime: '10 min'
        }
      ]
    },
    {
      id: 'guides',
      title: 'Guides',
      description: 'In-depth guides for advanced features',
      icon: BookOpen,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      articles: [
        {
          title: 'NFT Collection Raffles',
          description: 'How to create raffles for NFT collections',
          difficulty: 'Intermediate',
          readTime: '15 min'
        },
        {
          title: 'Token Gating',
          description: 'Restrict participation to token holders',
          difficulty: 'Intermediate',
          readTime: '8 min'
        },
        {
          title: 'Social Media Tasks',
          description: 'Integrate Twitter, Discord, and Telegram verification',
          difficulty: 'Advanced',
          readTime: '12 min'
        }
      ]
    },
    {
      id: 'developers',
      title: 'Developers',
      description: 'Technical documentation and API references',
      icon: Code,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      articles: [
        {
          title: 'Smart Contract Architecture',
          description: 'Understanding the Dropr protocol contracts',
          difficulty: 'Advanced',
          readTime: '20 min'
        }
      ]
    },
    {
      id: 'security',
      title: 'Security',
      description: 'Security best practices and audit reports',
      icon: Shield,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      articles: [
        {
          title: 'Security Overview',
          description: 'How Dropr ensures fair and secure distributions',
          difficulty: 'Intermediate',
          readTime: '10 min'
        },
        {
          title: 'Audit Reports',
          description: 'View our security audit results',
          difficulty: 'Intermediate',
          readTime: '5 min'
        },
        {
          title: 'Best Practices',
          description: 'Security guidelines for creators',
          difficulty: 'Beginner',
          readTime: '8 min'
        }
      ]
    }
  ];

  // Code examples
  const codeExamples = [
    {
      title: 'Create a Simple Raffle',
      language: 'javascript',
      code: `const { ethers } = require('ethers');

// Connect to Droper protocol
const provider = new ethers.providers.JsonRpcProvider('https://rpc.mainnet.ethereum.org');
const droprContract = new ethers.Contract(DROPR_ADDRESS, DROPR_ABI, provider);

// Create raffle parameters
const raffleParams = {
  prizeToken: '0x...',
  prizeAmount: ethers.utils.parseEther('1'),
  ticketPrice: ethers.utils.parseEther('0.1'),
  maxTickets: 100,
  duration: 7 * 24 * 60 * 60 // 7 days
};

// Create the raffle
const tx = await droprContract.createRaffle(raffleParams);
await tx.wait();`
    },
    {
      title: 'Check Winner Selection',
      language: 'javascript',
      code: `// Get winner selection transaction
const winnerSelectionTx = await droprContract.getWinnerSelectionTx(raffleAddress);

// Verify Chainlink VRF proof
const vrfProof = await droprContract.getVRFProof(winnerSelectionTx);
const isValid = await droprContract.verifyVRFProof(vrfProof);

if (isValid) {
  console.log('Winner selection is provably fair!');
}`
    }
  ];

  // Filter sections based on search
  const filteredSections = sections.map(section => ({
    ...section,
    articles: section.articles.filter(article =>
      article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.description.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(section => section.articles.length > 0);

  // Copy code to clipboard
  const copyToClipboard = async (code, index) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(index);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 to-background py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-4xl mx-auto"
          >
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
              Documentation
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-foreground to-primary/60 bg-clip-text text-transparent">
              Everything You Need to Know
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Comprehensive guides, API documentation, and examples to help you build provably fair raffles on Dropr.
            </p>
            
            {/* Search Bar */}
            <div className="relative max-w-2xl mx-auto">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search documentation..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 pr-4 h-14 text-base bg-background/50 backdrop-blur-sm border-border/50"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Quick Links */}
      <section className="py-12 border-b border-border">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Zap, label: 'Quick Start', href: '#getting-started' },
              { icon: Code, label: 'API Docs', href: '#developers' },
              { icon: Shield, label: 'Security', href: '#security' },
              { icon: Users, label: 'Community', href: 'https://discord.gg/dropr' }
            ].map((item, index) => (
              <a
                key={index}
                href={item.href}
                className="flex items-center gap-3 p-4 rounded-lg bg-card hover:bg-card/80 transition-colors group"
              >
                <item.icon className="h-5 w-5 text-primary" />
                <span className="font-medium">{item.label}</span>
                <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground group-hover:text-foreground transition-colors" />
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Documentation Sections */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          {filteredSections.map((section, sectionIndex) => (
            <motion.div
              key={section.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: sectionIndex * 0.1 }}
              className="mb-16"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className={cn("p-3 rounded-lg", section.bgColor)}>
                  <section.icon className={cn("h-6 w-6", section.color)} />
                </div>
                <div>
                  <h2 className="text-3xl font-bold">{section.title}</h2>
                  <p className="text-muted-foreground">{section.description}</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {section.articles.map((article, articleIndex) => (
                  <Card key={articleIndex} className="hover:shadow-lg transition-all duration-300 group cursor-pointer">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg mb-2 group-hover:text-primary transition-colors">
                            {article.title}
                          </CardTitle>
                          <CardDescription className="text-sm">
                            {article.description}
                          </CardDescription>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <Badge variant="secondary" className="text-xs">
                          {article.difficulty}
                        </Badge>
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {article.readTime}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Code Examples */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold mb-4">Code Examples</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Quick code snippets to help you get started with Dropr integration
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-8">
            {codeExamples.map((example, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Terminal className="h-5 w-5 text-primary" />
                      {example.title}
                    </CardTitle>
                    <Badge variant="outline">{example.language}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <pre className="bg-background border border-border rounded-lg p-4 overflow-x-auto text-sm">
                      <code>{example.code}</code>
                    </pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(example.code, index)}
                    >
                      {copiedCode === index ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
              Need Help?
            </Badge>
            <h2 className="text-3xl font-bold mb-4">Join Our Community</h2>
            <p className="text-muted-foreground mb-8">
              Get help from our team and connect with other developers building on Dropr.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="gap-2">
                <Users className="h-4 w-4" />
                Join Discord
              </Button>
              <Button variant="outline" size="lg" className="gap-2">
                <ExternalLink className="h-4 w-4" />
                View GitHub
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default DocumentationPage;
