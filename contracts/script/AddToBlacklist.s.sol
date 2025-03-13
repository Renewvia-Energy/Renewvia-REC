// SPDX-License-Identifier: GPLv3
pragma solidity ^0.8.25;

import "forge-std/Script.sol";
import "../src/RenewviaREC.sol";

contract RRECScript is Script {
	address public constant PROXY                        = 0x0F6880db4445b82B5e652EFB6c50D51bE62bE164;  // Replace with contract address
	address public constant WALLET_ADDRESS_FOR_BLACKLIST = 0x0400A72F71fec3a3060F2046d4fB103B345c0161;  // Replace with recipient's wallet address
	
	function run() public {
		vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

		RenewviaREC token = RenewviaREC(PROXY);

		token.addToBlacklist(WALLET_ADDRESS_FOR_BLACKLIST);

		vm.stopBroadcast();
	}
}