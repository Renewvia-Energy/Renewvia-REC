// SPDX-License-Identifier: GPLv3
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyToken is ERC20, ERC20Pausable, Ownable {
	constructor(address initialOwner)
		ERC20("AVERT-US Carbon Credit", "AVERT-USCC")
		Ownable(initialOwner)
	{}

	function pause() public onlyOwner {
		_pause();
	}

	function unpause() public onlyOwner {
		_unpause();
	}

	function mint(address to, uint256 amount) public onlyOwner {
		_mint(to, amount);
	}

	function _update(address from, address to, uint256 value)
		internal
		override(ERC20, ERC20Pausable)
	{
		super._update(from, to, value);
	}
}