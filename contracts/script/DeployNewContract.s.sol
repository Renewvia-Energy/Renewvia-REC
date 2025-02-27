// SPDX-License-Identifier: GPLv3
pragma solidity ^0.8.25;

import "forge-std/Script.sol";
import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";
import "../src/templates/RenewviaREC.sol";                             // REPLACE THIS WITH YOUR CONTRACT PATH

contract DeployNewContract is Script {
	address public constant OWNER             = 0xF9C289f1C0341fb336224958a885163F5017BC16;  // Don't change this
	
	function run() public {
		vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

		// Deploy the upgradeable contract
		address proxy = Upgrades.deployUUPSProxy(
			"RenewviaREC.sol",                                         // REPLACE THIS WITH YOUR CONTRACT FILENAME
			abi.encodeCall(RenewviaREC.initialize, OWNER)       // REPLACE "RenewviaREC" WITH YOUR CONTRACT CLASS NAME
		);

		RenewviaREC token = RenewviaREC(proxy);
		console.log("Owner: ", token.owner());
		console.log("Proxy: ", proxy);
		console.log("Implementation: ", Upgrades.getImplementationAddress(proxy));

		vm.stopBroadcast();
	}
}
