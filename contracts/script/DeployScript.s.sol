// SPDX-License-Identifier: GPLv3
pragma solidity ^0.8.25;

import "forge-std/Script.sol";
import "../src/templates/RenewviaREC.sol";
import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";

contract DeployScript is Script {

	function run() external returns (address, address) {
		uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
		vm.startBroadcast(deployerPrivateKey);

		// Deploy the upgradeable contract
		address proxy = Upgrades.deployUUPSProxy(
			"RenewviaREC.sol",
			abi.encodeCall(RenewviaREC.initialize, (msg.sender))
		);

		// Get the implementation address
		address implementationAddress = Upgrades.getImplementationAddress(
			proxy
		);

		vm.stopBroadcast();

		return (implementationAddress, proxy);
	}
}
