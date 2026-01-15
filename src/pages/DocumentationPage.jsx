import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, 
  Code, 
  Zap, 
  Shield, 
  ChevronDown,
  ChevronRight,
  Search,
  Terminal,
  Globe,
  Lock,
  Trophy,
  Cpu,
  ExternalLink,
  Copy,
  Check,
  Menu,
  X,
  ChevronLeft,
  ArrowRight
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import { cn } from '../lib/utils';
import { docsContent, findContent } from '../data/docsContent';

// Icon mapping
const iconMap = {
  Zap,
  BookOpen,
  Code,
  Shield,
  Trophy,
  Cpu
};

const DocumentationPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSections, setExpandedSections] = useState(['executive-summary']);
  const [activeSection, setActiveSection] = useState('executive-summary');
  const [activeSubsection, setActiveSubsection] = useState('overview');
  const [copiedCode, setCopiedCode] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Copy to clipboard function
  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCode(index);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  };

  // Filter sections based on search
  const filteredSections = docsContent.sections.map(section => ({
    ...section,
    subsections: section.subsections.filter(subsection =>
      subsection.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subsection.content.some(item => 
        item.type === 'text' && 
        item.content.toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
  })).filter(section => section.subsections.length > 0 || searchTerm === '');

  // Toggle section expansion
  const toggleSection = (sectionId) => {
    setExpandedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  // Handle subsection click
  const handleSubsectionClick = (sectionId, subsectionId) => {
    setActiveSection(sectionId);
    setActiveSubsection(subsectionId);
    setSidebarOpen(false); // Close sidebar on mobile after selection
  };

  // Get current content
  const currentContent = findContent(activeSection, activeSubsection);

  // Get all subsections in order for navigation
  const getAllSubsections = () => {
    const allSubsections = [];
    docsContent.sections.forEach(section => {
      section.subsections.forEach(subsection => {
        allSubsections.push({
          sectionId: section.id,
          subsectionId: subsection.id,
          sectionTitle: section.title,
          subsectionTitle: subsection.title
        });
      });
    });
    return allSubsections;
  };

  // Get current index and navigation info
  const getCurrentNavigationInfo = () => {
    const allSubsections = getAllSubsections();
    const currentIndex = allSubsections.findIndex(
      item => item.sectionId === activeSection && item.subsectionId === activeSubsection
    );
    
    return {
      currentIndex,
      total: allSubsections.length,
      previous: currentIndex > 0 ? allSubsections[currentIndex - 1] : null,
      next: currentIndex < allSubsections.length - 1 ? allSubsections[currentIndex + 1] : null
    };
  };

  // Navigate to previous/next subsection
  const navigateTo = (direction) => {
    const navInfo = getCurrentNavigationInfo();
    const target = direction === 'prev' ? navInfo.previous : navInfo.next;
    
    if (target) {
      setActiveSection(target.sectionId);
      setActiveSubsection(target.subsectionId);
      // Ensure the section is expanded
      if (!expandedSections.includes(target.sectionId)) {
        setExpandedSections(prev => [...prev, target.sectionId]);
      }
      // Scroll to top of content
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Content renderer component
  const ContentRenderer = ({ content }) => {
    return (
      <div className="space-y-5">
        {content.map((item, index) => {
          switch (item.type) {
            case 'text':
              return (
                <p key={index} className="text-foreground leading-relaxed text-[length:var(--text-base)] mb-4">
                  {item.content}
                </p>
              );
            
            case 'heading':
              const HeadingTag = `h${item.level || 2}`;
              return (
                <HeadingTag 
                  key={index} 
                  className={cn(
                    "font-bold text-foreground",
                    item.level === 2 && "text-2xl mt-8 mb-4",
                    item.level === 3 && "text-xl mt-6 mb-3",
                    item.level === 4 && "text-lg mt-4 mb-2"
                  )}
                >
                  {item.content}
                </HeadingTag>
              );
            
            case 'list':
              return (
                <ul key={index} className="space-y-2 ml-6 mb-4">
                  {item.items.map((listItem, i) => (
                    <li key={i} className="text-foreground leading-relaxed text-[length:var(--text-base)] flex items-start">
                      <span className="text-primary mr-3 mt-1.5 flex-shrink-0">•</span>
                      <span>{listItem}</span>
                    </li>
                  ))}
                </ul>
              );
            
            case 'ordered-list':
              return (
                <ol key={index} className="space-y-3 ml-6 mb-4">
                  {item.items.map((listItem, i) => (
                    <li key={i} className="text-foreground leading-relaxed text-[length:var(--text-base)] flex items-start">
                      <span className="text-primary font-semibold mr-3 flex-shrink-0 min-w-[1.5rem]">{i + 1}.</span>
                      <span>{listItem}</span>
                    </li>
                  ))}
                </ol>
              );
            
            case 'image':
              return (
                <div key={index} className="my-8">
                  <img 
                    src={item.src} 
                    alt={item.alt}
                    className="rounded-lg border border-border w-full max-w-3xl"
                  />
                  {item.caption && (
                    <p className="text-sm text-muted-foreground mt-2 text-center italic">
                      {item.caption}
                    </p>
                  )}
                </div>
              );
            
            case 'code':
              return (
                <div key={index} className="relative my-6">
                  <pre className="bg-muted/50 border border-border rounded-lg p-4 overflow-x-auto text-sm">
                    <code className={item.language && `language-${item.language}`}>
                      {item.code}
                    </code>
                  </pre>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 hover:bg-background/80"
                    onClick={() => copyToClipboard(item.code, index)}
                  >
                    {copiedCode === index ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              );
            
            default:
              return null;
          }
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section - Redesigned for better flow */}
      <section className="relative bg-gradient-to-b from-primary/5 via-background/50 to-background">
        <div className="container mx-auto px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-3xl mx-auto"
          >
            <Badge className="mb-3 bg-primary/10 text-primary border-primary/20">
              Documentation
            </Badge>
            <h1 className="text-3xl md:text-4xl font-bold mb-3 leading-tight bg-gradient-to-r from-foreground to-primary/60 bg-clip-text text-transparent" style={{ lineHeight: '1.2' }}>
              Dropr Documentation
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              Comprehensive guides to help you build provably fair distributions
            </p>
          </motion.div>
        </div>
      </section>

      {/* Documentation Content - Starts immediately after hero */}
      <section className="py-0">
        <div className="container mx-auto px-4">
          <div className="flex gap-8 lg:gap-12">
            {/* Mobile Menu Toggle - Better positioned */}
            <div className="lg:hidden w-full mb-4">
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                {sidebarOpen ? 'Hide Navigation' : 'Show Navigation'}
              </Button>
            </div>

            {/* Sidebar Navigation - Fixed positioning */}
            <AnimatePresence>
              {(sidebarOpen || window.innerWidth >= 1024) && (
                <motion.aside
                  initial={{ x: -300, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -300, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className={cn(
                    "w-80 lg:w-96 flex-shrink-0",
                    "lg:block lg:relative lg:top-0",
                    "fixed left-4 right-4 top-20 bottom-4 z-40 lg:top-0 lg:bottom-auto",
                    sidebarOpen ? "block" : "hidden lg:block"
                  )}
                >
                  <Card className="h-full lg:h-[calc(100vh-10rem)] flex flex-col">
                    <CardHeader className="pb-3 flex-shrink-0">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search docs..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 overflow-hidden">
                      <ScrollArea className="h-full">
                        <nav className="p-3 space-y-1 pb-6">
                          {filteredSections.map((section) => (
                            <div key={section.id}>
                              {/* Section Header */}
                              <Button
                                variant="ghost"
                                className="w-full justify-between p-2 h-auto font-semibold text-sm text-left"
                                onClick={() => toggleSection(section.id)}
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
                                  {React.createElement(iconMap[section.icon], { className: "h-4 w-4 flex-shrink-0" })}
                                  <span className="whitespace-normal break-words">{section.title}</span>
                                </div>
                                {expandedSections.includes(section.id) ? (
                                  <ChevronDown className="h-4 w-4 flex-shrink-0" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 flex-shrink-0" />
                                )}
                              </Button>
                              
                              {/* Subsections */}
                              {expandedSections.includes(section.id) && (
                                <div className="ml-6 mt-1 space-y-1 mb-2">
                                  {section.subsections.map((subsection) => (
                                    <Button
                                      key={subsection.id}
                                      variant="ghost"
                                      className={cn(
                                        "w-full justify-start p-2 h-auto text-xs text-left whitespace-normal break-words leading-relaxed",
                                        activeSection === section.id && activeSubsection === subsection.id && 
                                        "bg-primary/10 text-primary font-medium"
                                      )}
                                      onClick={() => handleSubsectionClick(section.id, subsection.id)}
                                    >
                                      {subsection.title}
                                    </Button>
                                  ))}
                                </div>
                              )}
                              
                              <Separator className="my-2" />
                            </div>
                          ))}
                        </nav>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </motion.aside>
              )}
            </AnimatePresence>

            {/* Content Area - Better spacing */}
            <div className="flex-1 min-w-0 pl-4 lg:pl-6 pb-12">
              {currentContent ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="max-w-4xl"
                >
                  <div className="mb-6">
                    <h2 className="text-2xl md:text-3xl font-bold mb-2">
                      {currentContent.title}
                    </h2>
                  </div>
                  <div className="prose prose-slate dark:prose-invert max-w-none">
                    <ContentRenderer content={currentContent.content} />
                  </div>

                  {/* Navigation Buttons */}
                  <div className="mt-12 pt-8 border-t border-border">
                    <div className="flex items-center justify-between gap-4">
                      {/* Previous Button */}
                      <div className="flex-1">
                        {getCurrentNavigationInfo().previous && (
                          <Button
                            variant="outline"
                            className="w-full justify-start gap-2 h-auto py-3 px-4 text-left"
                            onClick={() => navigateTo('prev')}
                          >
                            <ChevronLeft className="h-5 w-5 flex-shrink-0" />
                            <div className="flex flex-col items-start min-w-0">
                              <span className="text-xs text-muted-foreground mb-1">Previous</span>
                              <span className="font-medium text-sm truncate w-full">
                                {getCurrentNavigationInfo().previous.subsectionTitle}
                              </span>
                            </div>
                          </Button>
                        )}
                      </div>

                      {/* Next Button */}
                      <div className="flex-1">
                        {getCurrentNavigationInfo().next && (
                          <Button
                            variant="outline"
                            className="w-full justify-end gap-2 h-auto py-3 px-4 text-right"
                            onClick={() => navigateTo('next')}
                          >
                            <div className="flex flex-col items-end min-w-0">
                              <span className="text-xs text-muted-foreground mb-1">Next</span>
                              <span className="font-medium text-sm truncate w-full">
                                {getCurrentNavigationInfo().next.subsectionTitle}
                              </span>
                            </div>
                            <ArrowRight className="h-5 w-5 flex-shrink-0" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Progress Indicator */}
                    <div className="mt-4 text-center">
                      <span className="text-xs text-muted-foreground">
                        {getCurrentNavigationInfo().currentIndex + 1} of {getCurrentNavigationInfo().total}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  <div className="text-center">
                    <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select a section from the sidebar to view documentation</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DocumentationPage;
