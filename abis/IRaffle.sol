// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IRaffle {
    enum RaffleState { Pending, Active, Ended, Drawing, Completed, Deleted, ActivationFailed, AllPrizesClaimed, Unengaged }
    function state() external view returns (RaffleState);
    function prizeCollection() external view returns (address);
    function erc20PrizeToken() external view returns (address);
    function erc20PrizeAmount() external view returns (uint256);
    function ethPrizeAmount() external view returns (uint256);
}

interface IMintableERC721 {
    function mintMultiple(address to, uint256 quantity) external;
}

interface IMintableERC1155 {
    function mint(address to, uint256 id, uint256 amount) external;
    function mintMultiple(address to, uint256 id, uint256 quantity, uint256 amountPerMint) external;
}