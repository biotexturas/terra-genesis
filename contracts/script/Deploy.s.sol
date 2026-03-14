// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {HardTrustRegistry} from "../src/HardTrustRegistry.sol";

contract Deploy is Script {
    function run() external {
        // Anvil account #0 private key
        uint256 deployerKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        // Anvil account #1 as attester
        address attester = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;

        vm.startBroadcast(deployerKey);
        HardTrustRegistry registry = new HardTrustRegistry(attester);
        vm.stopBroadcast();

        console.log("DEPLOYED:", address(registry));
    }
}
