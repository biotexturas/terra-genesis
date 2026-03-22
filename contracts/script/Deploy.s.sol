// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {HardTrustRegistry} from "../src/HardTrustRegistry.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address attester = vm.envAddress("ATTESTER_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);
        HardTrustRegistry registry = new HardTrustRegistry(attester);
        vm.stopBroadcast();

        console.log("HardTrustRegistry deployed at:", address(registry));
        console.log("Attester:", attester);
    }
}
