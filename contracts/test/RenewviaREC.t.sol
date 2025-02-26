// SPDX-License-Identifier: GPLv3
pragma solidity ^0.8.22;

import {Test, console} from "forge-std/Test.sol";
import {RenewviaREC} from "../src/templates/RenewviaREC.sol";
import {BlacklistableUpgradeable} from "../src/templates/BlacklistableUpgradeable.sol";
import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";
import {Options} from "openzeppelin-foundry-upgrades/Options.sol";

contract RenewviaRECTest is Test {
	// Constants
	uint256 public constant DECIMALS = 18;

	RenewviaREC public token;
	address public owner;
	address public user1;
	address public user2;
	address public blacklistedUser;
	address public implementationAddress;
	address public newImplementation;

	function setUp() public {
		// Set up accounts
		owner = makeAddr("owner");
		user1 = makeAddr("user1");
		user2 = makeAddr("user2");
		blacklistedUser = makeAddr("blacklistedUser");
		
		// Deploy the upgradeable contract using OZ Upgrades library
		vm.startPrank(owner);
		address proxy = Upgrades.deployUUPSProxy(
			"RenewviaREC.sol",
			abi.encodeCall(RenewviaREC.initialize, (owner))
		);
		vm.stopPrank();
		
		// Get the implementation address
		implementationAddress = Upgrades.getImplementationAddress(proxy);
		
		// Cast proxy to RenewviaREC interface
		token = RenewviaREC(proxy);
		
		// Prepare a new implementation for upgrade tests
		// Upgrades.Options memory opts = Upgrades.Options({referenceContract: implementationAddress});
		// Options memory opts = Options({
		//     referenceContract: implementationAddress,
		//     constructorData: bytes(""),
		//     unsafeAllow: new string[](0),
		//     unsafeAllowRenames: false, 
		//     unsafeSkipStorageCheck: false,
		//     useDeployedImplementation: false,
		//     kind: "uups",
		//     saltNonce: ""
		// });
		// vm.startPrank(owner);
		// newImplementation = Upgrades.prepareUpgrade(proxy, opts);
		// vm.stopPrank();
		
		// Give some ETH to test accounts
		vm.deal(owner, 100 ether);
		vm.deal(user1, 100 ether);
		vm.deal(user2, 100 ether);
	}

	function testInitialState() public {
		assertEq(token.name(), "RenewviaREC");
		assertEq(token.symbol(), "RREC");
		assertEq(token.owner(), owner);
		assertEq(token.decimals(), DECIMALS);
		assertEq(token.totalSupply(), 0);
		assertFalse(token.paused());
	}

	function testInitializeWithZeroAddress() public {
		vm.expectRevert("Invalid owner address");
		
		Upgrades.deployUUPSProxy(
			"RenewviaREC.sol",
			abi.encodeCall(RenewviaREC.initialize, (address(0)))
		);
	}

	function testCannotInitializeTwice() public {
		vm.expectRevert();
		token.initialize(owner);
	}

	function testMint() public {
		vm.startPrank(owner);
		
		uint256 amount = 1000;
		string memory info = "First issuance";
		
		vm.expectEmit();        
		token.mint(user1, amount, info);
		vm.stopPrank();
		
		assertEq(token.balanceOf(user1), amount * 10**DECIMALS);
		assertEq(token.totalSupply(), amount * 10**DECIMALS);
	}

	function testMintFailsFromNonOwner() public {
		vm.startPrank(user1);
		
		vm.expectRevert("Ownable: caller is not the owner");
		token.mint(user2, 1000, "Should fail");
		
		vm.stopPrank();
	}

	function testMintToZeroAddress() public {
		vm.startPrank(owner);
		
		vm.expectRevert("Cannot mint to zero address");
		token.mint(address(0), 1000, "Should fail");
		
		vm.stopPrank();
	}

	function testMintZeroAmount() public {
		vm.startPrank(owner);
		
		vm.expectRevert("Amount must be positive");
		token.mint(user1, 0, "Should fail");
		
		vm.stopPrank();
	}

	function testMintOverflow() public {
		vm.startPrank(owner);
		
		uint256 maxUint = type(uint256).max;
		uint256 tooLargeAmount = maxUint / 10**DECIMALS + 1;
		
		vm.expectRevert("Amount overflow");
		token.mint(user1, tooLargeAmount, "Should overflow");
		
		vm.stopPrank();
	}

	function testPause() public {
		vm.startPrank(owner);
		
		token.pause();
		
		assertTrue(token.paused());
		
		vm.expectRevert("ERC20Pausable: token transfer while paused");
		token.mint(user1, 1000, "Should fail when paused");
		
		vm.stopPrank();
		
		// Transfer test
		vm.prank(owner);
		token.unpause();
		
		vm.prank(owner);
		token.mint(user1, 1000, "Mint for transfer test");
		
		vm.prank(owner);
		token.pause();
		
		vm.prank(user1);
		vm.expectRevert("ERC20Pausable: token transfer while paused");
		token.transfer(user2, 100 * 10**18);
	}

	function testPauseFailsFromNonOwner() public {
		vm.prank(user1);
		
		vm.expectRevert("Ownable: caller is not the owner");
		token.pause();
	}

	function testUnpause() public {
		vm.startPrank(owner);
		
		token.pause();
		assertTrue(token.paused());
		
		token.unpause();
		assertFalse(token.paused());
		
		token.mint(user1, 1000, "Should work after unpause");
		assertEq(token.balanceOf(user1), 1000 * 10**18);
		
		vm.stopPrank();
	}

	function testUnpauseFailsFromNonOwner() public {
		vm.prank(owner);
		token.pause();
		
		vm.prank(user1);
		vm.expectRevert("Ownable: caller is not the owner");
		token.unpause();
	}

	function testBlacklist() public {
		// First mint some tokens to the user who will be blacklisted
		vm.startPrank(owner);
		token.mint(blacklistedUser, 1000, "Pre-blacklist mint");
		token.mint(user1, 1000, "Mint to regular user");
		
		token.addToBlacklist(blacklistedUser);
		assertTrue(token.isBlacklisted(blacklistedUser));
		
		// Test minting to blacklisted user
		vm.expectRevert("Address is blacklisted");
		token.mint(blacklistedUser, 500, "Should fail for blacklisted address");
		
		// Test transfers from blacklisted
		vm.stopPrank();
		
		vm.prank(blacklistedUser);
		vm.expectRevert("Sender is blacklisted");
		token.transfer(user1, 100 * 10**DECIMALS);
		
		// Test transfers to blacklisted
		vm.prank(user1);
		vm.expectRevert("Recipient is blacklisted");
		token.transfer(blacklistedUser, 100 * 10**DECIMALS);
	}

	function testBlacklistFailsFromNonOwner() public {
		vm.prank(user1);
		vm.expectRevert("Ownable: caller is not the owner");
		token.addToBlacklist(user2);
	}

	function testRemoveFromBlacklist() public {
		vm.startPrank(owner);
		token.addToBlacklist(blacklistedUser);
		assertTrue(blacklistable.isBlacklisted(blacklistedUser));
		
		blacklistable.removeFromBlacklist(blacklistedUser);
		assertFalse(blacklistable.isBlacklisted(blacklistedUser));
		
		// User should be able to receive tokens now
		token.mint(blacklistedUser, 500, "After removal from blacklist");
		assertEq(token.balanceOf(blacklistedUser), 500 * 10**DECIMALS);
		
		vm.stopPrank();
	}

	function testTransfer() public {
		vm.prank(owner);
		token.mint(user1, 1000, "Mint for transfer test");
		
		vm.prank(user1);
		token.transfer(user2, 300 * 10**DECIMALS);
		
		assertEq(token.balanceOf(user1), 700 * 10**DECIMALS);
		assertEq(token.balanceOf(user2), 300 * 10**DECIMALS);
	}

	function testPermit() public {
		uint256 user1PrivateKey = 0xABCD;
		address user1WithPk = vm.addr(user1PrivateKey);
		
		vm.prank(owner);
		token.mint(user1WithPk, 1000, "Mint for permit test");
		
		uint256 deadline = block.timestamp + 1 hours;
		uint256 value = 100 * 10**DECIMALS;
		
		// Generate permit signature
		bytes32 permitHash = _getPermitHash(
			user1WithPk,
			user2,
			value,
			token.nonces(user1WithPk),
			deadline
		);
		
		(uint8 v, bytes32 r, bytes32 s) = vm.sign(user1PrivateKey, permitHash);
		
		// Execute permit
		token.permit(user1WithPk, user2, value, deadline, v, r, s);
		
		// Check allowance is set
		assertEq(token.allowance(user1WithPk, user2), value);
		
		// Test that user2 can transferFrom user1's tokens
		vm.prank(user2);
		token.transferFrom(user1WithPk, user2, value);
		
		assertEq(token.balanceOf(user1WithPk), 900 * 10**DECIMALS);
		assertEq(token.balanceOf(user2), value);
	}

	function testUpgrade() public {
		vm.startPrank(owner);
		
		Upgrades.upgradeProxy(
			address(token),
			newImplementation,
			""
		);
		
		// Verify the implementation was upgraded
		address newImpl = Upgrades.getImplementationAddress(address(token));
		assertEq(newImpl, newImplementation);
		
		vm.stopPrank();
	}

	function testUpgradeFailsFromNonOwner() public {
		vm.prank(user1);
		
		vm.expectRevert("Ownable: caller is not the owner");
		Upgrades.upgradeProxy(
			address(token),
			newImplementation,
			""
		);
	}

	// Helper function to get ERC20 permit hash for signature
	function _getPermitHash(
		address owner,
		address spender,
		uint256 value,
		uint256 nonce,
		uint256 deadline
	) internal view returns (bytes32) {
		bytes32 DOMAIN_SEPARATOR = token.DOMAIN_SEPARATOR();
		
		return keccak256(
			abi.encodePacked(
				"\x19\x01",
				DOMAIN_SEPARATOR,
				keccak256(
					abi.encode(
						keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
						owner,
						spender,
						value,
						nonce,
						deadline
					)
				)
			)
		);
	}
}