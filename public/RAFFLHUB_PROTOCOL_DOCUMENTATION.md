

## Table of Contents
1. [Overview](#overview)
2. [Protocol Architecture](#protocol-architecture)
3. [Core Contracts](#core-contracts)
4. [Features & Functionality](#features--functionality)
5. [Use Cases & Benefits](#use-cases--benefits)
6. [Technical Specifications](#technical-specifications)
7. [Security Features](#security-features)
8. [FAQ](#faq)


## Overview

The Rafflhub Protocol is a decentralized, trustless raffle system built on EVM networks that enables anyone to create, participate in, and manage digital raffles with various prize types including NFTs, ERC20 tokens, and ETH. The protocol leverages Chainlink's VRF (Verifiable Random Function) for provably fair winner selection and Chainlink Automation for reliable execution.

In the rapidly evolving Web3 space, community engagement is everything. Traditional giveaways and whitelist spots are often managed manually, leading to a lack of transparency and trust. Rafflhub solves this by automating the entire lifecycle of a raffle on the blockchain, from creation to prize claim, all powered by Chainlink's industry-leading VRF for true, verifiable randomness.

Whether you are an NFT artist looking to launch a new collection, an ERC-20 project wanting to reward your community, or a DAO aiming to create exclusive experiences, Rafflhub provides the ultimate platform to connect with your audience in a meaningful and trustless way.


### Key Features

The Rafflhub Protocol is more than just a simple raffle contract; it's a comprehensive ecosystem designed for versatility and security.

Multi-Prize Support: Create raffles for ERC-721 NFTs, ERC-1155 tokens, ERC-20 tokens, or native coins like ETH, BNB, and MATIC.

Token-Gated Access (Optional): Restrict raffle participation to holders of a specific NFT or ERC-20 token, creating exclusive events for your community.

Delayed Reveal Mechanism: Build anticipation for your NFT prizes with Manual or Scheduled reveals, keeping the final metadata hidden until the perfect moment.

Provably Fair & Verifiable: Powered by Chainlink VRF v2.5, guaranteeing that winner selection is tamper-proof and transparent to all participants.

Sophisticated Revenue & Refund Logic: Intelligent handling of ticket revenue, protocol fees, and robust, automated refunds for deleted or unengaged raffles.

Gas-Optimized Architecture: Utilizes the minimal proxy pattern (EIP-1167) to make deploying new raffles incredibly cheap and efficient.

Whitelisting Campaigns & Community Building: Run non-prized raffles to fairly select winners for whitelist spots, airdrops, or exclusive access.


## Key Protocol Innovations


Rafflhub introduces several powerful features that set it apart.

### Flexible Prize Management

Escrowed Prizes: For high-value, existing assets (like a 1-of-1 NFT or a pool of ETH), the prize is locked in the contract for maximum security.

Mintable Prizes: For new NFT collections, prizes are minted on-demand, saving significant gas costs and providing supply flexibility.

External Prizes: Protocol-native NFT collections and items from external collections can be assigned as prizes to raffles even after creation, offering new utility for existing assets.

### Provably Fair Winner Selection

Chainlink VRF 2.5: We adopted the latest version of Chainlink's Verifiable Random Function to ensure that no one — not raffle creators, not the protocol admins, not even network validators — can tamper with the winner selection process.

On-Chain Verification: Anyone can check the transaction that selected the winners and verify its integrity.

### Sophisticated Revenue & Refund System
Delayed Revenue Collection: For raffles using the protocol's default ticket price (aka global ticket price), the protocol cleverly waits until the number of participants exceeds the number of winners before collecting revenue. This ensures that if the raffle fails to gain traction, the funds are immediately available for refunds to participants.

Automated Unengaged State: If a raffle ends with fewer participants than the number of winners, it automatically transitions into an Unengaged state, allowing all participants to claim a full refund.


### Gamified NFT Sales 
Rafflhub unlocks a revolutionary new way for NFT holders to sell their assets: Gamified Sales. Instead of a static listing on a marketplace, you can turn the sale of a high-value NFT into an exciting, community-driven event.

The Concept:
An owner of an existing, valuable NFT (e.g., a 1-of-1 art piece or a rare collectible) wants to sell it for a specific price (e.g., 1 ETH). Instead of listing it on a marketplace, they create an NFT-prized raffle and escrow the NFT. They then set a custom ticket price and a ticket limit to match their desired sale price.

Example:

NFT Sale Price: 1 ETH

Raffle Configuration:

1000 Tickets

0.001 ETH per ticket

1 Winner

The creator lists their NFT in a raffle that, if sold out, nets them their full 1 ETH asking price (minus a small protocol fee). They can also delete the raffle before its duration elapses if the raffle doesn't get enough ticket sales. Once the raffle's duration is elapsed, deletion becomes impossible and the NFT goes to a lucky participant.

Benefits for NFT Sellers (Creators):

Increased Liquidity: Sell illiquid or high-value assets more effectively by lowering the financial barrier to entry. Instead of needing one buyer with 1 ETH, you need 1000 'buyers' with only 0.001 ETH each.

Guaranteed Sale Price: If all tickets are sold, you receive your target price, just as you would on a marketplace.

Community Engagement: A raffle is an event. It generates more excitement, social media buzz, and engagement than a simple "for sale" listing.

New Audience Reach: Attract participants who may not have been able to afford the NFT outright but are excited by the chance to win it at a massive discount.

Benefits for the Community (Participants):

Incredible Value Opportunity: One lucky winner acquires a high-value asset for the tiny price of a single ticket.

Gamified Experience: It transforms the passive act of browsing a marketplace into an exciting, low-risk, high-reward game.


### Advanced Feature: Protocol Composability & Cross-Community Collaboration
The true power of Web3 is composability — the ability for different protocols and assets to interact like Lego blocks to create new, innovative applications. Rafflhub is built with this principle at its core, primarily through the combination of its Token-Gated and External Prize features.

The Concept:
This feature allows projects and DAOs to create highly specific, collaborative events that reward other communities and strengthen ecosystem partnerships. You can create a raffle where the prize is from Community A, but only accessible to token holders from Community B.

How It Works:
A creator starts a non-prized raffle, which acts as a blank slate for a fair selection process. They then use two functions to "plug in" the components:

setExternalPrize(): The creator assigns a supply from their mintable, protocol-native NFT collection as prize(s).

Token-Gated Parameters: The creator sets the participation requirement to be a token or NFT from a completely different, external project.

Use Case Example: The Ultimate Cross-Community Event
Imagine two NFT projects - a popular one with a massive community (e.g Bored Ape Yacht Club), and the other, a new hyped upcoming NFT project.

The new project's team wants to reward the BAYC community with a free mint to foster goodwill and collaboration.

Step 1: The new project's team creates a non-prized raffle on Rafflhub.

Step 2: They configure the raffle to be token-gated, requiring that all participants must hold at least one "BAYC" NFT in their wallet.

Step 3: They call `setExternalPrize()` and assign their protocol-native NFT contract as the prize collection.

The Result: A provably fair raffle where a specified amount of the new project's NFT supply is given away exclusively to members of the BAYC community.

Benefits of Composability:

Powerful Community Collaboration: Forge strong bonds between different projects by creating mutually beneficial events.

Targeted Marketing: Airdrop prizes or whitelist spots directly to the members of a specific, high-value community you want to attract.

Enhanced Utility: Rafflhub becomes more than a raffle platform; it becomes a fundamental tool for Web3 community management, marketing, and diplomacy.


## Protocol Architecture

### Contract Hierarchy
```
RaffleManager (Configuration & Management)
├── RaffleDeployer (Factory for Raffle instances)
├── NFTFactory (Factory for Prize Collections)
├── RevenueManager (Revenue Management)
└── Individual Raffle Contracts (Raffle instances)
```

### Core Components

### 1. RaffleManager
The central configuration contract that manages:
- Protocol-wide settings and parameters
- VRF and Automation subscriptions
- Access control and operator management
- Collection approvals and whitelisting (for both NFTs and ERC20 Tokens)


### 2. RaffleDeployer
Factory contract that deploys individual raffle instances using the minimal proxy pattern (EIP-1167) for gas efficiency.


### 3. NFTFactory
Factory for deploying prize collection contracts (ERC721 and ERC1155) with standardized features like royalties and metadata support.


### 4. Raffle Contracts
Individual raffle instances that handle:
- Ticket sales and participant management
- Winner selection and prize distribution
- Raffle state management and lifecycle control


## Core Contracts

### RaffleManager.sol
**Purpose**: Central protocol configuration and management

**Key Functions**:
- `setGlobalTicketPrice()` - Configure protocol-wide ticket pricing
- `setDurationLimits()` - Set minimum/maximum raffle duration
- `setTicketLimits()` - Configure ticket limits for raffles
- `togglePrizedRaffles()` - Enable/disable prized raffles
- `setOperator()` - Manage authorized operators
- `addExternalCollection()` - Approve external NFT collections
- `setVRFParams()` - Configure Chainlink VRF parameters

**Benefits**:
- Protocol governance
- Flexible configuration management
- Secure access control
- Transparent parameter updates

### RaffleDeployer.sol
**Purpose**: Factory for deploying raffle instances

**Key Functions**:
- `createRaffle()` - Deploy new raffle instances
- `transferOwnershipToManager()` - Security ownership transfer

**Benefits**:
- Gas-efficient deployment via minimal proxies
- Standardized raffle creation process
- Automatic integration with protocol infrastructure

### Raffle.sol
**Purpose**: Individual raffle instance management

**Key Functions**:
- `initialize()` - Set up raffle parameters
- `activate()` - Handle raffle activation
- `purchaseTickets()` - Handle ticket sales
- `requestRandomness()` - Trigger winner selection
- `claimPrize()` - Distribute prizes to winners
- `deleteRaffle()` - Cancel raffles before ticket sales

**Benefits**:
- Complete raffle lifecycle management
- Secure prize distribution
- Flexible participation rules
- Automated raffle state transitions

### NFTFactory.sol
**Purpose**: Factory for prize collection deployment

**Key Functions**:
- `createPrizeCollection()` - Deploy ERC721/ERC1155 collections
- `validateSignature()` - Verify collection authenticity

**Benefits**:
- Standardized prize collection creation
- Built-in royalty support (ERC2981)
- Metadata and URI management
- Protocol integration features

### ERC721Prize.sol & ERC1155Prize.sol
**Purpose**: Prize collection contracts with protocol-specific features

**Key Features**:
- ERC2981 royalty standard support
- Protocol signature validation
- Minting controls and supply management
- Metadata URI configuration

## Features & Functionality

### 1. Raffle Types

#### Prized Raffles
- **ERC721 Prizes**: Unique NFT collections with auto-incrementing token IDs
- **ERC1155 Prizes**: Semi-fungible tokens with configurable amounts per winner
- **ERC20 Prizes**: Token prizes with whitelist management
- **ETH Prizes**: Native cryptocurrency prizes

#### Non-Prized Raffles (Whitelist Campaigns)
- Community engagement without physical prizes
- Access control for exclusive events or services
- Cost-effective community building

### 2. Prize Management

#### Escrowed Prizes
- Prizes held in raffle contract during the raffle period
- Automatic distribution to winners (via `claimPrize()`)
- Secure handling of valuable assets

#### Mintable Prizes (ERC721Drop and ERC1155Drop)
- On-demand minting during prize claims
- Gas-efficient for large collections
- Flexible supply management

### 3. Winner Selection

#### Chainlink VRF 2.5
- Provably fair randomness
- Tamper-proof winner selection
- On-chain verification

#### Batch Processing
- Efficient handling of large participant pools
- Gas-optimized winner selection
- Resumable processing for failed VRF requests

### 4. Revenue Management

#### Automatic Distribution
- Real-time revenue handling during ticket sales
- Configurable protocol fees
- Secure creator revenue handling

#### Refund Mechanisms
- Refunds for non-winning tickets (minus protocol fee) from custom ticket-priced raffles with mintable NFT prizes only
- Full refunds for deleted and unengaged raffles
- Configurable protocol fee percentages


## Use Cases & Benefits

### For Raffle Creators

### 1. NFT Project Launches
**Use Case**: Launch new NFT collections through engaging raffles

Rafflhub is designed to be your ultimate community engagement toolkit. Here’s how you can leverage the protocol to achieve your project’s goals.

Launch Your NFT Collection
Enough of the unfair traditional minting processes. Launch your next ERC-721 or ERC-1155 collection through a dynamic and engaging raffle where every participant has access and every entry has equal chance of eventually minting from the collection.

Benefits:

Fair Distribution: Let Chainlink's VRF ensure a provably fair distribution, building trust with your community from day one.

Winner-only Minting: Prizes can be minted on-demand when winners claim them, saving you gas and hassle.

Creator-inclusive Tokenomics: NFT Collection owners can mint up to 10% of the collection's supply for themselves.

Built-in Royalties: Automatically collect royalties on secondary sales with built-in ERC-2981 support.


### 2. Community Building
**Use Case**: Create exclusive access events or whitelist campaigns

Host Exclusive Token-Gated Events
Reward your most loyal supporters by creating raffles that only they can join.

Holder-Only Giveaways: Create a prized raffle where only holders of your project's NFT or ERC-20 token can participate.

Exclusive Whitelists: Run a non-prized raffle for a new project launch, but only allow holders of a partner project's token to enter.

Benefits:

Increase Holder Value: Directly reward the people who support your ecosystem.

Foster Collaboration: Create token-gated raffles for other communities to build powerful partnerships.

Prevent Bots & Sybil Attacks: Naturally filter participants to your true community members.

Cost-Effective: An incredibly cheap and efficient way to manage community access.

Automated & Scalable: Easily manage whitelist campaigns for communities of any size.


### 3. Token Distribution
**Use Case**: Distribute ERC20 tokens through fair raffles

Run classic giveaways with ERC-20 tokens or native coins like ETH or BNB, all handled securely on-chain.

Benefits:

Secure Escrow: The total prize amount is locked in the raffle contract, providing full transparency and guaranteeing payment to winners.

Fair & Transparent: Eliminate any doubts about fairness with Chainlink VRF selecting the winners.

Multi-Winner Support: Easily split a prize pool among multiple winners.


### 4. ETH Prize Campaigns
**Use Case**: Run cash prize raffles for community engagement

**Benefits**:
- Transparent prize distribution
- Automated winner selection
- Secure prize escrow
- Multi-winner support


### For Participants

### 1. Fair Participation

**Benefits**:
- Transparent ticket purchasing
- Provably fair onchain winner selection process
- Clear participation rules
- Direct prize claims

### 2. Multiple Entry Options

**Benefits**:
- Purchase multiple tickets per raffle
- Configurable participation limits
- Flexible entry strategies
- Cost-effective participation

### 3. Secure Prize Claims

**Benefits**:
- Direct prize claims
- Secure claim verification
- No manual intervention required
- Transparent claim process
- Guaranteed Prize Delivery: Prizes are either held in escrow by the contract or are guaranteed to be mintable, ensuring you always receive your prize if you win.

## Technical Specifications

### Smart Contract Standards

### ERC Standards Compliance
- **ERC721**: Full compliance with metadata and enumeration extensions
- **ERC1155**: Multi-token standard with batch operations
- **ERC2981**: Royalty standard for secondary sales
- **ERC20**: Standard token interface for prize tokens

### Security Standards
- **ReentrancyGuard**: Protection against reentrancy attacks
- **Ownable**: Secure ownership management
- **Pausable**: Emergency pause functionality
- **BatchProcessing**: Efficient batch operations

### Gas Optimization

### Minimal Proxy Pattern
- EIP-1167 implementation for gas-efficient deployment
- Shared implementation contracts
- Reduced deployment costs
- Scalable architecture

### Batch Processing
- Batch sizing based on participant pools
- Efficient winner selection algorithm
- Resumable processing for large participant pools
- Gas-optimized state management

### Chainlink Integration

### VRF 2.5
- Latest Chainlink VRF implementation
- Subscription-based model
- Configurable gas limits and confirmations
- Automatic consumer management

### Automation
- Reliable raffle lifecycle management
- Automated state transitions
- Fail-safe execution mechanisms

## Security Features

### Access Control
- **Role-based permissions**: Protocol admin, operators, creators
- **Function-level security**: Specific access controls for critical functions
- **Ownership management**: Secure transfer and renunciation mechanisms
- **Whitelist management**: Controlled access for external collections and ERC20 tokens

### State Management
- **Valid state transitions**: Enforced state machine logic
- **Atomic operations**: All-or-nothing transaction execution
- **State verification**: Comprehensive state checks before operations
- **Failure handling**: Graceful handling of failed operations

### Prize Security
- **Escrow mechanisms**: Secure prize holding during raffle period
- **Approval verification**: Secure minting and transfer permissions
- **Supply controls**: Prevention of oversupply and unauthorized minting
- **Royalty protection**: Secure royalty collection and distribution

### Randomness Security
- **Unrestricted access**: Every raffle participant can request randonmess
- **VRF verification**: On-chain randomness verification
- **Request validation**: Secure randomness request handling
- **Callback protection**: Secure VRF callback processing
- **Retry mechanisms**: Robust handling of failed VRF requests



## FAQ

### General Questions

**Q: What makes this protocol different from other raffle systems?**
A: The Raffle Protocol combines provably fair randomness (Chainlink VRF), automated execution (Chainlink Automation), multi-prize support (NFTs, ERC20, ETH), and gas-efficient deployment (minimal proxies) in a single, comprehensive solution.

**Q: How is randomness ensured to be fair?**
A: The protocol uses Chainlink VRF 2.5, which provides cryptographically secure, verifiable randomness that cannot be manipulated by any party, including miners or validators.

**Q: What happens if a raffle doesn't sell out?**
A: Raffles end when either the duration expires or all tickets are sold, whichever comes first. Winners are selected from all participants regardless of whether the raffle sold out.

### Technical Questions

**Q: How are gas costs optimized?**
A: The protocol uses minimal proxy patterns (EIP-1167) for gas-efficient deployment, batch processing for large operations, and optimized state management to minimize gas consumption.

**Q: Can I use my own NFT collection as prizes?**
A: Yes, NFTs from external collections can be approved by protocol operators and used as prizes in raffles, subject to approval and verification.

**Q: How are prizes distributed to winners?**
A: Prizes are distributed when individual winners call the `claimPrize()` function. The process is secure and trustless.

### Business Questions

**Q: What are the fees for using the protocol?**
A: Protocol fees are configurable by the protocol admin and typically include a percentage of ticket sales.

**Q: Can I create raffles without prizes?**
A: Yes, non-prized raffles (whitelist campaigns) are supported for community building and access control purposes.

**Q: How do royalties work for NFT prizes?**
A: NFT collections deployed through the protocol support ERC2981 royalty standard, allowing creators to earn royalties on secondary sales.

### Security Questions

**Q: What happens if Chainlink VRF fails?**
A: The protocol includes retry mechanisms and fallback procedures to handle VRF failures, ensuring raffles can still complete successfully.

**Q: Can raffles be cancelled or modified by raffle creators?**
A: Only NFT-prized raffles with custom ticket prices can be deleted. Deletion is only possible when such raffles are in the `Pending` and `Active` states. Participants are eligible to claim 100% of their ticket purchases from deleted raffles.

**Q: How is the protocol protected against attacks?**
A: The protocol implements comprehensive security measures including reentrancy protection, access controls, state validations, and secure prize handling mechanisms.

---

*This documentation is maintained by the Rafflhub team. For technical support or questions, please refer to the official channels or contact the development team.* 

