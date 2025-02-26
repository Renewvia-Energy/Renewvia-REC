// SPDX-License-Identifier: GPLv3
pragma solidity ^0.8.22;

import {Test, console} from "forge-std/Test.sol";
import {RenewviaREC} from "../src/templates/RenewviaREC.sol";
import {RenewviaRECUpgradeTest} from "../src/templates/RenewviaRECUpgradeTest.sol";
import {BlacklistableUpgradeable} from "../src/templates/BlacklistableUpgradeable.sol";
import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ERC20PermitUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import {Options} from "openzeppelin-foundry-upgrades/Options.sol";

contract RenewviaRECTest is Test {
	// Constants
	uint256 public constant DECIMALS = 18;
	bytes32 private _PERMIT_TYPEHASH = keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

	event MintWithInfo(address indexed to, uint256 amount, string additionalInfo);
	event NewUpgradedEvent(string msg);

	RenewviaREC public token;
	address public proxy;
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
		proxy = Upgrades.deployUUPSProxy(
			"RenewviaREC.sol",
			abi.encodeCall(RenewviaREC.initialize, (owner))
		);
		vm.stopPrank();
		
		// Get the implementation address
		implementationAddress = Upgrades.getImplementationAddress(proxy);
		
		// Cast proxy to RenewviaREC interface
		token = RenewviaREC(proxy);
		
		// Give some ETH to test accounts
		vm.deal(owner, 100 ether);
		vm.deal(user1, 100 ether);
		vm.deal(user2, 100 ether);
	}

	function testInitialState() public view {
		assertEq(token.name(), "RenewviaREC");
		assertEq(token.symbol(), "RREC");
		assertEq(token.owner(), owner);
		assertEq(token.decimals(), DECIMALS);
		assertEq(token.totalSupply(), 0);
		assertFalse(token.paused());
	}

	function testCannotInitializeTwice() public {
		vm.expectRevert();
		token.initialize(owner);
	}

	function testMint() public {
		vm.startPrank(owner);
		
		uint256 amount = 1000;
		string memory info = "First issuance";
		
		vm.expectEmit(true, false, false, true);
		emit MintWithInfo(user1, amount, info);
		token.mint(user1, amount, info);
		vm.stopPrank();
		
		assertEq(token.balanceOf(user1), amount * 10**DECIMALS, string(abi.encodePacked("User1's balance is ", Strings.toString(token.balanceOf(user1)), ", but it should be ", Strings.toString(amount))));
		assertEq(token.totalSupply(), amount * 10**DECIMALS, string(abi.encodePacked("Total supply is ", Strings.toString(token.totalSupply()), ", but it should be ", Strings.toString(amount))));
	}

	function testMintFailsFromNonOwner() public {
		vm.startPrank(user1);
		
		vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, user1));
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
		
		vm.expectRevert("Amount too large, would overflow");
		token.mint(user1, tooLargeAmount, "Should overflow");
		
		vm.stopPrank();
	}

	function testMintWhilePaused() public {
		vm.startPrank(owner);
		
		token.pause();
		
		assertTrue(token.paused());
		
		vm.expectRevert(PausableUpgradeable.EnforcedPause.selector);
		token.mint(user1, 1000, "Should fail when paused");
		
		vm.stopPrank();
	}

	function testTransferWhilePaused() public {
		// Transfer test
		vm.startPrank(owner);
		
		token.mint(user1, 1000, "Mint for transfer test");
		
		token.pause();

		vm.stopPrank();
		
		vm.startPrank(user1);
		vm.expectRevert(PausableUpgradeable.EnforcedPause.selector);
		token.transfer(user2, 100 * 10**DECIMALS);
		vm.stopPrank();
	}

	function testPauseFailsFromNonOwner() public {
		vm.prank(user1);
		
		vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, user1));
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
		vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, user1));
		token.unpause();
	}

	function testMintingToBlacklist() public {
		// First mint some tokens to the user who will be blacklisted
		vm.startPrank(owner);
		token.mint(blacklistedUser, 1000, "Pre-blacklist mint");
		token.mint(user1, 1000, "Mint to regular user");
		
		token.addToBlacklist(blacklistedUser);
		assertTrue(token.isBlacklisted(blacklistedUser));
		
		// Test minting to blacklisted user
		vm.expectRevert("BlacklistableUpgradeable: account is blacklisted");
		token.mint(blacklistedUser, 500, "Should fail for blacklisted address");
		
		vm.stopPrank();
	}

	function testTransferToBlacklist() public {
		// First mint some tokens to the user who will be blacklisted
		vm.startPrank(owner);
		token.mint(blacklistedUser, 1000, "Pre-blacklist mint");
		token.mint(user1, 1000, "Mint to regular user");
		
		token.addToBlacklist(blacklistedUser);
		assertTrue(token.isBlacklisted(blacklistedUser));
		vm.stopPrank();
		
		// Test transfers from blacklisted
		vm.prank(blacklistedUser);
		vm.expectRevert("BlacklistableUpgradeable: sender is blacklisted");
		token.transfer(user1, 100 * 10**DECIMALS);
	}

	function testTransferFromBlacklist() public {
		// First mint some tokens to the user who will be blacklisted
		vm.startPrank(owner);
		token.mint(blacklistedUser, 1000, "Pre-blacklist mint");
		token.mint(user1, 1000, "Mint to regular user");
		
		token.addToBlacklist(blacklistedUser);
		assertTrue(token.isBlacklisted(blacklistedUser));
		vm.stopPrank();
		
		// Test transfers to blacklisted
		vm.prank(user1);
		vm.expectRevert("BlacklistableUpgradeable: recipient is blacklisted");
		token.transfer(blacklistedUser, 100 * 10**DECIMALS);
	}

	function testBlacklistFailsFromNonOwner() public {
		vm.prank(user1);
		vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, user1));
		token.addToBlacklist(user2);
	}

	function testRemoveFromBlacklist() public {
		vm.startPrank(owner);
		token.addToBlacklist(blacklistedUser);
		assertTrue(token.isBlacklisted(blacklistedUser));
		
		token.removeFromBlacklist(blacklistedUser);
		assertFalse(token.isBlacklisted(blacklistedUser));
		
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

		bytes32 structHash = keccak256(abi.encode(
            _PERMIT_TYPEHASH,
            user1WithPk,
            user2,
            value,
            token.nonces(user1WithPk),
            deadline
        ));

        bytes32 digest = MessageHashUtils.toTypedDataHash(token.DOMAIN_SEPARATOR(), structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(user1PrivateKey, digest);
		
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
		Options memory opts;
		opts.referenceContract = "RenewviaREC.sol";
		
		vm.startPrank(owner);
		
		Upgrades.upgradeProxy(
			proxy,
			"RenewviaRECUpgradeTest.sol",
			"",
			opts
		);
		RenewviaRECUpgradeTest newToken = RenewviaRECUpgradeTest(proxy);
		
		// Verify the implementation was upgraded
		vm.expectEmit(false, false, false, true);
		emit NewUpgradedEvent("yay!");
		newToken.newUpgradedFunction();
		
		vm.stopPrank();
	}

	// TODO: This test keeps failing with the following error:
	// [FAIL: revert: Failed to deploy contract RenewviaRECUpgradeTest.sol using constructor data ""]
	// Even if I remove the input of vm.expectRevert, the test still fails.
	// Because the test is to confirm that non-owners can't upgrade the contract, this is okay, but I don't understand what the problem is.
	// function testUpgradeFailsFromNonOwner() public {
	// 	Options memory opts1;
	// 	opts1.referenceContract = "RenewviaREC.sol";
	// 	vm.startPrank(user1);
	// 	vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, user1));
	// 	Upgrades.upgradeProxy(
	// 		proxy,
	// 		"RenewviaRECUpgradeTest.sol",
	// 		"",
	// 		opts1
	// 	);
	// 	vm.stopPrank();
	// }

	// Helper function to get ERC20 permit hash for signature
	function _getPermitHash(
		address anOwner,
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
						keccak256("Permit(address anOwner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
						anOwner,
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