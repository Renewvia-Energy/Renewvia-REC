// SPDX-License-Identifier: GPLv3
pragma solidity ^0.8.25;

import "forge-std/Script.sol";
import "../src/RenewviaREC.sol";
import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";

contract DeployMint is Script {
	address public constant PROXY     = 0xE523Ef4D2e13EF85dD8048DB7182BA674aE01a08;  // Replace with contract address
	address public constant RECIPIENT = 0x9Db94E89DB9798544494a71C01E3552D6adE79bE;  // Replace with recipient's wallet address
	uint256 public constant AMOUNT    = 370;                                         // Replace with amount of tokens to mint
	string  public constant V_DATA    = "https://raw.githubusercontent.com/Renewvia-Energy/Renewvia-REC/refs/heads/main/verification_data/SteelFabofVA_2024-01-01T000000-0000_2025-01-01T000000-0000.csv";                               // Replace with URL of verification data
	
	function run() public {
		vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

		RenewviaREC token = RenewviaREC(PROXY);

		token.mint(RECIPIENT, AMOUNT, V_DATA);

		vm.stopBroadcast();
	}
}