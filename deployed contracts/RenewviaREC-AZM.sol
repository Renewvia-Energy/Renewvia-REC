// SPDX-License-Identifier: GPLv3
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @custom:security-contact technical-africa@renewvia.com
contract RenewviaREC is ERC20, Pausable, Ownable {
	constructor(uint256 premint) ERC20("RenewviaREC-Zambia", "RREC-AZM") {
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