// SPDX-License-Identifier: GPLv3
pragma solidity ^0.8.9;

import "./openzeppelin/ERC20.sol";
import "./openzeppelin/Pausable.sol";
import "./openzeppelin/Ownable.sol";

/// @title Renewvia's Blockchain-Based Renewable Energy Credits
/// @author Nicholas S. Selby
/// @notice This contract is a generic, fungible token that allows the contract owner the exclusive ability to mint new tokens and pause or unpause all transactions
/// @custom:security-contact technical-africa@renewvia.com
contract RenewviaREC is ERC20, Pausable, Ownable {
    constructor(uint256 premint) ERC20("RenewviaREC", "RREC") {
        _mint(msg.sender, premint * 10 ** decimals());
    }

    /// @notice Pause all transactions
    /// @dev Implements _pause() from OpenZeppelin's Pausable.sol
    function pause() public onlyOwner {
        _pause();
    }

    /// @notice Unpause all transactions after they've been paused
    /// @dev Implements _unpause() from OpenZeppelin's Pausable.sol
    function unpause() public onlyOwner {
        _unpause();
    }

    /// @notice Mint new tokens
    /// @dev Implements _mint() from OpenZeppelin's ERC20.sol
    /// @param to The wallet address to which to mint the new tokens
    /// @param amount The number of whole tokens to mint
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount * 10 ** decimals());
    }

    /// @notice Checks to make sure the contract is not paused before allowing transaction
    /// @dev Implements _beforeTokenTransfer() from OpenZeppelin's ERC20.sol
    /// @param from The wallet address sending the tokens
    /// @param to The wallet address receiving the tokens
    /// @param amount The quantity of tokens being transacted
    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        whenNotPaused
        override
    {
        super._beforeTokenTransfer(from, to, amount);
    }
}
