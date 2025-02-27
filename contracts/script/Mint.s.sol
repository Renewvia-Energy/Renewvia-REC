// SPDX-License-Identifier: GPLv3
pragma solidity ^0.8.25;

import "forge-std/Script.sol";
import "../src/templates/RenewviaREC.sol";
import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";

contract DeployMint is Script {
	address public constant PROXY             = 0x11491ac2583fe5a4D8e909Fff7DDea8DEB5C611e;  // Replace with contract address
	address public constant RECIPIENT         = 0x99EfB6689ccb45A5DCd974C2e620001A4805Ca03;  // Replace with recipient's wallet address
	uint256 public constant AMOUNT            = 10;                                          // Replace with amount of tokens to mint
	string  public constant VERIFICATION_DATA = "https://...";                               // Replace with URL of verification data
	
	function run() public {
		vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

		RenewviaREC token = RenewviaREC(PROXY);
		console.log("Current owner: ", token.owner());

		token.mint(RECIPIENT, AMOUNT, VERIFICATION_DATA);

		vm.stopBroadcast();
	}
}