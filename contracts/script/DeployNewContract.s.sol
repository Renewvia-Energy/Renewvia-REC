// SPDX-License-Identifier: GPLv3
pragma solidity ^0.8.25;

import "forge-std/Script.sol";
import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";
import "../src/RenewviaREC.sol";

contract DeployNewContract is Script {
	string public constant NAME   = "Cameroon R-RECs";
	string public constant SYMBOL = "RREC-ACM";
	
	function run() public {
		vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

		// Deploy the upgradeable contract
		address proxy = Upgrades.deployUUPSProxy(
			"RenewviaREC.sol:RenewviaREC",
			abi.encodeCall(RenewviaREC.initialize, (vm.envAddress("OWNER"), NAME, SYMBOL))
		);

		RenewviaREC token = RenewviaREC(proxy);
		console.log("Owner: ", token.owner());
		console.log("Proxy: ", proxy);
		console.log("Implementation: ", Upgrades.getImplementationAddress(proxy));

		vm.stopBroadcast();
	}
}