## FAQ

**Q: What makes this protocol different from other raffle systems?**
A: The Raffle Protocol combines provably fair randomness (Chainlink VRF), automated execution (Chainlink Automation), multi- winner support, multi-prize support (NFTs, ERC20, ETH), and gas-efficient deployment (minimal proxies) in a single, comprehensive solution.

**Q: How is randomness ensured for fairness?**
A: The protocol uses Chainlink VRF 2.5, which provides cryptographically secure, verifiable randomness that cannot be manipulated by any party.

**Q: Why do raffles need to be 'Activated'?**
A: The `activate()` function in raffle contracts was implemented to ensure that raffles meet the following requirements before they begin to accept entries;
i) all raffles must registered to the protocol's VRF subscription. This ensures that randomness can be requested for winner selection for all raffles.
ii) for NFT-prized raffles, each raffle contract checks and verifies that prize contracts contain enough items for all winners to claim.

**Q: Who can request randomness for raffles?**
A: All raffle participants can call `requestRandomWords()` in raffle contracts to initiate the winner selection process. 

**Q: What happens if all available tickets from a raffle doesn't sell out?**
A: If the raffle has enough participants for the required number of winners to be selected, the raffle will proceed to the drawing state and winners will be selected from available participants regardless of whether the raffle sold out. In the situation where raffles have fewer participants than the required number of winners, such raffles transition into the 'Unengaged' state and participants are able to claim refunds of all tickets purchased.

**Q: How are gas costs optimized?**
A: The protocol uses minimal proxy patterns (EIP-1167) for gas-efficient deployment, batch processing for large operations, and optimized state management to minimize gas consumption.

**Q: Can I use my own NFT collection as prizes?**
A: Yes, NFTs from external collections can be used as prizes in raffles only after such collections have been whitelisted.

**Q: How are prizes distributed to winners?**
A: Prizes are automatically distributed when winners call the `claimPrize()` function. The process is secure and requires no manual intervention from raffle creators.

**Q: What are the fees for using the protocol?**
A: Protocol fees are configurable and typically include a percentage of ticket sales and creator revenues.

**Q: Can I create raffles without prizes?**
A: Yes, non-prized raffles (whitelist campaigns) are supported for community building purposes. Creators of non-prized raffles can partner with owners of existing prize collections to assign such collections as prizes for their raffles. In cases of such collaborations, prize collections must be assigned and minter rights granted to raffle contracts before `activate()` is called. 

**Q: How do royalties work for NFT prizes?**
A: NFT collections deployed through the protocol support ERC2981 royalty standard, allowing creators to earn royalties on secondary sales. We also implemented an optional royalty enforcement feature which collection owners can activate at will.

**Q: What happens if Chainlink VRF callback fails?**
A: The protocol includes retry mechanisms and fallback procedures to handle VRF failures, ensuring raffles can still complete successfully.

**Q: Can raffles be deleted by raffle creators?**
A: Only NFT-prized raffles can be deleted. Deletion is only possible when such raffles are in the `Pending` and `Active` states. Participants can claim 100% refunds of their ticket fees from deleted raffles.

**Q: How is the protocol protected against attacks?**
A: The protocol implements comprehensive security measures including reentrancy protection, strict access controls, state validations, and secure prize handling mechanisms.