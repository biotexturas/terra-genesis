# HardTrust Web

React frontend for the `HardTrustRegistry` contract in `../contracts`.

## What it does

- Reads every registered device by querying the `DeviceRegistered` event and resolving each entry with `getDevice(...)`
- Connects an injected wallet such as MetaMask
- Lets the authorized attester submit `registerDevice(serialHash, deviceAddr)` directly from the browser
- Shows a dedicated "Become a verified device" section that links from the hero area

## Run it

1. Copy `.env.example` to `.env`
2. Set `VITE_CONTRACT_ADDRESS` to your deployed `HardTrustRegistry`
3. Install dependencies:

```bash
npm install
```

4. Start the dev server:

```bash
npm run dev
```

## Default local setup

The defaults match your deployment docs:

- RPC: `http://127.0.0.1:8545`
- Chain ID: `31337`
- Example contract address: `0x5FbDB2315678afecb367f032d93F642f64180aa3`

If you use Anvil, connect MetaMask to the local chain and import the attester key for:

`0x70997970C51812dc3A010C7d01b50e0d17dc79C8`

Only that authorized attester account can submit registrations successfully.
