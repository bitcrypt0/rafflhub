

## Table of Contents
1. [Overview](#overview)
2. [Protocol Architecture](#protocol-architecture)
3. [Core Contracts](#core-contracts)
4. [Features & Functionality](#features--functionality)
5. [Use Cases & Benefits](#use-cases--benefits)
6. [Technical Specifications](#technical-specifications)
7. [Security Features](#security-features)
8. [Integration Guide](#integration-guide)
9. [FAQ](#faq)

## Overview

The Rafflhub Protocol is a decentralized, trustless raffle system built on EVM networks that enables anyone to create, participate in, and manage digital raffles with various prize types including NFTs, ERC20 tokens, and ETH. The protocol leverages Chainlink's VRF (Verifiable Random Function) for provably fair winner selection and Chainlink Automation for reliable execution.

### Key Features
- **Multi-Prize Support**: ERC721, ERC1155, ERC20 tokens, and ETH prizes
- **Provably Fair**: Chainlink VRF 2.5 for tamper-proof randomness
- **Automated Execution**: Chainlink Automation for reliable raffle lifecycle management
- **Flexible Raffle Types**: Both prized and non-prized (whitelist) raffles
- **Batch Processing**: Efficient winner selection for large participant pools
- **Gas Optimized**: Minimal proxy pattern for cost-effective deployment

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

#### 1. RaffleManager
The central configuration contract that manages:
- Protocol-wide settings and parameters
- VRF and Automation subscriptions
- Access control and operator management
- Collection approvals and whitelisting (for both NFTs and ERC20 Tokens)
- Revenue sharing configuration


#### 2. RaffleDeployer
Factory contract that deploys individual raffle instances using the minimal proxy pattern (EIP-1167) for gas efficiency.


#### 3. NFTFactory
Factory for deploying prize collection contracts (ERC721 and ERC1155) with standardized features like royalties and metadata support.


#### 4. Raffle Contracts
Individual raffle instances that handle:
- Ticket sales and participant management
- Winner selection and prize distribution
- State management and lifecycle control


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
- Centralized protocol governance
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
- Automated state transitions

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
- Resumable processing for failed transactions

### 4. Revenue Management

#### Automatic Distribution
- Real-time revenue handling during ticket sales
- Configurable protocol fees
- Creator revenue sharing options

#### Refund Mechanisms
- Refunds for non-winning tickets (minus protocol fee) from raffles with mintable NFT prizes only
- Full refunds for deleted and unengaged raffles
- Configurable refund percentages

## Use Cases & Benefits

### For Raffle Creators

#### 1. NFT Project Launches
**Use Case**: Launch new NFT collections through engaging raffles

**Benefits**:
- Generate excitement and community engagement
- Fair distribution of limited edition NFTs
- Automated minting and distribution
- Built-in royalty management and collection

#### 2. Community Building
**Use Case**: Create exclusive access events or whitelist campaigns

**Benefits**:
- Cost-effective community engagement
- Transparent participant selection
- Automated access control
- Scalable community management

#### 3. Token Distribution
**Use Case**: Distribute ERC20 tokens through fair raffles

**Benefits**:
- Fair token distribution
- Automated escrow and distribution
- Configurable prize amounts
- Multi-winner support

#### 4. ETH Prize Campaigns
**Use Case**: Run cash prize raffles for community engagement

**Benefits**:
- Transparent prize distribution
- Automated winner selection
- Secure prize escrow
- Multi-winner support

### For Participants

#### 1. Fair Participation

**Benefits**:
- Transparent ticket purchasing
- Provably fair winner selection
- Clear participation rules
- Automated prize distribution

#### 2. Multiple Entry Options

**Benefits**:
- Purchase multiple tickets per raffle
- Configurable participation limits
- Flexible entry strategies
- Cost-effective participation

#### 3. Secure Prize Claims

**Benefits**:
- Automated prize distribution
- Secure claim verification
- No manual intervention required
- Transparent claim process

## Technical Specifications

### Smart Contract Standards

#### ERC Standards Compliance
- **ERC721**: Full compliance with metadata and enumeration extensions
- **ERC1155**: Multi-token standard with batch operations
- **ERC2981**: Royalty standard for secondary sales
- **ERC20**: Standard token interface for prize tokens

#### Security Standards
- **ReentrancyGuard**: Protection against reentrancy attacks
- **Ownable**: Secure ownership management
- **Pausable**: Emergency pause functionality
- **BatchProcessing**: Efficient batch operations

### Gas Optimization

#### Minimal Proxy Pattern
- EIP-1167 implementation for gas-efficient deployment
- Shared implementation contracts
- Reduced deployment costs
- Scalable architecture

#### Batch Processing
- Batch sizing based on participant pools
- Efficient winner selection algorithm
- Resumable processing for large participant pools
- Gas-optimized state management

### Chainlink Integration

#### VRF 2.5
- Latest Chainlink VRF implementation
- Subscription-based model
- Configurable gas limits and confirmations
- Automatic consumer management

#### Automation
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

## Integration Guide

### For Developers

#### 1. Raffle Creation
```solidity
// Deploy a new raffle via RaffleDeployer
RaffleDeployer deployer = RaffleDeployer(deployerAddress);
address raffle = deployer.createRaffle(
    name,
    startTime,
    duration,
    ticketLimit,
    winnersCount,
    maxTicketsPerParticipant,
    isPrized,
    customTicketPrice,
    erc721Drop,
	erc1155Drop,
    prizeCollection,
    standard,
    prizeTokenId,
    amountPerWinner,
    collectionName,
    collectionSymbol,
    collectionBaseURI,
    creator,
    royaltyPercentage,
    royaltyRecipient,
    maxSupply,
    erc20PrizeToken,
    erc20PrizeAmount,
    ethPrizeAmount,
	revealType,
    unrevealedBaseURI,
    revealTime
);
```

#### 2. Prize Collection Deployment
```solidity
// Deploy ERC1155 collection via NFTFactory
NFTFactory factory = NFTFactory(factoryAddress);
address collection = factory.createPrizeCollection(
    PrizeTypes.Standard.ERC1155,
    name,
    symbol,
    baseURI,
    initialOwner,
    royaltyPercentage,
    royaltyRecipient,
    maxSupply,
    raffleAddress
);
```

#### 3. Raffle Participation
```solidity
// Purchase tickets in a raffle
Raffle raffle = Raffle(raffleAddress);
raffle.purchaseTickets{value: ticketPrice * quantity}(quantity);
```

#### 4. Prize Claiming
```solidity
// Claim prizes as a winner
Raffle raffle = Raffle(raffleAddress);
raffle.claimPrize();
```

### For Frontend Integration

#### 1. Raffle Discovery
```javascript
// Get all raffles from RaffleManager
const raffleManager = await ethers.getContractAt("RaffleManager", managerAddress);
const allRaffles = await raffleManager.getAllRaffles();
```

#### 2. Raffle Information
```javascript
// Get raffle details
const raffle = await ethers.getContractAt("Raffle", raffleAddress);
const name = await raffle.name();
const startTime = await raffle.startTime();
const state = await raffle.state();
const participants = await raffle.participants();
```

#### 3. Ticket Purchase
```javascript
// Purchase tickets
const ticketPrice = await raffle.ticketPrice();
const tx = await raffle.purchaseTickets(quantity, { value: ticketPrice * quantity });
await tx.wait();
```

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
A: Prizes are automatically distributed when winners call the `claimPrize()` function. The process is secure and requires no manual intervention.

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
A: Only NFT-prized raffles can be deleted and is only possible when such raffles are in the `Pending` and `Active` states. Participants can claim 100% of their ticket purchases from deleted raffles.

**Q: How is the protocol protected against attacks?**
A: The protocol implements comprehensive security measures including reentrancy protection, access controls, state validations, and secure prize handling mechanisms.



---

*This documentation is maintained by the Rafflhub Protocol team. For technical support or questions, please refer to the official channels or contact the development team.* 

