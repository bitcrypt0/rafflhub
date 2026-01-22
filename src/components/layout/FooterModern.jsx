import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { 
  Twitter, 
  MessageCircle, 
  Send, 
  Github, 
  Globe, 
  Mail, 
  Phone,
  MapPin,
  Heart,
  Shield,
  Zap,
  Users,
  ArrowRight,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../ui/accordion';
import { cn } from '../../lib/utils';

const FooterModern = () => {
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [expandedSections, setExpandedSections] = useState([]);
  const location = useLocation();

  const currentYear = new Date().getFullYear();
  const isHomepage = location.pathname === '/';

  // Footer sections
  const footerSections = [
    {
      title: 'Product',
      items: [
        { label: 'Explore Raffles', href: '/app', icon: Globe },
        { label: 'Create Raffle', href: '/create-raffle', icon: Zap },
      ]
    },
    {
      title: 'Resources',
      items: [
        { label: 'Documentation', href: '/docs', icon: ArrowRight },
        { label: 'Blog', href: '#', icon: ArrowRight },
        { label: 'Tutorials', href: '#', icon: ArrowRight },
      ]
    },
    {
      title: 'Company',
      items: [
        { label: 'About Us', href: '#', icon: Users },
        { label: 'Careers', href: '#', icon: ArrowRight },
        { label: 'Press Kit', href: '#', icon: ArrowRight },
      ]
    },
    {
      title: 'Legal',
      items: [
        { label: 'Terms of Service', href: '#', icon: Shield },
        { label: 'Privacy Policy', href: '#', icon: Shield },
        { label: 'Cookie Policy', href: '#', icon: Shield },
        { label: 'Compliance', href: '#', icon: Shield },
      ]
    }
  ];

  // Social links
  const socialLinks = [
    { 
      name: 'Twitter', 
      href: 'https://twitter.com/droprdotfun', 
      icon: Twitter, 
      color: 'hover:text-blue-400' 
    },
    { 
      name: 'Discord', 
      href: '#', 
      icon: MessageCircle, 
      color: 'hover:text-indigo-400' 
    },
    { 
      name: 'Telegram', 
      href: '#', 
      icon: Send, 
      color: 'hover:text-blue-500' 
    },
    { 
      name: 'GitHub', 
      href: '#', 
      icon: Github, 
      color: 'hover:text-gray-400' 
    },
    { 
      name: 'Medium', 
      href: 'https://medium.com/@rafflhub', 
      icon: Globe, 
      color: 'hover:text-green-400' 
    }
  ];

  // Handle newsletter subscription
  const handleSubscribe = (e) => {
    e.preventDefault();
    if (email.trim()) {
      setIsSubscribed(true);
      setTimeout(() => {
        setIsSubscribed(false);
        setEmail('');
      }, 3000);
    }
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <footer className="relative bg-background border-t border-border/50 overflow-hidden">
      {/* Newsletter section - Only show on Homepage */}
      {isHomepage && (
      <div className="relative border-b border-border/30 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto text-center"
          >
            <Badge className="mb-4 bg-primary text-primary-foreground border-0">
              Stay Updated
            </Badge>
            <h2 className="text-3xl font-bold mb-4 font-display">
              Get the Latest Updates
            </h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join our community to receive exclusive announcements and platform updates.
            </p>
            
            <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex-1 h-12 bg-background/50 backdrop-blur-sm border-border/50"
              />
              <Button 
                type="submit" 
                className="h-12 px-8 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isSubscribed ? 'Subscribed!' : 'Subscribe'}
              </Button>
            </form>
            
            {isSubscribed && (
              <motion.p
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-4 text-success text-sm"
              >
                ✓ Successfully subscribed to newsletter!
              </motion.p>
            )}
          </motion.div>
        </div>
      </div>
      )}

      {/* Main footer content */}
      <div className="relative">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6"
          >
            {/* Brand section */}
            <motion.div variants={itemVariants} className="lg:col-span-1">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold font-display text-foreground">
                    Dropr
                  </h3>
                  <Badge variant="secondary" className="text-xs">
                    Beta
                  </Badge>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  The go-to platform for project teams and KOLs to host fairly launch NFT drops, host social media campaigns, and transparently distribute rewards to Web3 communities.
                </p>
                
                {/* Social links */}
                <div className="flex items-center gap-3">
                  {socialLinks.map((social) => (
                    <Button
                      key={social.name}
                      variant="ghost"
                      size="icon"
                      asChild={social.href !== '#'}
                      className={cn(
                        "h-9 w-9 rounded-full transition-all duration-200 hover:scale-110",
                        social.color
                      )}
                    >
                      {social.href === '#' ? (
                        <div
                          title={social.name}
                          className="flex items-center justify-center h-full w-full"
                        >
                          <social.icon className="h-4 w-4" />
                        </div>
                      ) : (
                        <a
                          href={social.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={social.name}
                        >
                          <social.icon className="h-4 w-4" />
                        </a>
                      )}
                    </Button>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Footer sections - Desktop */}
            {footerSections.map((section, index) => (
              <motion.div
                key={section.title}
                variants={itemVariants}
                className="hidden lg:block"
              >
                <h4 className="font-semibold mb-4 font-display">{section.title}</h4>
                <ul className="space-y-3">
                  {section.items.map((item) => (
                    <li key={item.label}>
                      {item.href === '#' ? (
                        <div className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors duration-200 group cursor-pointer">
                          <item.icon className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                          <span className="group-hover:translate-x-1 transition-transform duration-200">
                            {item.label}
                          </span>
                        </div>
                      ) : (
                        <Link
                          to={item.href}
                          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors duration-200 group"
                        >
                          <item.icon className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                          <span className="group-hover:translate-x-1 transition-transform duration-200">
                            {item.label}
                          </span>
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}

            {/* Mobile accordion */}
            <motion.div variants={itemVariants} className="lg:hidden col-span-1 md:col-span-2">
              <Accordion type="multiple" value={expandedSections} onValueChange={setExpandedSections}>
                {footerSections.map((section) => (
                  <AccordionItem key={section.title} value={section.title} className="border-b border-border/30">
                    <AccordionTrigger className="text-left font-semibold font-display">
                      {section.title}
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-3 pt-2">
                        {section.items.map((item) => (
                          <li key={item.label}>
                            {item.href === '#' ? (
                              <div className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors duration-200 group cursor-pointer">
                                <item.icon className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                                <span>{item.label}</span>
                              </div>
                            ) : (
                              <Link
                                to={item.href}
                                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors duration-200 group"
                              >
                                <item.icon className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                                <span>{item.label}</span>
                              </Link>
                            )}
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </motion.div>
          </motion.div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border/30">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="flex flex-col md:flex-row items-center justify-between gap-4"
            >
              {/* Copyright */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>© {currentYear} Dropr. All rights reserved.</span>
                <span className="hidden md:inline">•</span>
                <span className="hidden md:inline-flex items-center gap-1">
                  Made with <Heart className="h-3 w-3 text-red-500 fill-current" /> for Web3
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

</footer>
  );
};

export default FooterModern;
