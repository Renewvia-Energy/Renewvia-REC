// SPDX-License-Identifier: GPLv3
pragma solidity ^0.8.25;

import "forge-std/Script.sol";
import "../src/templates/RenewviaREC.sol";
import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";

contract DeployMint is Script {
	address public constant PROXY             = 0x7cafD97dA50Fc8A7d8Ed45749a29aD6A64bfFaf1;  // Replace with contract address
	address public constant RECIPIENT         = 0x0400A72F71fec3a3060F2046d4fB103B345c0161;  // Replace with recipient's wallet address
	uint256 public constant AMOUNT            = 18;                                           // Replace with amount of tokens to mint
	string  public constant VERIFICATION_DATA = "https://raw.githubusercontent.com/Renewvia-Energy/Renewvia-REC/refs/heads/main/verification_data/Solarly_2024-01-01T000000-0000_2024-12-31T235959-0000.csv";                               // Replace with URL of verification data
	
	function run() public {
		vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

		RenewviaREC token = RenewviaREC(PROXY);

		token.mint(RECIPIENT, AMOUNT, VERIFICATION_DATA);

		vm.stopBroadcast();
	}
}