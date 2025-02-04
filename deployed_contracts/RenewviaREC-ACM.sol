// SPDX-License-Identifier: GPLv3
pragma solidity ^0.8.20;

import "@openzeppelin/contracts@5.0.2/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts@5.0.2/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts@5.0.2/access/Ownable.sol";

contract RenewviaREC is ERC20, ERC20Pausable, Ownable {
	event MintWithInfo(address indexed to, uint256 amount, string additionalInfo);
	constructor(address initialOwner)
		ERC20("RenewviaREC-ACM", "RREC-ACM")
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

	// The following functions are overrides required by Solidity.
	function _update(address from, address to, uint256 value)
		internal
		override(ERC20, ERC20Pausable)
	{
		super._update(from, to, value);
	}
}