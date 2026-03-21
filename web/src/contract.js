export const registryAbi = [
  {
    type: "constructor",
    inputs: [{ name: "_attester", type: "address", internalType: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "ATTESTER",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getDevice",
    inputs: [{ name: "serialHash", type: "bytes32", internalType: "bytes32" }],
    outputs: [
      { name: "deviceAddr", type: "address", internalType: "address" },
      { name: "attester_", type: "address", internalType: "address" },
      { name: "attestedAt", type: "uint256", internalType: "uint256" },
      { name: "active", type: "bool", internalType: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "approvedBinaryHash",
    inputs: [],
    outputs: [{ name: "", type: "bytes32", internalType: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "approvedScriptHash",
    inputs: [],
    outputs: [{ name: "", type: "bytes32", internalType: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isAttester",
    inputs: [{ name: "addr", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "registerDevice",
    inputs: [
      { name: "serialHash", type: "bytes32", internalType: "bytes32" },
      { name: "deviceAddr", type: "address", internalType: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "verifyCapture",
    inputs: [
      { name: "captureHash", type: "bytes32", internalType: "bytes32" },
      { name: "v", type: "uint8", internalType: "uint8" },
      { name: "r", type: "bytes32", internalType: "bytes32" },
      { name: "s", type: "bytes32", internalType: "bytes32" },
      { name: "scriptHash", type: "bytes32", internalType: "bytes32" },
      { name: "binaryHash", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [
      { name: "valid", type: "bool", internalType: "bool" },
      { name: "signer", type: "address", internalType: "address" },
      { name: "scriptMatch", type: "bool", internalType: "bool" },
      { name: "binaryMatch", type: "bool", internalType: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "DeviceRegistered",
    inputs: [
      {
        name: "serialHash",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
      {
        name: "deviceAddr",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "attester",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "DeviceAlreadyRegistered",
    inputs: [{ name: "serialHash", type: "bytes32", internalType: "bytes32" }],
  },
  {
    type: "error",
    name: "NotAttester",
    inputs: [],
  },
];

export const appConfig = {
  rpcUrl: import.meta.env.VITE_RPC_URL?.trim() || "http://127.0.0.1:8545",
  contractAddress: import.meta.env.VITE_CONTRACT_ADDRESS?.trim() || "",
  expectedChainId: Number.parseInt(import.meta.env.VITE_CHAIN_ID || "31337", 10),
};
