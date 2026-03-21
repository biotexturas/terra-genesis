// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title HardTrustRegistry
/// @notice Minimal device registry — an authorized attester registers devices on-chain.
contract HardTrustRegistry {
    struct Device {
        address deviceAddr;
        address attester;
        uint256 attestedAt;
        bool active;
    }

    error NotAttester();
    error DeviceAlreadyRegistered(bytes32 serialHash);

    event DeviceRegistered(bytes32 indexed serialHash, address indexed deviceAddr, address indexed attester);
    event EnvironmentHashesUpdated(bytes32 scriptHash, bytes32 binaryHash);

    address public immutable ATTESTER;

    mapping(bytes32 => Device) private devices;
    mapping(address => bool) public registeredDevices;

    bytes32 public approvedScriptHash;
    bytes32 public approvedBinaryHash;

    constructor(address _attester) {
        ATTESTER = _attester;
    }

    /// @notice Register a device. Only the authorized attester may call this.
    /// @param serialHash keccak256 of the device hardware serial number
    /// @param deviceAddr Ethereum address derived from the device's public key
    function registerDevice(bytes32 serialHash, address deviceAddr) external {
        if (msg.sender != ATTESTER) revert NotAttester();
        if (devices[serialHash].active) revert DeviceAlreadyRegistered(serialHash);
        devices[serialHash] =
            Device({deviceAddr: deviceAddr, attester: msg.sender, attestedAt: block.timestamp, active: true});
        registeredDevices[deviceAddr] = true;
        emit DeviceRegistered(serialHash, deviceAddr, msg.sender);
    }

    /// @notice Query a device record by serial hash. Returns zero values if not found.
    function getDevice(bytes32 serialHash)
        external
        view
        returns (address deviceAddr, address attester_, uint256 attestedAt, bool active)
    {
        Device storage d = devices[serialHash];
        return (d.deviceAddr, d.attester, d.attestedAt, d.active);
    }

    /// @notice Check whether an address is the authorized attester.
    function isAttester(address addr) external view returns (bool) {
        return addr == ATTESTER;
    }

    /// @notice Update the approved environment hashes for the current release.
    /// @param scriptHash SHA-256 of the official capture script (as bytes32).
    /// @param binaryHash SHA-256 of the official device binary (as bytes32).
    function setApprovedHashes(bytes32 scriptHash, bytes32 binaryHash) external {
        if (msg.sender != ATTESTER) revert NotAttester();
        approvedScriptHash = scriptHash;
        approvedBinaryHash = binaryHash;
        emit EnvironmentHashesUpdated(scriptHash, binaryHash);
    }

    /// @notice Verify a device-signed capture on-chain: signature + device registration + environment.
    /// @param captureHash The keccak256 prehash that the device signed.
    /// @param v Signature recovery id (27 or 28).
    /// @param r Signature r component.
    /// @param s Signature s component.
    /// @param scriptHash SHA-256 of the capture script (bytes32). Pass bytes32(0) to skip env check.
    /// @param binaryHash SHA-256 of the device binary (bytes32). Pass bytes32(0) to skip env check.
    /// @return valid True if signer is a registered device.
    /// @return signer The recovered address.
    /// @return scriptMatch True if scriptHash matches approved (false if skipped or no approved hash set).
    /// @return binaryMatch True if binaryHash matches approved (false if skipped or no approved hash set).
    function verifyCapture(bytes32 captureHash, uint8 v, bytes32 r, bytes32 s, bytes32 scriptHash, bytes32 binaryHash)
        external
        view
        returns (bool valid, address signer, bool scriptMatch, bool binaryMatch)
    {
        signer = ECDSA.recover(captureHash, v, r, s);
        valid = registeredDevices[signer];

        if (scriptHash != bytes32(0) && approvedScriptHash != bytes32(0)) {
            scriptMatch = (scriptHash == approvedScriptHash);
        }
        if (binaryHash != bytes32(0) && approvedBinaryHash != bytes32(0)) {
            binaryMatch = (binaryHash == approvedBinaryHash);
        }
    }
}
