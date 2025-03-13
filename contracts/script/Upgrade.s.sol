// SPDX-License-Identifier: GPLv3
pragma solidity ^0.8.25;

import {Options} from "openzeppelin-foundry-upgrades/Options.sol";
import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";
import "forge-std/Script.sol";
import "../src/RenewviaREC.sol";
// import "../src/UpgradedContract.sol";                                                        // Uncomment and replace with upgraded contract file path

contract RRECScript is Script {
	address public constant PROXY             = 0x0F6880db4445b82B5e652EFB6c50D51bE62bE164;  // Replace with contract address
	string  public constant UPGRADED_CONTRACT = "UpgradedContract.sol:UpgradedContract";     // Replace with upgraded contract filename and contract class name
	
	function run() public {
		vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

		Options memory opts;
		opts.referenceContract = "RenewviaREC.sol";
		
		Upgrades.upgradeProxy(
			PROXY,
			UPGRADED_CONTRACT,
			"",
			opts
		);
		// UpgradedContract newToken = UpgradedContract(proxy);

		vm.stopBroadcast();
	}
}