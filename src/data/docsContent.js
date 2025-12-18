// Documentation content structure
// This file contains all documentation sections, subsections, and content

export const docsContent = {
  sections: [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: 'Zap',
      subsections: [
        {
          id: 'what-is-dropr',
          title: 'What is Dropr?',
          content: [
            {
              type: 'text',
              content: 'Dropr is a provably fair asset distribution platform built on blockchain technology. It enables creators, project teams, and KOLs to distribute digital assets transparently and fairly.'
            },
            {
              type: 'text',
              content: 'Using Chainlink VRF (Verifiable Random Function), Dropr ensures that all distribution events are truly random and verifiable on-chain, eliminating any possibility of manipulation.'
            },
            {
              type: 'image',
              src: '/images/docs/dropr-overview.png',
              alt: 'Dropr Platform Overview',
              caption: 'The Dropr platform interface showing active distribution events'
            },
            {
              type: 'heading',
              level: 3,
              content: 'Key Features'
            },
            {
              type: 'list',
              items: [
                'Provably fair distribution using Chainlink VRF',
                'Support for NFTs, tokens, and digital assets',
                'Social media integration for community engagement',
                'Transparent on-chain verification',
                'Flexible distribution parameters'
              ]
            }
          ]
        },
        {
          id: 'creating-first-distribution',
          title: 'Creating Your First Distribution',
          content: [
            {
              type: 'text',
              content: 'Creating your first distribution event on Dropr is straightforward. Follow these steps to launch a provably fair distribution:'
            },
            {
              type: 'heading',
              level: 3,
              content: 'Step 1: Connect Your Wallet'
            },
            {
              type: 'text',
              content: 'First, connect your Web3 wallet to the Dropr platform. Supported wallets include MetaMask, WalletConnect, and others.'
            },
            {
              type: 'image',
              src: '/images/docs/connect-wallet.png',
              alt: 'Connect Wallet Interface',
              caption: 'Click "Connect Wallet" in the top right corner'
            },
            {
              type: 'heading',
              level: 3,
              content: 'Step 2: Configure Distribution Parameters'
            },
            {
              type: 'text',
              content: 'Set up your distribution parameters including prize details, ticket price, maximum participants, and duration.'
            }
          ]
        }
      ]
    },
    {
      id: 'guides',
      title: 'Guides',
      icon: 'BookOpen',
      subsections: [
        {
          id: 'nft-distributions',
          title: 'NFT Distribution Events',
          content: [
            {
              type: 'text',
              content: 'NFT distribution events are perfect for launching new collections, rewarding community members, or conducting fair mints.'
            },
            {
              type: 'heading',
              level: 3,
              content: 'Setting Up NFT Distribution'
            },
            {
              type: 'text',
              content: 'When creating an NFT distribution, you can configure:'
            },
            {
              type: 'list',
              items: [
                'Single NFT or collection distribution',
                'Tiered rewards based on participation',
                'Guaranteed mint for specific criteria',
                'Random selection from qualified participants'
              ]
            },
            {
              type: 'image',
              src: '/images/docs/nft-setup.png',
              alt: 'NFT Distribution Setup',
              caption: 'Configure your NFT distribution parameters'
            }
          ]
        },
        {
          id: 'token-gating',
          title: 'Token Gating',
          content: [
            {
              type: 'text',
              content: 'Token gating allows you to restrict participation to holders of specific tokens or NFTs.'
            },
            {
              type: 'heading',
              level: 3,
              content: 'Implementing Token Gates'
            },
            {
              type: 'text',
              content: 'To set up token gating:'
            },
            {
              type: 'ordered-list',
              items: [
                'Select the token contract address',
                'Specify minimum holding requirements',
                'Configure snapshot timing',
                'Set up verification rules'
              ]
            }
          ]
        }
      ]
    },
    {
      id: 'developers',
      title: 'Developers',
      icon: 'Code',
      subsections: [
        {
          id: 'smart-contracts',
          title: 'Smart Contract Architecture',
          content: [
            {
              type: 'text',
              content: 'The Dropr protocol consists of several interconnected smart contracts that ensure fair and transparent distributions.'
            },
            {
              type: 'heading',
              level: 3,
              content: 'Core Contracts'
            },
            {
              type: 'text',
              content: 'The protocol includes the following main contracts:'
            },
            {
              type: 'list',
              items: [
                'ProtocolManager - Registry for all distribution events',
                'Pool - Individual distribution contract',
                'RevenueManager - Handles fee distribution',
                'NFTFactory - Creates prize NFT contracts',
                'SocialEngagementManager - Manages social tasks'
              ]
            },
            {
              type: 'image',
              src: '/images/docs/contract-architecture.png',
              alt: 'Smart Contract Architecture',
              caption: 'Overview of the Dropr smart contract system'
            }
          ]
        },
        {
          id: 'api-reference',
          title: 'API Reference',
          content: [
            {
              type: 'text',
              content: 'The Dropr API provides programmatic access to platform features and data.'
            },
            {
              type: 'heading',
              level: 3,
              content: 'Authentication'
            },
            {
              type: 'code',
              language: 'javascript',
              code: `const API_KEY = 'your-api-key';
const headers = {
  'Authorization': \`Bearer \${API_KEY}\`,
  'Content-Type': 'application/json'
};`
            },
            {
              type: 'heading',
              level: 3,
              content: 'Endpoints'
            },
            {
              type: 'text',
              content: 'Main API endpoints include:'
            },
            {
              type: 'list',
              items: [
                'GET /api/distributions - List all distributions',
                'POST /api/distributions - Create new distribution',
                'GET /api/distributions/{id} - Get distribution details',
                'POST /api/distributions/{id}/enter - Enter distribution'
              ]
            }
          ]
        }
      ]
    },
    {
      id: 'security',
      title: 'Security',
      icon: 'Shield',
      subsections: [
        {
          id: 'security-overview',
          title: 'Security Overview',
          content: [
            {
              type: 'text',
              content: 'Security is paramount in the Dropr protocol. Multiple layers ensure the integrity and fairness of all distributions.'
            },
            {
              type: 'heading',
              level: 3,
              content: 'VRF Implementation'
            },
            {
              type: 'text',
              content: 'Chainlink VRF provides cryptographically provable randomness:'
            },
            {
              type: 'ordered-list',
              items: [
                'Request random number from Chainlink',
                'Verify VRF proof on-chain',
                'Use verified random number for selection',
                'Log all steps for transparency'
              ]
            },
            {
              type: 'image',
              src: '/images/docs/vrf-flow.png',
              alt: 'VRF Verification Flow',
              caption: 'How Chainlink VRF ensures fair selection'
            }
          ]
        },
        {
          id: 'best-practices',
          title: 'Best Practices',
          content: [
            {
              type: 'text',
              content: 'Follow these security best practices when creating distributions:'
            },
            {
              type: 'heading',
              level: 3,
              content: 'For Creators'
            },
            {
              type: 'list',
              items: [
                'Never share your private keys',
                'Use hardware wallets for large distributions',
                'Verify all parameters before deployment',
                'Test with small amounts first'
              ]
            },
            {
              type: 'heading',
              level: 3,
              content: 'For Participants'
            },
            {
              type: 'list',
              items: [
                'Only interact with official dropr.fun URLs',
                'Verify distribution addresses on-chain',
                'Be wary of phishing attempts',
                'Keep your wallet secure'
              ]
            }
          ]
        }
      ]
    }
  ]
};

// Helper function to find content by section and subsection IDs
export const findContent = (sectionId, subsectionId) => {
  const section = docsContent.sections.find(s => s.id === sectionId);
  if (!section) return null;
  
  if (subsectionId) {
    const subsection = section.subsections.find(sub => sub.id === subsectionId);
    return subsection || null;
  }
  
  return section;
};
