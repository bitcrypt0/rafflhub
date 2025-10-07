import React from 'react';
import {
  Twitter
} from 'lucide-react';

// Custom Medium icon component
const MediumIcon = ({ className }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z"/>
  </svg>
);

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
              href="https://medium.com/@rafflhub"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-muted-foreground hover:text-foreground transition-colors duration-200 hover:bg-muted rounded-md"
              title="Medium"
            >
              <MediumIcon className="h-5 w-5" />
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
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
