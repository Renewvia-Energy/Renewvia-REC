// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.22;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title BlacklistableUpgradeable
 * @author [Nicholas S. Selby](https://github.com/rupumped/NicksAPPS/blob/main/Solidity/src/BlacklistableUpgradeable.sol)
 * @dev Allows addresses to be blacklisted by a contract owner
 * @dev In order for this to work like an actual blacklist, you need to add the following to your _update function in the implementation contract before super._update:
 * // Check blacklist status before executing transfer
 * _checkBlacklist(from, to);
 */
abstract contract BlacklistableUpgradeable is OwnableUpgradeable {
	mapping(address => bool) private _blacklisted;
	
	event BlacklistUpdated(address indexed account, bool isBlacklisted);
	
	/**
	 * @dev Checks if an account is blacklisted
	 * @param account The address to check
	 */
	function isBlacklisted(address account) public view returns (bool) {
		return _blacklisted[account];
	}
	
	/**
	 * @dev Adds an address to the blacklist
	 * @param account The address to blacklist
	 */
	function addToBlacklist(address account) external onlyOwner {
		require(account != address(0), "BlacklistableUpgradeable: invalid address");
		require(!_blacklisted[account], "BlacklistableUpgradeable: account already blacklisted");
		
		_blacklisted[account] = true;
		emit BlacklistUpdated(account, true);
	}
	
	/**
	 * @dev Removes an address from the blacklist
	 * @param account The address to remove from the blacklist
	 */
	function removeFromBlacklist(address account) external onlyOwner {
		require(account != address(0), "BlacklistableUpgradeable: invalid address");
		require(_blacklisted[account], "BlacklistableUpgradeable: account not blacklisted");
		
		_blacklisted[account] = false;
		emit BlacklistUpdated(account, false);
	}
	
	/**
	 * @dev Adds multiple addresses to the blacklist
	 * @param accounts Array of addresses to blacklist
	 */
	function batchBlacklist(address[] calldata accounts, bool blacklisted) external onlyOwner {
		require(accounts.length > 0, "BlacklistableUpgradeable: empty accounts array");
		
		for (uint256 i = 0; i < accounts.length; i++) {
			require(accounts[i] != address(0), string(abi.encodePacked("BlacklistableUpgradeable: invalid address in array at index ", Strings.toString(i))));
			if (_blacklisted[accounts[i]] != blacklisted) {
				_blacklisted[accounts[i]] = blacklisted;
				emit BlacklistUpdated(accounts[i], blacklisted);
			}
		}
	}
	
	/**
	 * @dev Modifier to make a function callable only when the caller is not blacklisted
	 */
	modifier notBlacklisted(address account) {
		require(!_blacklisted[account], "BlacklistableUpgradeable: account is blacklisted");
		_;
	}
	
	/**
	 * @dev Ensures neither the sender nor recipient is blacklisted
	 */
	function _checkBlacklist(address from, address to) internal view {
		require(!_blacklisted[from], "BlacklistableUpgradeable: sender is blacklisted");
		require(!_blacklisted[to], "BlacklistableUpgradeable: recipient is blacklisted");
	}
}