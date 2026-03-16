pub mod dev_config;

use alloy_primitives::{keccak256, Address};
use k256::ecdsa::VerifyingKey;
use serde::{Deserialize, Serialize};

/// Derives an Ethereum address from a secp256k1 public key.
///
/// Encodes the key as uncompressed bytes, strips the 0x04 prefix,
/// applies keccak256 to the 64-byte body, and returns the last 20 bytes.
pub fn public_key_to_address(pk: &VerifyingKey) -> Address {
    let encoded = pk.to_encoded_point(false);
    let bytes = encoded.as_bytes();
    // bytes[0] is 0x04 prefix; skip it
    let hash = keccak256(&bytes[1..]);
    Address::from_slice(&hash[12..])
}

/// A signed data reading emitted by a device.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Reading {
    pub serial: String,
    pub address: String,
    pub temperature: f64,
    pub timestamp: String,
    pub signature: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn public_key_to_address_matches_anvil_account_0() {
        use k256::ecdsa::SigningKey;
        let key_bytes =
            hex::decode("ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80")
                .expect("valid hex");
        let signing_key = SigningKey::from_slice(&key_bytes).expect("valid key");
        let verifying_key = signing_key.verifying_key();
        let address = public_key_to_address(verifying_key);
        let expected: Address = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
            .parse()
            .expect("valid address");
        assert_eq!(address, expected);
    }

    fn sample_reading() -> Reading {
        Reading {
            serial: "TEST-001".to_string(),
            address: "0xabcd".to_string(),
            temperature: 42.0,
            timestamp: "2026-01-01T00:00:00Z".to_string(),
            signature: "0xFAKESIG".to_string(),
        }
    }

    #[test]
    fn reading_serializes_to_json_with_all_fields() {
        let json = serde_json::to_string(&sample_reading()).expect("serialize");
        assert!(json.contains("serial"));
        assert!(json.contains("address"));
        assert!(json.contains("temperature"));
        assert!(json.contains("timestamp"));
        assert!(json.contains("signature"));
    }

    #[test]
    fn reading_round_trips_through_serde() {
        let reading = sample_reading();
        let json = serde_json::to_string(&reading).expect("serialize");
        let deserialized: Reading = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(reading, deserialized);
    }

    #[test]
    fn reading_missing_field_fails_to_deserialize() {
        let json = r#"{"serial":"X","address":"Y","temperature":1.0,"timestamp":"Z"}"#;
        let result = serde_json::from_str::<Reading>(json);
        assert!(result.is_err());
    }
}
