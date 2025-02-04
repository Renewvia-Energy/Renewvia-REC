// SPDX-License-Identifier: GPLv3
pragma solidity ^0.8.9;

import "../openzeppelin/ERC20.sol";
import "../openzeppelin/Pausable.sol";
import "../openzeppelin/Ownable.sol";

/// @custom:security-contact technical-africa@renewvia.com
contract RenewviaREC is ERC20, Pausable, Ownable {
	constructor(uint256 premint) ERC20("Ember Grid Reduction Carbon Credit", "EGRCC") {
		_mint(msg.sender, premint * 10 ** decimals());
	}

	function pause() public onlyOwner {
		_pause();
	}

	function unpause() public onlyOwner {
		_unpause();
	}

	function mint(address to, uint256 amount) public onlyOwner {
		_mint(to, amount * 10 ** decimals());
	}

	function _beforeTokenTransfer(address from, address to, uint256 amount)
		internal
		whenNotPaused
		override
	{
		super._beforeTokenTransfer(from, to, amount);
	}
}