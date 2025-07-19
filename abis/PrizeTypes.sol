// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

library PrizeTypes {
    enum Standard { ERC721, ERC1155, ERC20, ETH }
    enum RevealType { Instant, Manual, Scheduled }
}