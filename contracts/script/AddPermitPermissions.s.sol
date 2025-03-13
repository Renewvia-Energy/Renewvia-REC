// SPDX-License-Identifier: GPLv3
pragma solidity ^0.8.25;

import {ERC20PermitUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "forge-std/Script.sol";
import "../src/RenewviaREC.sol";

contract RRECScript is Script {
	address public constant PROXY                    = 0x7cafD97dA50Fc8A7d8Ed45749a29aD6A64bfFaf1;  // Replace with contract address
	uint256 public constant PRIVATE_KEY_OF_PERMITTER = 0xABCD;
	address public constant ADDRESS_OF_PERMITTED     = 0xd7da9f7F37954eB4E7b8CD14c9FFCC6d476C26Ea;  // Replace with wallet address of account to receive permit permission
	uint256 public constant ALLOWANCE                = 100;                                         // Replace with number of tokens to give permission to transfer
	uint256 public constant DURATION                 = 1 hours;					                    // Replace with duration after script execution after which permit permissions expire
	
	function run() public {
		vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

		RenewviaREC token = RenewviaREC(PROXY);
		address user1WithPk = vm.addr(PRIVATE_KEY_OF_PERMITTER);
		uint256 deadline = block.timestamp + DURATION;
		uint256 value = ALLOWANCE * 10**token.decimals();
		bytes32 structHash = keccak256(abi.encode(
			keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
			user1WithPk,
			ADDRESS_OF_PERMITTED,
			value,
			token.nonces(user1WithPk),
			deadline
		));
		bytes32 digest = MessageHashUtils.toTypedDataHash(token.DOMAIN_SEPARATOR(), structHash);
		(uint8 v, bytes32 r, bytes32 s) = vm.sign(PRIVATE_KEY_OF_PERMITTER, digest);
		
		// Execute permit
		token.permit(user1WithPk, ADDRESS_OF_PERMITTED, value, deadline, v, r, s);

		vm.stopBroadcast();
	}
}