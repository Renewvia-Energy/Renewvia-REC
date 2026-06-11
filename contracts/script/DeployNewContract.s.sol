// SPDX-License-Identifier: GPLv3
pragma solidity ^0.8.25;

import "forge-std/Script.sol";
import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";
import "../src/RenewviaREC.sol";

contract RRECScript is Script {
	function run() public {
		// Read deploy-specific values from .env file
		string memory name = vm.envString("DEPLOY_NAME");
		string memory symbol = vm.envString("DEPLOY_SYMBOL");

		string memory userConfirmation = vm.prompt(string.concat(
			"=== Deployment Details ===\n",
			"Will deploy contract ", name, " (", symbol, ")\n",
			"Do you want to proceed with deployment? (y/n)"));
		if (keccak256(abi.encodePacked(userConfirmation)) != keccak256(abi.encodePacked("y"))) {
			console.log("Deployment cancelled by user");
			return;
		}

		vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

		// Deploy the upgradeable contract
		address proxy = Upgrades.deployUUPSProxy(
			"RenewviaREC.sol:RenewviaREC",
			abi.encodeCall(RenewviaREC.initialize, (vm.envAddress("OWNER"), name, symbol))
		);

		RenewviaREC token = RenewviaREC(proxy);
		console.log("Owner: ", token.owner());
		console.log("Proxy: ", proxy);
		console.log("Implementation: ", Upgrades.getImplementationAddress(proxy));

		vm.stopBroadcast();
	}
}