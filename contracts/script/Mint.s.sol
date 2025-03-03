// SPDX-License-Identifier: GPLv3
pragma solidity ^0.8.25;

import "forge-std/Script.sol";
import "../src/templates/RenewviaREC.sol";
import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";

contract DeployMint is Script {
	address public constant PROXY             = 0x8480e85664461471B8fCf058e1C2d31dd2568855;  // Replace with contract address
	address public constant RECIPIENT         = 0x9Db94E89DB9798544494a71C01E3552D6adE79bE;  // Replace with recipient's wallet address
	uint256 public constant AMOUNT            = 288;                                           // Replace with amount of tokens to mint
	string  public constant VERIFICATION_DATA = "https://raw.githubusercontent.com/Renewvia-Energy/Renewvia-REC/refs/heads/main/verification_data/SteelFabOfGA_2023-01-01T000000-0000_2023-12-31T000000-0000.csv";                               // Replace with URL of verification data
	
	function run() public {
		vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

		RenewviaREC token = RenewviaREC(PROXY);

		token.mint(RECIPIENT, AMOUNT, VERIFICATION_DATA);

		vm.stopBroadcast();
	}
}