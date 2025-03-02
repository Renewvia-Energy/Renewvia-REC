// SPDX-License-Identifier: GPLv3
pragma solidity ^0.8.22;

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {ERC20PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import {ERC20PermitUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./BlacklistableUpgradeable.sol";

/// @title Renewvia RECs
/// @author Nicholas S. Selby
/// @notice This is a template ERC contract for tokenized carbon assets that is upgradeable, pausable, and ownable, and it has blacklist functionality
/// @dev Replace the strings in the initialize function to create new contracts for deployment
/// @custom:security-contact recs@renewvia.com
contract RenewviaREC is Initializable, ERC20Upgradeable, ERC20PausableUpgradeable, OwnableUpgradeable, ERC20PermitUpgradeable, UUPSUpgradeable, BlacklistableUpgradeable {
	/// @notice Emitted when tokens are minted, contains the verification information
	/// @param to Address that received the minted tokens
	/// @param amount Amount of tokens minted (without decimals)
	/// @param additionalInfo URL of the verification information
	event MintWithInfo(address indexed to, uint256 amount, string additionalInfo);

	/// @notice Constructor that disables initializers to prevent implementation contract initialization
	/// @dev This is required for UUPS upgradeable contracts to prevent initialization of the implementation
	/// @custom:oz-upgrades-unsafe-allow constructor
	constructor() {
		_disableInitializers();
	}

	/// @notice Initializes the contract with required parameters
	/// @dev Sets up the token name, symbol, and initial owner while initializing all inherited contracts
	/// @param initialOwner Address of the initial owner of the contract
	function initialize(address initialOwner) public initializer {
		require(initialOwner != address(0), "Invalid owner address");
		__ERC20_init("RenewviaREC", "RREC");
		__ERC20Pausable_init();
		__Ownable_init(initialOwner);
		__ERC20Permit_init("RenewviaREC");
		__UUPSUpgradeable_init();
	}

	/// @notice Pauses all token transfers
	/// @dev Can only be called by the contract owner
	function pause() public onlyOwner {
		_pause();
	}

	/// @notice Unpauses token transfers
	/// @dev Can only be called by the contract owner
	function unpause() public onlyOwner {
		_unpause();
	}

	/// @notice Mints new tokens to a specified address with verification information
	/// @dev Applies decimals to the amount before minting and emits a MintWithInfo event
	/// @param to Address to receive the minted tokens
	/// @param amount Amount of tokens to mint (without decimals)
	/// @param additionalInfo URL of the verification information
	function mint(address to, uint256 amount, string calldata additionalInfo) public onlyOwner notBlacklisted(to) {
		require(to != address(0), "Cannot mint to zero address");
		require(amount > 0, "Amount must be positive");
		
		// Check for potential overflow before performing multiplication
		// Max amount possible without overflow = (2^256 - 1) / 10^18
		uint256 maxAmount = type(uint256).max / (10 ** decimals());
		require(amount <= maxAmount, "Amount too large, would overflow");
		
		uint256 amountWithDecimals = amount * (10 ** decimals());
		
		_mint(to, amountWithDecimals);
		emit MintWithInfo(to, amount, additionalInfo);
	}

	/// @notice Authorizes an upgrade to a new implementation
	/// @dev This function is required by the UUPS pattern and restricts upgrades to the owner
	/// @param newImplementation Address of the new implementation contract
	function _authorizeUpgrade(address newImplementation)
		internal
		override
		onlyOwner
	{}

	/// @notice Updates token balances and enforces blacklist checks
	/// @dev Overrides the _update function from ERC20 to include blacklist checks and pausing functionality
	/// @param from Address tokens are transferred from
	/// @param to Address tokens are transferred to
	/// @param value Amount of tokens being transferred
	function _update(address from, address to, uint256 value)
		internal
		override(ERC20Upgradeable, ERC20PausableUpgradeable)
	{
		// Check blacklist status before executing transfer
		if (from != address(0) && to != address(0)) {
			_checkBlacklist(from, to);
		}
		
		super._update(from, to, value);
	}
}