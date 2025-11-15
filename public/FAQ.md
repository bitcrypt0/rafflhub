## FAQ

**Q: What makes Dropr different from other raffle systems?**
A: Dropr combines provably fair randomness (Chainlink VRF), automated execution (Chainlink Automation), multi- winner support, multi-prize support (NFTs, ERC20, ETH), and gas-efficient deployment (minimal proxies) in a single, comprehensive solution.

**Q: How is randomness ensured for fairness?**
A: Dropr uses Chainlink VRF 2.5, which provides cryptographically secure, verifiable randomness that cannot be manipulated by any party.

**Q: Who can request randomness for raffles?**
A: All raffle participants are eligible to call `requestRandomWords()` in raffle pool contracts to initiate the winner selection process. 

**Q: What happens if all available slots from a raffle doesn't sell out?**
A: If the raffle had enough participants for the required number of winners to be selected, the raffle will proceed to the drawing state and winners will be selected from available participants. However, for scenarios where raffles have fewer participants than the required number of winners, such raffles transition into the 'Unengaged' state and participants are able to claim refunds of all purchased slots.

**Q: Can I use my own NFT collection as prizes?**
A: Yes, NFTs from external collections can be used as prizes in raffles but only after such collections have been whitelisted.

**Q: How are prizes distributed to winners?**
A: Prizes are transfered to winners when the `claimPrize()` function is called. The process is secure and requires no manual intervention from raffle creators. 

**Q: Can raffles be deleted by raffle creators?**
A: Only NFT-prized raffles can be deleted. Also, deletion is only possible when such raffles are in the `Pending` and `Active` states. Participants can claim 100% refunds of purchased slots from deleted raffles.

**Q: How is the protocol protected against attacks?**
A: The protocol implements comprehensive security measures including reentrancy protection, strict access controls, state validations, and secure prize handling mechanisms.