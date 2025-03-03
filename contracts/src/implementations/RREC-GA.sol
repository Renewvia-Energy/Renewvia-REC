// SPDX-License-Identifier: GPLv3
pragma solidity ^0.8.22;

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {ERC20PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import {ERC20PermitUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "../templates/BlacklistableUpgradeable.sol";

/// @title Cameroon R-RECs
/// @author Nicholas S. Selby
/// @custom:security-contact recs@renewvia.com
contract RenewviaREC is Initializable, ERC20Upgradeable, ERC20PausableUpgradeable, OwnableUpgradeable, ERC20PermitUpgradeable, UUPSUpgradeable, BlacklistableUpgradeable {
	event MintWithInfo(address indexed to, uint256 amount, string additionalInfo);

	/// @custom:oz-upgrades-unsafe-allow constructor
	constructor() {
		_disableInitializers();
	}

	function initialize(address initialOwner) public initializer {
		require(initialOwner != address(0), "Invalid owner address");
		__ERC20_init("Georgia R-REC", "RREC-GA");
		__ERC20Pausable_init();
		__Ownable_init(initialOwner);
		__ERC20Permit_init("Georgia R-REC");
		__UUPSUpgradeable_init();
	}

	function pause() public onlyOwner {
		_pause();
	}

	function unpause() public onlyOwner {
		_unpause();
	}

	function mint(address to, uint256 amount, string calldata additionalInfo) public onlyOwner notBlacklisted(to) {
		require(to != address(0), "Cannot mint to zero address");
		require(amount > 0, "Amount must be positive");
		
		uint256 maxAmount = type(uint256).max / (10 ** decimals());
		require(amount <= maxAmount, "Amount too large, would overflow");
		
		uint256 amountWithDecimals = amount * (10 ** decimals());
		
		_mint(to, amountWithDecimals);
		emit MintWithInfo(to, amount, additionalInfo);
	}

	function _authorizeUpgrade(address newImplementation)
		internal
		override
		onlyOwner
	{}

	function _update(address from, address to, uint256 value)
		internal
		override(ERC20Upgradeable, ERC20PausableUpgradeable)
	{
		if (from != address(0) && to != address(0)) {
			_checkBlacklist(from, to);
		}
		
		super._update(from, to, value);
	}
}