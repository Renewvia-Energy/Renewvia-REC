// SPDX-License-Identifier: GPLv3
pragma solidity ^0.8.25;

import "forge-std/Script.sol";
import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";
import "../src/implementations/RREC-AL.sol";                                       // REPLACE THIS WITH YOUR CONTRACT PATH

contract DeployNewContract is Script {
	string  public constant FILENAME = "RREC-AL.sol";                              // REPLACE THIS WITH YOUR CONTRACT FILENAME
	
	function run() public {
		vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

		// Deploy the upgradeable contract
		address proxy = Upgrades.deployUUPSProxy(
			string.concat(FILENAME, ":RenewviaREC"),
			abi.encodeCall(RenewviaREC.initialize, vm.envAddress("OWNER"))
		);

		RenewviaREC token = RenewviaREC(proxy);
		console.log("Owner: ", token.owner());
		console.log("Proxy: ", proxy);
		console.log("Implementation: ", Upgrades.getImplementationAddress(proxy));

		vm.stopBroadcast();
	}
}