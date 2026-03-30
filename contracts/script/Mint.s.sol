// SPDX-License-Identifier: GPLv3
pragma solidity ^0.8.25;

import "forge-std/Script.sol";
import "../src/RenewviaREC.sol";

contract RRECScript is Script {
	function run() public {
		// Read mint-specific values from .env file
		address proxy = vm.envAddress("MINT_PROXY");
		address recipient = vm.envAddress("MINT_RECIPIENT");
		uint256 amount = vm.envUint("MINT_AMOUNT");
		string memory vData = vm.envString("MINT_V_DATA");

		RenewviaREC token = RenewviaREC(proxy);

		string memory userConfirmation = vm.prompt(string.concat(
			"=== Deployment Details ===\n",
			"Will send ", vm.toString(amount), " tokens of ", token.name(), " to ", vm.toString(recipient), "\n",
			"The verification data is located at ", vData, "\n",
			"Do you want to proceed with deployment? (y/n)"));
        if (keccak256(abi.encodePacked(userConfirmation)) != keccak256(abi.encodePacked("y"))) {
            console.log("Deployment cancelled by user");
            return;
        }

		vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

		token.mint(recipient, amount, vData);

		vm.stopBroadcast();
	}
}