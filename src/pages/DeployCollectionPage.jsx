import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Gift, 
  Settings, 
  Info, 
  Plus, 
  Star,
  Image,
  Link,
  Clock,
  User,
  Percent
} from 'lucide-react';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { toast } from '../components/ui/sonner';
import { ethers } from 'ethers';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../components/ui/tooltip';
import { useMobileBreakpoints } from '../hooks/useMobileBreakpoints';

const DeployCollectionPage = () => {
  const { connected, address, provider } = useWallet();
  const { contracts } = useContract();
  const { isMobile } = useMobileBreakpoints();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [collectionType, setCollectionType] = useState('ERC721');
  
  // State for background image
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Form state for ERC721
  const [erc721FormData, setErc721FormData] = useState({
    name: '',
    symbol: '',
    baseURI: '',
    dropURI: '',
    royaltyPercentage: '',
    royaltyRecipient: address || '',
    maxSupply: '',
    revealType: '0', // 0 = Instant, 1 = Manual, 2 = Scheduled
    unrevealedBaseURI: '',
    revealTime: '',
  });

  // Form state for ERC1155
  const [erc1155FormData, setErc1155FormData] = useState({
    name: '',
    symbol: '',
    baseURI: '',
    dropURI: '',
    royaltyPercentage: '',
    royaltyRecipient: address || '',
    maxSupply: '0', // ERC1155 can have 0 maxSupply
    revealType: '0',
    unrevealedBaseURI: '',
    revealTime: '',
  });

  useEffect(() => {
    if (address && !erc721FormData.royaltyRecipient) {
      setErc721FormData(prev => ({ ...prev, royaltyRecipient: address }));
      setErc1155FormData(prev => ({ ...prev, royaltyRecipient: address }));
    }
  }, [address]);

  // IPFS gateways for decentralized URIs
  const IPFS_GATEWAYS = [
    'https://ipfs.io/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://dweb.link/ipfs/'
  ];

  const IPNS_GATEWAYS = IPFS_GATEWAYS.map(g => g.replace('/ipfs/', '/ipns/'));

  const ARWEAVE_GATEWAYS = [
    'https://arweave.net/'
  ];

  // Convert decentralized URIs to HTTP URLs
  const convertDecentralizedToHTTP = (uri) => {
    if (!uri) return [];

    // IPFS (ipfs://)
    if (uri.startsWith('ipfs://')) {
      let hash = uri.replace('ipfs://', '');
      if (hash.startsWith('ipfs/')) hash = hash.slice('ipfs/'.length);
      return IPFS_GATEWAYS.map(gateway => `${gateway}${hash}`);
    }

    // IPNS (ipns://)
    if (uri.startsWith('ipns://')) {
      let name = uri.replace('ipns://', '');
      if (name.startsWith('ipns/')) name = name.slice('ipns/'.length);
      return IPNS_GATEWAYS.map(gateway => `${gateway}${name}`);
    }

    // Arweave (ar://)
    if (uri.startsWith('ar://')) {
      const id = uri.replace('ar://', '');
      return ARWEAVE_GATEWAYS.map(gateway => `${gateway}${id}`);
    }

    // If HTTP(s) to a known IPFS/IPNS/Arweave gateway, normalize and fan out
    try {
      const u = new URL(uri);
      // Fix accidental double ipfs segment in HTTP URLs (e.g., /ipfs/ipfs/<hash>)
      let pathname = u.pathname.replace(/\/ipfs\/ipfs\//, '/ipfs/');
      const parts = pathname.split('/').filter(Boolean);

      const ipfsIndex = parts.indexOf('ipfs');
      if (ipfsIndex !== -1 && parts[ipfsIndex + 1]) {
        const hashAndRest = parts.slice(ipfsIndex + 1).join('/');
        return IPFS_GATEWAYS.map(gateway => `${gateway}${hashAndRest}`);
      }

      const ipnsIndex = parts.indexOf('ipns');
      if (ipnsIndex !== -1 && parts[ipnsIndex + 1]) {
        const nameAndRest = parts.slice(ipnsIndex + 1).join('/');
        return IPNS_GATEWAYS.map(gateway => `${gateway}${nameAndRest}`);
      }

      // Arweave gateway (e.g., arweave.net/<id>)
      if (u.hostname.endsWith('arweave.net') || u.hostname === 'arweave.net') {
        const id = parts.join('/');
        return ARWEAVE_GATEWAYS.map(gateway => `${gateway}${id}`);
      }
    } catch (_) {
      // not a URL, fall through
    }

    // Fallback: return as-is
    return [uri];
  };

  // Extract image URL from metadata
  const extractImageURL = (metadata) => {
    const mediaFields = [
      'image',
      'image_url',
      'imageUrl',
      'animation_url',
      'animationUrl',
      'media',
      'artwork'
    ];

    for (const field of mediaFields) {
      if (metadata[field]) {
        const raw = metadata[field];
        if (typeof raw === 'string') {
          if (raw.startsWith('ipfs://') || raw.startsWith('ar://')) {
            return convertDecentralizedToHTTP(raw);
          }
          return [raw];
        }
      }
    }

    return null;
  };

  // Fetch artwork from URI
  const fetchArtwork = async (uri) => {
    if (!uri) return null;

    setImageLoading(true);
    setImageLoaded(false);
    
    try {
      // First construct metadata URI variants
      const uriVariants = constructMetadataURIs(uri);
      
      // Then convert each variant to HTTP URLs (for IPFS/Arweave)
      const allUrls = [];
      for (const variant of uriVariants) {
        const converted = convertDecentralizedToHTTP(variant);
        allUrls.push(...converted);
      }
      
      for (const url of allUrls) {
        try {
          const response = await fetch(url, {
            headers: {
              'Accept': 'application/json, text/plain, */*'
            }
          });

          if (response.ok) {
            const contentType = response.headers.get('content-type');
            
            // Try to parse as JSON
            try {
              const text = await response.text();
              const metadata = JSON.parse(text);
              
              if (metadata && typeof metadata === 'object') {
                const imageUrl = extractImageURL(metadata);
                if (imageUrl && imageUrl.length > 0) {
                  // Return the first image URL
                  const finalUrl = imageUrl[0];
                  
                  // If it's still a decentralized URI, convert it
                  if (finalUrl.startsWith('ipfs://') || finalUrl.startsWith('ar://')) {
                    const converted = convertDecentralizedToHTTP(finalUrl);
                    if (converted.length > 0) {
                      setBackgroundImage(converted[0]);
                      // Don't set loading to false yet - wait for image to load
                      return converted[0];
                    }
                  }
                  
                  setBackgroundImage(finalUrl);
                  // Don't set loading to false yet - wait for image to load
                  return finalUrl;
                }
              }
            } catch (jsonError) {
              // If JSON parsing fails, check if it's a direct image
              if (
                contentType?.startsWith('image/') ||
                url.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)
              ) {
                setBackgroundImage(url);
                // Don't set loading to false yet - wait for image to load
                return url;
              }
            }
          }
        } catch (error) {
          continue; // Try next variant
        }
      }
    } catch (error) {
      console.error('Error fetching artwork:', error);
    } finally {
      // Only set loading to false if we didn't find an image
      if (!backgroundImage) {
        setImageLoading(false);
      }
    }

    return null;
  };

  // Handle image load completion
  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageLoading(false);
  };

  // Simplified metadata URI construction for DeployCollectionPage
  const constructMetadataURIs = (baseUri) => {
    const uriVariants = [];
    const hadTrailingSlash = /\/$/.test(baseUri);
    const cleanBaseUri = baseUri.replace(/\/$/, '');

    // Check if the URI already contains a token ID
    const alreadyContainsTokenId = baseUri.match(/\/(?:[0-9]+)(?:\.json)?$/);

    if (alreadyContainsTokenId) {
      // Priority 1: Original URI as-is
      uriVariants.push(baseUri);

      // Priority 2: Add .json if not present
      if (!baseUri.includes('.json')) {
        uriVariants.push(`${baseUri}.json`);
      }

      // Priority 3: Try root (remove token ID)
      const root = cleanBaseUri.replace(/\/(?:[0-9]+)(?:\.json)?$/, '');
      if (root && root !== cleanBaseUri) {
        uriVariants.push(root);
        uriVariants.push(`${root}/`);
        // Common root JSON files
        uriVariants.push(`${root}.json`);
        uriVariants.push(`${root}/.json`);
        uriVariants.push(`${root}/index.json`);
        uriVariants.push(`${root}/metadata.json`);
      }
    } else {
      // No token ID - try base URI variations
      uriVariants.push(baseUri);
      if (hadTrailingSlash) {
        uriVariants.push(cleanBaseUri);
      }
      if (!baseUri.includes('.json')) {
        uriVariants.push(`${baseUri}.json`);
        uriVariants.push(`${cleanBaseUri}.json`);
      }
      // Common root files
      uriVariants.push(`${baseUri}index.json`);
      uriVariants.push(`${baseUri}metadata.json`);
      if (hadTrailingSlash) {
        uriVariants.push(`${cleanBaseUri}/index.json`);
        uriVariants.push(`${cleanBaseUri}/metadata.json`);
      }
    }

    return [...new Set(uriVariants)]; // Remove duplicates
  };

  // Handle Drop URI change
  useEffect(() => {
    const dropURI = collectionType === 'ERC721' ? erc721FormData.dropURI : erc1155FormData.dropURI;
    const unrevealedURI = collectionType === 'ERC721' ? erc721FormData.unrevealedBaseURI : erc1155FormData.unrevealedBaseURI;
    
    // Prioritize Drop URI if provided
    if (dropURI && dropURI.trim() !== '') {
      fetchArtwork(dropURI);
    } else if (unrevealedURI && unrevealedURI.trim() !== '') {
      fetchArtwork(unrevealedURI);
    } else {
      setBackgroundImage(null);
    }
  }, [
    erc721FormData.dropURI,
    erc721FormData.unrevealedBaseURI,
    erc1155FormData.dropURI,
    erc1155FormData.unrevealedBaseURI,
    collectionType
  ]);

  const handleErc721Change = (field, value) => {
    setErc721FormData(prev => ({ ...prev, [field]: value }));
  };

  const handleErc1155Change = (field, value) => {
    setErc1155FormData(prev => ({ ...prev, [field]: value }));
  };

  const deployCollection = async (formData, isERC721) => {
    if (!connected || !contracts.nftFactory || !provider) {
      toast.error('Please connect your wallet and ensure contracts are configured');
      return;
    }

    setLoading(true);
    try {
      const signer = provider.getSigner();
      const standard = isERC721 ? 0 : 1;
      
      let revealType = parseInt(formData.revealType);
      let unrevealedBaseURI = formData.unrevealedBaseURI;
      let revealTime = 0;
      
      if (revealType === 2) {
        // Scheduled
        revealTime = Math.floor(new Date(formData.revealTime).getTime() / 1000);
      }
      
      // Preserve unrevealedBaseURI for Manual (1) and Scheduled (2). Only clear for Instant (0)
      if (revealType === 0) {
        unrevealedBaseURI = '';
        revealTime = 0;
      }

      const params = {
        standard,
        name: formData.name,
        symbol: formData.symbol,
        baseURI: formData.baseURI,
        dropURI: formData.dropURI || '',
        initialOwner: address,
        royaltyPercentage: formData.royaltyPercentage ? parseInt(formData.royaltyPercentage) * 100 : 0, // percent to bps
        royaltyRecipient: formData.royaltyRecipient,
        maxSupply: parseInt(formData.maxSupply || '0'),
        revealType: revealType,
        unrevealedBaseURI: unrevealedBaseURI,
        revealTime: revealTime,
      };

      const tx = await contracts.nftFactory.connect(signer).deployCollection(
        standard,
        formData.name,
        formData.symbol,
        formData.baseURI,
        formData.dropURI || '',
        address,
        formData.royaltyPercentage ? parseInt(formData.royaltyPercentage) * 100 : 0, // percent to bps
        formData.royaltyRecipient,
        parseInt(formData.maxSupply || '0'),
        revealType,
        unrevealedBaseURI,
        revealTime
      );
      const receipt = await tx.wait();
      
      const collectionAddress = receipt.events.find(e => e.event === 'PrizeCollectionCreated')?.args?.collection;
      
      toast.success(`${isERC721 ? 'ERC721' : 'ERC1155'} collection deployed successfully!`);
      
      // Reset form
      if (isERC721) {
        setErc721FormData({
          name: '',
          symbol: '',
          baseURI: '',
          dropURI: '',
          royaltyPercentage: '',
          royaltyRecipient: address || '',
          maxSupply: '',
          revealType: '0',
          unrevealedBaseURI: '',
          revealTime: '',
        });
      } else {
        setErc1155FormData({
          name: '',
          symbol: '',
          baseURI: '',
          dropURI: '',
          royaltyPercentage: '',
          royaltyRecipient: address || '',
          maxSupply: '0',
          revealType: '0',
          unrevealedBaseURI: '',
          revealTime: '',
        });
      }
      
      // Optionally navigate to collection page or show collection address
      if (collectionAddress) {
        console.log('Collection deployed at:', collectionAddress);
      }
    } catch (error) {
      console.error('Error deploying collection:', error);
      toast.error(error.message || 'Failed to deploy collection');
    } finally {
      setLoading(false);
    }
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Gift className={`mx-auto mb-4 text-muted-foreground ${isMobile ? 'h-12 w-12' : 'h-16 w-16'}`} />
          <h2 className={`font-bold mb-2 ${isMobile ? 'text-xl' : 'text-2xl'}`}>Connect Your Wallet</h2>
          <p className={`text-muted-foreground ${isMobile ? 'text-sm' : 'text-base'}`}>
            Please connect your wallet to deploy NFT collections.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-6 relative">
      {/* Background Image Overlay */}
      {backgroundImage && (
        <>
          <img
            src={backgroundImage}
            alt="Collection artwork"
            onLoad={handleImageLoad}
            onError={() => {
              setImageLoading(false);
              setBackgroundImage(null);
            }}
            style={{ display: 'none' }}
          />
          <div 
            className="absolute inset-0 top-0 left-0 w-full h-1/2 opacity-40 pointer-events-none"
            style={{
              backgroundImage: `url(${backgroundImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              filter: 'blur(0.5px) brightness(1.2) contrast(1.1)'
            }}
          />
        </>
      )}
      
      {/* Loading Overlay */}
      {imageLoading && (
        <div className="absolute inset-0 top-0 left-0 w-full h-1/2 flex items-center justify-center pointer-events-none z-20">
          <div className="bg-background/90 backdrop-blur-sm rounded-lg px-4 py-3 flex items-center gap-3 shadow-lg">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent"></div>
            <span className="text-sm font-medium">Loading artwork...</span>
          </div>
        </div>
      )}
      
      <div className={`${isMobile ? 'px-4' : 'container mx-auto px-8'} pt-8 pb-4 relative z-10`}>
        {/* Page Header */}
        <div className="text-center mb-8">
          <h1 className={`text-3xl font-bold mb-4 font-display ${isMobile ? 'text-2xl mb-2' : ''}`}>
            Deploy NFT Collection
          </h1>
          <p className="text-muted-foreground text-[length:var(--text-base)] leading-relaxed">
            Create ERC721 or ERC1155 prize collections for your raffles
          </p>
        </div>

        {/* Main Content */}
        <div className={`max-w-3xl mx-auto ${isMobile ? 'mt-6' : 'mt-16'}`}>
          <Tabs value={collectionType} onValueChange={setCollectionType} className="w-full">
            <TabsList className={`w-full flex items-center justify-center gap-2 ${isMobile ? 'p-1.5 h-12 mb-6' : 'p-1 h-10 mb-8'} bg-muted/80 border border-border/50 shadow-sm`}>
              <TabsTrigger 
                value="ERC721" 
                className={`flex items-center gap-2 flex-1 data-[state=active]:bg-background data-[state=active]:border-primary/20 data-[state=active]:shadow-md transition-all ${isMobile ? 'h-9 text-sm' : 'h-[calc(100%-1px)]'}`}
              >
                <Image className={`${isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />
                <span className="font-medium">{isMobile ? 'ERC721' : 'ERC721 Collection'}</span>
              </TabsTrigger>
              <TabsTrigger 
                value="ERC1155" 
                className={`flex items-center gap-2 flex-1 data-[state=active]:bg-background data-[state=active]:border-primary/20 data-[state=active]:shadow-md transition-all ${isMobile ? 'h-9 text-sm' : 'h-[calc(100%-1px)]'}`}
              >
                <Star className={`${isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />
                <span className="font-medium">{isMobile ? 'ERC1155' : 'ERC1155 Collection'}</span>
              </TabsTrigger>
            </TabsList>

            {/* ERC721 Form */}
            <TabsContent value="ERC721">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-card border border-border rounded-xl p-6 shadow-xl"
              >
                <div className="flex items-center gap-3 mb-6">
                  <Image className="h-5 w-5" />
                  <h3 className="font-display text-[length:var(--text-xl)] font-semibold">Deploy ERC721 Collection</h3>
                </div>
                
                <form onSubmit={(e) => { e.preventDefault(); deployCollection(erc721FormData, true); }} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-body text-[length:var(--text-base)] font-medium mb-2">Collection Name</label>
                      <input
                        type="text"
                        value={erc721FormData.name}
                        onChange={e => handleErc721Change('name', e.target.value)}
                        className="w-full px-3 py-2.5 font-body text-[length:var(--text-base)] border border-border rounded-lg bg-background"
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-body text-[length:var(--text-base)] font-medium mb-2">Symbol</label>
                      <input
                        type="text"
                        value={erc721FormData.symbol}
                        onChange={e => handleErc721Change('symbol', e.target.value)}
                        className="w-full px-3 py-2.5 font-body text-[length:var(--text-base)] border border-border rounded-lg bg-background uppercase"
                        maxLength={10}
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-body text-[length:var(--text-base)] font-medium mb-2">Base URI</label>
                      <input
                        type="url"
                        value={erc721FormData.baseURI}
                        onChange={e => handleErc721Change('baseURI', e.target.value)}
                        className="w-full px-3 py-2.5 font-body text-[length:var(--text-base)] border border-border rounded-lg bg-background font-mono"
                        placeholder="https://api.example.com/metadata/"
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-body text-[length:var(--text-base)] font-medium mb-2 flex items-center gap-2">
                        Drop URI
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                          </TooltipTrigger>
                          <TooltipContent sideOffset={6}>
                            <div>Optional URI for your collection's drop page or storefront</div>
                          </TooltipContent>
                        </Tooltip>
                      </label>
                      <input
                        type="url"
                        value={erc721FormData.dropURI}
                        onChange={e => handleErc721Change('dropURI', e.target.value)}
                        className="w-full px-3 py-2.5 font-body text-[length:var(--text-base)] border border-border rounded-lg bg-background font-mono"
                        placeholder="https://your-drops-page.com/collection"
                      />
                    </div>
                    <div>
                      <label className="block font-body text-[length:var(--text-base)] font-medium mb-2">Max Supply</label>
                      <input
                        type="number"
                        value={erc721FormData.maxSupply}
                        onChange={e => handleErc721Change('maxSupply', e.target.value)}
                        onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
                        className="w-full px-3 py-2.5 font-body text-[length:var(--text-base)] border border-border rounded-lg bg-background"
                        min="1"
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-body text-[length:var(--text-base)] font-medium mb-2 flex items-center gap-2">
                        Royalty Percentage (%)
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                          </TooltipTrigger>
                          <TooltipContent sideOffset={6}>
                            <div>Secondary sale royalty (e.g., 5 for 5%)</div>
                          </TooltipContent>
                        </Tooltip>
                      </label>
                      <input
                        type="number"
                        value={erc721FormData.royaltyPercentage}
                        onChange={e => handleErc721Change('royaltyPercentage', e.target.value)}
                        onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
                        className="w-full px-3 py-2.5 font-body text-[length:var(--text-base)] border border-border rounded-lg bg-background"
                        min="0"
                        max="10"
                        step="0.01"
                        placeholder="5"
                      />
                    </div>
                    <div>
                      <label className="block font-body text-[length:var(--text-base)] font-medium mb-2">Royalty Recipient</label>
                      <input
                        type="text"
                        value={erc721FormData.royaltyRecipient}
                        onChange={e => handleErc721Change('royaltyRecipient', e.target.value)}
                        className="w-full px-3 py-2.5 font-body text-[length:var(--text-base)] border border-border rounded-lg bg-background font-mono"
                        placeholder="0x..."
                        required
                        pattern="^0x[a-fA-F0-9]{40}$"
                      />
                    </div>
                    <div>
                      <Label className="block font-body text-[length:var(--text-base)] font-medium mb-2">Reveal Type</Label>
                      <Select
                        value={erc721FormData.revealType}
                        onValueChange={value => handleErc721Change('revealType', value)}
                        required
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select Reveal Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Instant Reveal</SelectItem>
                          <SelectItem value="1">Manual Reveal</SelectItem>
                          <SelectItem value="2">Scheduled Reveal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {(erc721FormData.revealType === '1' || erc721FormData.revealType === '2') && (
                      <div>
                        <label className="block font-body text-[length:var(--text-base)] font-medium mb-2">Unrevealed Base URI</label>
                        <input
                          type="url"
                          value={erc721FormData.unrevealedBaseURI}
                          onChange={e => handleErc721Change('unrevealedBaseURI', e.target.value)}
                          className="w-full px-3 py-2.5 font-body text-[length:var(--text-base)] border border-border rounded-lg bg-background font-mono"
                          required={erc721FormData.revealType === '1' || erc721FormData.revealType === '2'}
                          placeholder="https://api.example.com/hidden/"
                        />
                      </div>
                    )}
                    {erc721FormData.revealType === '2' && (
                      <div>
                        <label className="block font-body text-[length:var(--text-base)] font-medium mb-2">Reveal Time</label>
                        <input
                          type="datetime-local"
                          value={erc721FormData.revealTime}
                          onChange={e => handleErc721Change('revealTime', e.target.value)}
                          className="w-full px-3 py-2.5 font-body text-[length:var(--text-base)] border border-border rounded-lg bg-background"
                          required={erc721FormData.revealType === '2'}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex gap-4 pt-4">
                    <Button
                      type="submit"
                      disabled={loading}
                      variant="primary"
                      size="lg"
                      className="flex-1 text-base h-12"
                    >
                      {loading ? 'Deploying...' : 'Deploy Collection'}
                    </Button>
                  </div>
                </form>
              </motion.div>
            </TabsContent>

            {/* ERC1155 Form */}
            <TabsContent value="ERC1155">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-card border border-border rounded-xl p-6 shadow-xl"
              >
                <div className="flex items-center gap-3 mb-6">
                  <Star className="h-5 w-5" />
                  <h3 className="font-display text-[length:var(--text-xl)] font-semibold">Deploy ERC1155 Collection</h3>
                </div>
                
                <form onSubmit={(e) => { e.preventDefault(); deployCollection(erc1155FormData, false); }} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-body text-[length:var(--text-base)] font-medium mb-2">Collection Name</label>
                      <input
                        type="text"
                        value={erc1155FormData.name}
                        onChange={e => handleErc1155Change('name', e.target.value)}
                        className="w-full px-3 py-2.5 font-body text-[length:var(--text-base)] border border-border rounded-lg bg-background"
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-body text-[length:var(--text-base)] font-medium mb-2">Symbol</label>
                      <input
                        type="text"
                        value={erc1155FormData.symbol}
                        onChange={e => handleErc1155Change('symbol', e.target.value)}
                        className="w-full px-3 py-2.5 font-body text-[length:var(--text-base)] border border-border rounded-lg bg-background uppercase"
                        maxLength={10}
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-body text-[length:var(--text-base)] font-medium mb-2">Base URI</label>
                      <input
                        type="url"
                        value={erc1155FormData.baseURI}
                        onChange={e => handleErc1155Change('baseURI', e.target.value)}
                        className="w-full px-3 py-2.5 font-body text-[length:var(--text-base)] border border-border rounded-lg bg-background font-mono"
                        placeholder="https://api.example.com/metadata/"
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-body text-[length:var(--text-base)] font-medium mb-2 flex items-center gap-2">
                        Drop URI
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                          </TooltipTrigger>
                          <TooltipContent sideOffset={6}>
                            <div>Optional URI for your collection's drop page or storefront</div>
                          </TooltipContent>
                        </Tooltip>
                      </label>
                      <input
                        type="url"
                        value={erc1155FormData.dropURI}
                        onChange={e => handleErc1155Change('dropURI', e.target.value)}
                        className="w-full px-3 py-2.5 font-body text-[length:var(--text-base)] border border-border rounded-lg bg-background font-mono"
                        placeholder="https://your-drops-page.com/collection"
                      />
                    </div>
                    <div>
                      <label className="block font-body text-[length:var(--text-base)] font-medium mb-2 flex items-center gap-2">
                        Max Supply
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                          </TooltipTrigger>
                          <TooltipContent sideOffset={6}>
                            <div>Set to 0 for unlimited supply</div>
                          </TooltipContent>
                        </Tooltip>
                      </label>
                      <input
                        type="number"
                        value={erc1155FormData.maxSupply}
                        onChange={e => handleErc1155Change('maxSupply', e.target.value)}
                        onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
                        className="w-full px-3 py-2.5 font-body text-[length:var(--text-base)] border border-border rounded-lg bg-background"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block font-body text-[length:var(--text-base)] font-medium mb-2 flex items-center gap-2">
                        Royalty Percentage (%)
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                          </TooltipTrigger>
                          <TooltipContent sideOffset={6}>
                            <div>Secondary sale royalty (e.g., 5 for 5%)</div>
                          </TooltipContent>
                        </Tooltip>
                      </label>
                      <input
                        type="number"
                        value={erc1155FormData.royaltyPercentage}
                        onChange={e => handleErc1155Change('royaltyPercentage', e.target.value)}
                        onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
                        className="w-full px-3 py-2.5 font-body text-[length:var(--text-base)] border border-border rounded-lg bg-background"
                        min="0"
                        max="10"
                        step="0.01"
                        placeholder="5"
                      />
                    </div>
                    <div>
                      <label className="block font-body text-[length:var(--text-base)] font-medium mb-2">Royalty Recipient</label>
                      <input
                        type="text"
                        value={erc1155FormData.royaltyRecipient}
                        onChange={e => handleErc1155Change('royaltyRecipient', e.target.value)}
                        className="w-full px-3 py-2.5 font-body text-[length:var(--text-base)] border border-border rounded-lg bg-background font-mono"
                        placeholder="0x..."
                        required
                        pattern="^0x[a-fA-F0-9]{40}$"
                      />
                    </div>
                    <div>
                      <label className="block font-body text-[length:var(--text-base)] font-medium mb-2">Reveal Type</label>
                      <Select
                        value={erc1155FormData.revealType}
                        onValueChange={value => handleErc1155Change('revealType', value)}
                        required
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select Reveal Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Instant Reveal</SelectItem>
                          <SelectItem value="1">Manual Reveal</SelectItem>
                          <SelectItem value="2">Scheduled Reveal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {(erc1155FormData.revealType === '1' || erc1155FormData.revealType === '2') && (
                      <div>
                        <label className="block font-body text-[length:var(--text-base)] font-medium mb-2">Unrevealed Base URI</label>
                        <input
                          type="url"
                          value={erc1155FormData.unrevealedBaseURI}
                          onChange={e => handleErc1155Change('unrevealedBaseURI', e.target.value)}
                          className="w-full px-3 py-2.5 font-body text-[length:var(--text-base)] border border-border rounded-lg bg-background font-mono"
                          required={erc1155FormData.revealType === '1' || erc1155FormData.revealType === '2'}
                          placeholder="https://api.example.com/hidden/"
                        />
                      </div>
                    )}
                    {erc1155FormData.revealType === '2' && (
                      <div>
                        <label className="block font-body text-[length:var(--text-base)] font-medium mb-2">Reveal Time</label>
                        <input
                          type="datetime-local"
                          value={erc1155FormData.revealTime}
                          onChange={e => handleErc1155Change('revealTime', e.target.value)}
                          className="w-full px-3 py-2.5 font-body text-[length:var(--text-base)] border border-border rounded-lg bg-background"
                          required={erc1155FormData.revealType === '2'}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex gap-4 pt-4">
                    <Button
                      type="submit"
                      disabled={loading}
                      variant="primary"
                      size="lg"
                      className="flex-1 text-base h-12"
                    >
                      {loading ? 'Deploying...' : 'Deploy Collection'}
                    </Button>
                  </div>
                </form>
              </motion.div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default DeployCollectionPage;
