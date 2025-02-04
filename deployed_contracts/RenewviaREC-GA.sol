// SPDX-License-Identifier: GPLv3
pragma solidity ^0.8.20;

import "../openzeppelin/ERC20.sol";
import "../openzeppelin/ERC20Pausable.sol";
import "../openzeppelin/Ownable.sol";

contract RenewviaREC is ERC20, ERC20Pausable, Ownable {
	event MintWithInfo(address indexed to, uint256 amount, string additionalInfo);
	constructor(address initialOwner)
		ERC20("RenewviaREC-GA", "RREC-GA")
		Ownable(initialOwner)
	{ }

	function pause() public onlyOwner {
		_pause();
	}

	function unpause() public onlyOwner {
		_unpause();
	}

	function mint(address to, uint256 amount, string calldata additionalInfo) public onlyOwner {
		_mint(to, amount * 10 ** decimals());
		emit MintWithInfo(to, amount, additionalInfo);
	}

	function _update(address from, address to, uint256 value)
		internal
		override(ERC20, ERC20Pausable)
	{
		super._update(from, to, value);
	}
}