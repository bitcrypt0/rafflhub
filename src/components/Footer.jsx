import React from 'react';
import {
  Github,
  Twitter,
  Mail
} from 'lucide-react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-background/80 backdrop-blur-md border-t border-[#614E41] mt-auto shrink-0">
      <div className="w-full px-4 sm:px-8 lg:px-12 py-2 sm:py-4">
        <div className="flex flex-col sm:flex-row sm:justify-between justify-center items-center gap-2 sm:gap-4 w-full min-h-[44px] sm:min-h-0 text-center">
          <div className="text-sm text-muted-foreground sm:ml-0 flex-shrink-0">
            © {currentYear} Rafflhub. All rights reserved.
          </div>

          {/* Social Links */}
          <div className="flex items-center gap-4 sm:gap-4 sm:mr-0 flex-shrink-0 justify-center">
            <a
              href="https://github.com/rafflhub"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-muted-foreground hover:text-foreground transition-colors duration-200 hover:bg-muted rounded-md"
              title="GitHub"
            >
              <Github className="h-5 w-5" />
            </a>
            <a
              href="https://twitter.com/rafflhub"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-muted-foreground hover:text-foreground transition-colors duration-200 hover:bg-muted rounded-md"
              title="Twitter"
            >
              <Twitter className="h-5 w-5" />
            </a>
            <a
              href="mailto:contact@rafflhub.com"
              className="p-2 text-muted-foreground hover:text-foreground transition-colors duration-200 hover:bg-muted rounded-md"
              title="Contact"
            >
              <Mail className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
