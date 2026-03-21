// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {HardTrustRegistry} from "../src/HardTrustRegistry.sol";

contract HardTrustRegistryTest is Test {
    HardTrustRegistry registry;

    address deployer = address(0x1);
    address attesterAddr = address(0x2);
    address randomAddr = address(0x3);

    bytes32 serialHash = keccak256("TEST-SERIAL-001");
    address deviceAddr = address(0xDEAD);

    // Anvil account #0 private key (well-known test key)
    uint256 constant DEVICE_PK = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    address constant DEVICE_ADDR = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;

    // Shared test vector — MUST match protocol/src/lib.rs shared_test_vector_capture_prehash
    bytes32 constant SHARED_PREHASH = 0x0725f13a17d9bebdeca12211b44e120a1355ee9e23371c6addce2874b94a0528;

    function setUp() public {
        vm.prank(deployer);
        registry = new HardTrustRegistry(attesterAddr);
    }

    // --- Existing registration tests ---

    function test_attesterCanRegisterDevice() public {
        vm.prank(attesterAddr);
        registry.registerDevice(serialHash, deviceAddr);

        (address dAddr, address att, uint256 ts, bool active) = registry.getDevice(serialHash);
        assertEq(dAddr, deviceAddr);
        assertEq(att, attesterAddr);
        assertGt(ts, 0);
        assertTrue(active);
    }

    function test_nonAttesterCannotRegister() public {
        vm.prank(randomAddr);
        vm.expectRevert(HardTrustRegistry.NotAttester.selector);
        registry.registerDevice(serialHash, deviceAddr);
    }

    function test_unregisteredSerialReturnsZero() public view {
        bytes32 unknownHash = keccak256("UNKNOWN");
        (address dAddr, address att, uint256 ts, bool active) = registry.getDevice(unknownHash);
        assertEq(dAddr, address(0));
        assertEq(att, address(0));
        assertEq(ts, 0);
        assertFalse(active);
    }

    function test_isAttester() public view {
        assertTrue(registry.isAttester(attesterAddr));
        assertFalse(registry.isAttester(randomAddr));
    }

    function test_registerDevice_emitsEvent() public {
        vm.prank(attesterAddr);
        vm.expectEmit(true, true, true, true);
        emit HardTrustRegistry.DeviceRegistered(serialHash, deviceAddr, attesterAddr);
        registry.registerDevice(serialHash, deviceAddr);
    }

    function test_duplicateRegistration_reverts() public {
        vm.prank(attesterAddr);
        registry.registerDevice(serialHash, deviceAddr);

        address otherDevice = address(0xBEEF);
        vm.prank(attesterAddr);
        vm.expectRevert(abi.encodeWithSelector(HardTrustRegistry.DeviceAlreadyRegistered.selector, serialHash));
        registry.registerDevice(serialHash, otherDevice);
    }

    function test_duplicateRegistration_sameAddress_reverts() public {
        vm.prank(attesterAddr);
        registry.registerDevice(serialHash, deviceAddr);

        vm.prank(attesterAddr);
        vm.expectRevert(abi.encodeWithSelector(HardTrustRegistry.DeviceAlreadyRegistered.selector, serialHash));
        registry.registerDevice(serialHash, deviceAddr);
    }

    function test_duplicateRegistration_preservesOriginal() public {
        vm.prank(attesterAddr);
        registry.registerDevice(serialHash, deviceAddr);

        (address origAddr, address origAtt, uint256 origTs, bool origActive) = registry.getDevice(serialHash);

        address otherDevice = address(0xBEEF);
        vm.prank(attesterAddr);
        vm.expectRevert(abi.encodeWithSelector(HardTrustRegistry.DeviceAlreadyRegistered.selector, serialHash));
        registry.registerDevice(serialHash, otherDevice);

        (address dAddr, address att, uint256 ts, bool active) = registry.getDevice(serialHash);
        assertEq(dAddr, origAddr);
        assertEq(att, origAtt);
        assertEq(ts, origTs);
        assertEq(active, origActive);
    }

    function test_differentSerials_bothSucceed() public {
        bytes32 serial1 = keccak256("SERIAL-A");
        bytes32 serial2 = keccak256("SERIAL-B");
        address device1 = address(0xAA);
        address device2 = address(0xBB);

        vm.prank(attesterAddr);
        registry.registerDevice(serial1, device1);

        vm.prank(attesterAddr);
        registry.registerDevice(serial2, device2);

        (address d1,,, bool a1) = registry.getDevice(serial1);
        (address d2,,, bool a2) = registry.getDevice(serial2);
        assertEq(d1, device1);
        assertEq(d2, device2);
        assertTrue(a1);
        assertTrue(a2);
    }

    // --- registeredDevices mapping tests ---

    function test_registeredDevices_populated_on_register() public {
        assertFalse(registry.registeredDevices(deviceAddr));
        vm.prank(attesterAddr);
        registry.registerDevice(serialHash, deviceAddr);
        assertTrue(registry.registeredDevices(deviceAddr));
    }

    function test_registeredDevices_false_for_unregistered() public view {
        assertFalse(registry.registeredDevices(address(0x999)));
    }

    // --- verifyCapture tests (unified 6-param) ---

    bytes32 constant SCRIPT_HASH = bytes32(uint256(0xAABB));
    bytes32 constant BINARY_HASH = bytes32(uint256(0xCCDD));

    function test_verifyCapture_valid_device_skip_env() public {
        vm.prank(attesterAddr);
        registry.registerDevice(keccak256("TEST-SERIAL"), DEVICE_ADDR);

        bytes32 captureHash = keccak256("test capture data");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(DEVICE_PK, captureHash);

        (bool valid, address signer, bool sm, bool bm) =
            registry.verifyCapture(captureHash, v, r, s, bytes32(0), bytes32(0));
        assertTrue(valid);
        assertEq(signer, DEVICE_ADDR);
        assertFalse(sm);
        assertFalse(bm);
    }

    function test_verifyCapture_valid_device_matching_env() public {
        vm.prank(attesterAddr);
        registry.registerDevice(keccak256("TEST-SERIAL"), DEVICE_ADDR);
        vm.prank(attesterAddr);
        registry.setApprovedHashes(SCRIPT_HASH, BINARY_HASH);

        bytes32 captureHash = keccak256("test capture data");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(DEVICE_PK, captureHash);

        (bool valid, address signer, bool sm, bool bm) =
            registry.verifyCapture(captureHash, v, r, s, SCRIPT_HASH, BINARY_HASH);
        assertTrue(valid);
        assertEq(signer, DEVICE_ADDR);
        assertTrue(sm);
        assertTrue(bm);
    }

    function test_verifyCapture_valid_device_mismatched_env() public {
        vm.prank(attesterAddr);
        registry.registerDevice(keccak256("TEST-SERIAL"), DEVICE_ADDR);
        vm.prank(attesterAddr);
        registry.setApprovedHashes(SCRIPT_HASH, BINARY_HASH);

        bytes32 captureHash = keccak256("test capture data");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(DEVICE_PK, captureHash);

        (bool valid, address signer, bool sm, bool bm) =
            registry.verifyCapture(captureHash, v, r, s, bytes32(uint256(0x1111)), BINARY_HASH);
        assertTrue(valid);
        assertFalse(sm);
        assertTrue(bm);
    }

    function test_verifyCapture_unregistered_device() public {
        bytes32 captureHash = keccak256("test capture data");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(DEVICE_PK, captureHash);

        (bool valid, address signer,,) = registry.verifyCapture(captureHash, v, r, s, bytes32(0), bytes32(0));
        assertFalse(valid);
        assertEq(signer, DEVICE_ADDR);
    }

    function test_verifyCapture_invalid_signature_reverts() public {
        bytes32 captureHash = keccak256("test");
        vm.expectRevert();
        registry.verifyCapture(captureHash, 99, bytes32(uint256(1)), bytes32(uint256(2)), bytes32(0), bytes32(0));
    }

    function test_verifyCapture_no_approved_hashes_env_always_false() public {
        vm.prank(attesterAddr);
        registry.registerDevice(keccak256("TEST-SERIAL"), DEVICE_ADDR);

        bytes32 captureHash = keccak256("test capture data");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(DEVICE_PK, captureHash);

        // Pass env hashes but no approved hashes set → both false
        (bool valid,, bool sm, bool bm) = registry.verifyCapture(captureHash, v, r, s, SCRIPT_HASH, BINARY_HASH);
        assertTrue(valid);
        assertFalse(sm);
        assertFalse(bm);
    }

    function test_verifyCapture_tampered_hash() public {
        vm.prank(attesterAddr);
        registry.registerDevice(keccak256("TEST-SERIAL"), DEVICE_ADDR);

        bytes32 originalHash = keccak256("original");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(DEVICE_PK, originalHash);

        bytes32 tamperedHash = keccak256("tampered");
        (bool valid, address signer,,) = registry.verifyCapture(tamperedHash, v, r, s, bytes32(0), bytes32(0));
        assertFalse(valid);
        assertNotEq(signer, DEVICE_ADDR);
    }

    function test_verifyCapture_s_malleability_rejected() public {
        bytes32 captureHash = keccak256("test");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(DEVICE_PK, captureHash);

        uint256 secp256k1_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
        bytes32 flippedS = bytes32(secp256k1_N - uint256(s));
        uint8 flippedV = v == 27 ? 28 : 27;

        vm.expectRevert();
        registry.verifyCapture(captureHash, flippedV, r, flippedS, bytes32(0), bytes32(0));
    }

    // --- setApprovedHashes tests ---

    function test_setApprovedHashes_by_attester() public {
        vm.prank(attesterAddr);
        vm.expectEmit(false, false, false, true);
        emit HardTrustRegistry.EnvironmentHashesUpdated(SCRIPT_HASH, BINARY_HASH);
        registry.setApprovedHashes(SCRIPT_HASH, BINARY_HASH);

        assertEq(registry.approvedScriptHash(), SCRIPT_HASH);
        assertEq(registry.approvedBinaryHash(), BINARY_HASH);
    }

    function test_setApprovedHashes_by_non_attester_reverts() public {
        vm.prank(randomAddr);
        vm.expectRevert(HardTrustRegistry.NotAttester.selector);
        registry.setApprovedHashes(SCRIPT_HASH, BINARY_HASH);
    }

    // --- Shared test vector ---

    function test_shared_test_vector() public {
        vm.prank(attesterAddr);
        registry.registerDevice(keccak256("TERRASCOPE-TEST-001"), DEVICE_ADDR);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(DEVICE_PK, SHARED_PREHASH);

        (bool valid, address signer,,) = registry.verifyCapture(SHARED_PREHASH, v, r, s, bytes32(0), bytes32(0));
        assertTrue(valid, "shared test vector should verify");
        assertEq(signer, DEVICE_ADDR, "signer should be Anvil account #0");
    }

    // --- Fuzz test ---

    function testFuzz_verifyCapture_random_keys(uint256 pk, bytes32 captureHash) public {
        uint256 secp256k1_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
        pk = bound(pk, 1, secp256k1_N - 1);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, captureHash);
        address signer = vm.addr(pk);

        (bool valid, address recovered,,) = registry.verifyCapture(captureHash, v, r, s, bytes32(0), bytes32(0));
        assertFalse(valid);
        assertEq(recovered, signer);
    }
}
