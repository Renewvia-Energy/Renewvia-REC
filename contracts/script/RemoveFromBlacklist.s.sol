// SPDX-License-Identifier: GPLv3
pragma solidity ^0.8.25;

import "forge-std/Script.sol";
import "../src/RenewviaREC.sol";

contract RRECScript is Script {
	address public constant PROXY                          = 0x923044109E13f83323d9DfF40BB746bC73358216;  // Replace with contract address
	address public constant WALLET_ADDRESS_FOR_UNBLACKLIST = 0x0400A72F71fec3a3060F2046d4fB103B345c0161;  // Replace with recipient's wallet address
	
	function run() public {
		vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

		RenewviaREC token = RenewviaREC(PROXY);

		token.removeFromBlacklist(WALLET_ADDRESS_FOR_UNBLACKLIST);

		vm.stopBroadcast();
	}
}