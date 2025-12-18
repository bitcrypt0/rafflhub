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
  X
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
  Shield
};

const DocumentationPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSections, setExpandedSections] = useState(['getting-started']);
  const [activeSection, setActiveSection] = useState('getting-started');
  const [activeSubsection, setActiveSubsection] = useState('what-is-dropr');
  const [copiedCode, setCopiedCode] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  // Content renderer component
  const ContentRenderer = ({ content }) => {
    return (
      <div className="space-y-6">
        {content.map((item, index) => {
          switch (item.type) {
            case 'text':
              return (
                <p key={index} className="text-foreground leading-relaxed">
                  {item.content}
                </p>
              );
            
            case 'heading':
              const HeadingTag = `h${item.level || 2}`;
              return (
                <HeadingTag 
                  key={index} 
                  className={cn(
                    "font-semibold mt-8 mb-4",
                    item.level === 2 && "text-2xl",
                    item.level === 3 && "text-xl",
                    item.level === 4 && "text-lg"
                  )}
                >
                  {item.content}
                </HeadingTag>
              );
            
            case 'list':
              return (
                <ul key={index} className="list-disc list-inside space-y-2 ml-4">
                  {item.items.map((listItem, i) => (
                    <li key={i} className="text-foreground">{listItem}</li>
                  ))}
                </ul>
              );
            
            case 'ordered-list':
              return (
                <ol key={index} className="list-decimal list-inside space-y-2 ml-4">
                  {item.items.map((listItem, i) => (
                    <li key={i} className="text-foreground">{listItem}</li>
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
                <div key={index} className="relative">
                  <pre className="bg-muted border border-border rounded-lg p-4 overflow-x-auto text-sm">
                    <code className={item.language && `language-${item.language}`}>
                      {item.code}
                    </code>
                  </pre>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2"
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
                    "w-72 lg:w-80 flex-shrink-0",
                    "lg:block lg:relative lg:top-0",
                    "fixed left-4 right-4 top-20 bottom-4 z-40 lg:top-0 lg:bottom-auto",
                    sidebarOpen ? "block" : "hidden lg:block"
                  )}
                >
                  <Card className="h-full lg:h-[calc(100vh-8rem)]">
                    <CardHeader className="pb-3">
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
                    <CardContent className="p-0">
                      <ScrollArea className="h-[calc(100%-4rem)] lg:h-[calc(100%-4rem)]">
                        <nav className="p-3 space-y-1">
                          {filteredSections.map((section) => (
                            <div key={section.id}>
                              {/* Section Header */}
                              <Button
                                variant="ghost"
                                className="w-full justify-between p-2 h-auto font-semibold text-sm"
                                onClick={() => toggleSection(section.id)}
                              >
                                <div className="flex items-center gap-2">
                                  {React.createElement(iconMap[section.icon], { className: "h-4 w-4" })}
                                  {section.title}
                                </div>
                                {expandedSections.includes(section.id) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                              
                              {/* Subsections */}
                              {expandedSections.includes(section.id) && (
                                <div className="ml-6 mt-1 space-y-1">
                                  {section.subsections.map((subsection) => (
                                    <Button
                                      key={subsection.id}
                                      variant="ghost"
                                      className={cn(
                                        "w-full justify-start p-2 h-auto text-xs",
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
            <div className="flex-1 min-w-0 pl-4 lg:pl-6">
              {currentContent ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="max-w-4xl"
                >
                  <div className="mb-8">
                    <h2 className="text-2xl md:text-3xl font-bold mb-4">
                      {currentContent.title}
                    </h2>
                  </div>
                  <ContentRenderer content={currentContent.content} />
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
