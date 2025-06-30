// SPDX-License-Identifier: GPLv3
pragma solidity ^0.8.25;

import "forge-std/Script.sol";
import "../src/RenewviaREC.sol";

contract RRECScript is Script {
	address public constant PROXY     = 0x1E9c609Cc4F1801996eAe2E2b1171EdBefa2D871;  // Replace with contract address
	address public constant RECIPIENT = 0x3C546BE0e8069088f5A28E1aFdE26F1fe3Cd54d1;  // Replace with recipient's wallet address
	uint256 public constant AMOUNT    = 1787;                                          // Replace with amount of tokens to mint
	string  public constant V_DATA    = "https://raw.githubusercontent.com/Renewvia-Energy/Renewvia-REC/refs/heads/main/verification_data/ICP_2025-01-01T000000-0000_2025-06-26T000000-0000.csv";                               // Replace with URL of verification data

	function run() public {
		RenewviaREC token = RenewviaREC(PROXY);

		string memory userConfirmation = vm.prompt(string.concat(
			"=== Deployment Details ===\n",
			"Will send ", vm.toString(AMOUNT), " tokens of ", token.name(), " to ", vm.toString(RECIPIENT), "\n",
			"The verification data is located at ", V_DATA, "\n",
			"Do you want to proceed with deployment? (y/n)"));
        if (keccak256(abi.encodePacked(userConfirmation)) != keccak256(abi.encodePacked("y"))) {
            console.log("Deployment cancelled by user");
            return;
        }

		vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

		token.mint(RECIPIENT, AMOUNT, V_DATA);

		vm.stopBroadcast();
	}
}