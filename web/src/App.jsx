import React, { Component, useEffect, useMemo, useState } from "react";
import {
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  formatEther,
  getBytes,
  isAddress,
  keccak256,
  toUtf8Bytes,
} from "ethers";
import { appConfig, registryAbi } from "./contract";

const emptyForm = {
  serial: "",
  deviceAddress: "",
};

const storyPoints = [
  {
    title: "What HardTrust is",
    description:
      "A DePIN identity and attestation system for physical devices, starting with Raspberry Pi deployments.",
  },
  {
    title: "What it proves",
    description:
      "That a registered device can be distinguished from an unregistered one, so sensor data has traceable provenance.",
  },
  {
    title: "Why it matters",
    description:
      "It creates a trust bridge between hardware in the real world and an on-chain registry anyone can inspect.",
  },
];

const workflowSteps = [
  {
    step: "1",
    title: "The device generates identity",
    description:
      "The HardTrust device binary creates a secp256k1 keypair on the Raspberry Pi and derives an Ethereum address from it.",
  },
  {
    step: "2",
    title: "An attester registers it on-chain",
    description:
      "A trusted attester confirms the device and sends its serial hash plus device address to the HardTrustRegistry contract.",
  },
  {
    step: "3",
    title: "The device emits signed readings",
    description:
      "The device produces a signed reading with serial, address, temperature, timestamp, and signature.",
  },
  {
    step: "4",
    title: "Anyone can verify trust",
    description:
      "Registered devices resolve as trusted, while unknown devices stay unverified. That contrast is the core of The Wire.",
  },
];

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || "Unknown frontend error",
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="shell">
          <section className="panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Frontend error</p>
                <h2>The page hit a runtime error before rendering fully.</h2>
              </div>
            </div>
            <p className="message error">{this.state.errorMessage}</p>
            <p className="lead">
              Refresh the page after the frontend reloads. If the error stays, inspect the browser
              console and the wallet extension injected into the page.
            </p>
          </section>
        </div>
      );
    }

    return this.props.children;
  }
}

function shortAddress(value) {
  if (!value) return "Not connected";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatTimestamp(value) {
  if (!value) return "Pending";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(Number(value) * 1000));
}

function extractError(error) {
  return (
    error?.shortMessage ||
    error?.reason ||
    error?.info?.error?.message ||
    error?.message ||
    "Unknown contract error"
  );
}

function normalizeRegisteredDevice(serialHash, details) {
  return {
    serialHash,
    deviceAddr: details.deviceAddr,
    attester: details.attester_ || details.attester,
    attestedAt: Number(details.attestedAt),
    active: details.active,
  };
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashFile(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);

  return {
    hash: `sha256:${bytesToHex(new Uint8Array(hashBuffer))}`,
    size: buffer.byteLength,
  };
}

async function parseJsonFile(file) {
  return JSON.parse(await file.text());
}

function computeContentHash(files) {
  const encoder = new TextEncoder();
  const sortedFiles = [...files].sort((left, right) => left.name.localeCompare(right.name));
  const parts = sortedFiles.flatMap((file) => [
    ...encoder.encode(file.name),
    ...encoder.encode(file.hash.replace("sha256:", "")),
  ]);

  return crypto.subtle
    .digest("SHA-256", new Uint8Array(parts))
    .then((hashBuffer) => `sha256:${bytesToHex(new Uint8Array(hashBuffer))}`);
}

function concatBytes(...parts) {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  parts.forEach((part) => {
    result.set(part, offset);
    offset += part.length;
  });

  return result;
}

function bigintToUint64Bytes(value) {
  const result = new Uint8Array(8);
  let current = value;

  for (let index = 7; index >= 0; index -= 1) {
    result[index] = Number(current & 0xffn);
    current >>= 8n;
  }

  return result;
}

function sha256StringToBytes32(value) {
  if (typeof value !== "string") {
    throw new Error("Expected sha256 string.");
  }

  const hex = value.startsWith("sha256:") ? value.slice(7) : value;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(`Invalid SHA-256 hash: ${value}`);
  }

  return `0x${hex.toLowerCase()}`;
}

function parseCaptureSignature(signatureHex) {
  const normalized = signatureHex?.trim().replace(/^0x/i, "") || "";
  if (!/^[0-9a-fA-F]{130}$/.test(normalized)) {
    throw new Error("Invalid capture signature.");
  }

  const recoveryId = Number.parseInt(normalized.slice(128, 130), 16);

  return {
    r: `0x${normalized.slice(0, 64)}`,
    s: `0x${normalized.slice(64, 128)}`,
    v: recoveryId + 27,
  };
}

function computeCapturePrehash(capture) {
  const contentHash = sha256StringToBytes32(capture.content_hash);
  const timestampSeconds = Date.parse(capture.timestamp);

  if (Number.isNaN(timestampSeconds)) {
    throw new Error("Invalid capture timestamp.");
  }

  const encoder = new TextEncoder();
  const preimage = concatBytes(
    getBytes(keccak256(toUtf8Bytes(capture.serial))),
    getBytes(capture.address),
    getBytes(contentHash),
    bigintToUint64Bytes(BigInt(Math.floor(timestampSeconds / 1000))),
    encoder.encode(capture.environment.script_hash),
    encoder.encode(capture.environment.binary_hash),
    encoder.encode(capture.environment.hw_serial),
    encoder.encode(capture.environment.camera_info),
  );

  return keccak256(preimage);
}

async function verifyCaptureOnChain(manifest) {
  if (!appConfig.contractAddress) {
    return {
      available: false,
      verified: false,
      message: "Set VITE_CONTRACT_ADDRESS to enable on-chain verification.",
    };
  }

  const provider = new JsonRpcProvider(appConfig.rpcUrl);
  const contract = new Contract(appConfig.contractAddress, registryAbi, provider);
  const captureHash = computeCapturePrehash(manifest);
  const { v, r, s } = parseCaptureSignature(manifest.signature);
  const scriptHash = sha256StringToBytes32(manifest.environment.script_hash);
  const binaryHash = sha256StringToBytes32(manifest.environment.binary_hash);
  const zeroHash = `0x${"0".repeat(64)}`;

  try {
    const [result, approvedScriptHash, approvedBinaryHash] = await Promise.all([
      contract.verifyCapture(captureHash, v, r, s, scriptHash, binaryHash),
      contract.approvedScriptHash(),
      contract.approvedBinaryHash(),
    ]);

    const scriptConfigured = approvedScriptHash.toLowerCase() !== zeroHash;
    const binaryConfigured = approvedBinaryHash.toLowerCase() !== zeroHash;
    const scriptAccepted = !scriptConfigured || result.scriptMatch;
    const binaryAccepted = !binaryConfigured || result.binaryMatch;

    return {
      available: true,
      verified: result.valid && scriptAccepted && binaryAccepted,
      valid: result.valid,
      signer: result.signer,
      scriptMatch: result.scriptMatch,
      binaryMatch: result.binaryMatch,
      scriptConfigured,
      binaryConfigured,
      captureHash,
      message: result.valid ? "On-chain verification completed." : "Recovered signer is not registered.",
    };
  } catch (error) {
    return {
      available: true,
      verified: false,
      valid: false,
      signer: "",
      scriptMatch: false,
      binaryMatch: false,
      scriptConfigured: false,
      binaryConfigured: false,
      captureHash,
      message: extractError(error),
    };
  }
}

function AppContent() {
  const [devices, setDevices] = useState([]);
  const [attesterAddress, setAttesterAddress] = useState("");
  const [networkName, setNetworkName] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [listError, setListError] = useState("");

  const [walletAddress, setWalletAddress] = useState("");
  const [walletChainId, setWalletChainId] = useState(null);
  const [walletBalance, setWalletBalance] = useState("");
  const [isAuthorizedAttester, setIsAuthorizedAttester] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState(false);

  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [verifyingDemoCapture, setVerifyingDemoCapture] = useState(false);
  const [demoVerification, setDemoVerification] = useState(null);
  const [demoVerificationError, setDemoVerificationError] = useState("");
  const [captureImageFile, setCaptureImageFile] = useState(null);
  const [metadataFile, setMetadataFile] = useState(null);
  const [signFile, setSignFile] = useState(null);
  const [capturePreviewUrl, setCapturePreviewUrl] = useState("");

  const hasContractAddress = Boolean(appConfig.contractAddress);
  const walletChainMatches =
    walletChainId === null || walletChainId === appConfig.expectedChainId;

  const deviceStats = useMemo(
    () => ({
      total: devices.length,
      active: devices.filter((device) => device.active).length,
    }),
    [devices],
  );

  function clearWalletState() {
    setWalletAddress("");
    setWalletChainId(null);
    setWalletBalance("");
    setIsAuthorizedAttester(false);
  }

  async function loadDevices() {
    if (!hasContractAddress) {
      setListError("Set VITE_CONTRACT_ADDRESS before loading the registry.");
      setDevices([]);
      setLoadingDevices(false);
      return;
    }

    setLoadingDevices(true);
    setListError("");

    try {
      const provider = new JsonRpcProvider(appConfig.rpcUrl);
      const contract = new Contract(appConfig.contractAddress, registryAbi, provider);
      const [network, contractAttester, logs] = await Promise.all([
        provider.getNetwork(),
        contract.ATTESTER(),
        contract.queryFilter(contract.filters.DeviceRegistered(), 0, "latest"),
      ]);

      const uniqueSerialHashes = [...new Set(logs.map((log) => log.args.serialHash))];
      const deviceDetails = await Promise.all(
        uniqueSerialHashes.map(async (serialHash) => {
          const device = await contract.getDevice(serialHash);
          return normalizeRegisteredDevice(serialHash, device);
        }),
      );

      deviceDetails.sort((left, right) => right.attestedAt - left.attestedAt);
      setDevices(deviceDetails.filter((device) => device.active));
      setAttesterAddress(contractAttester);
      setNetworkName(network.name || `Chain ${network.chainId.toString()}`);
      setLastUpdated(new Date());
    } catch (error) {
      setListError(extractError(error));
      setDevices([]);
    } finally {
      setLoadingDevices(false);
    }
  }

  async function updateWalletState(provider, signerAddress) {
    const [network, balance] = await Promise.all([
      provider.getNetwork(),
      provider.getBalance(signerAddress),
    ]);
    console.log(`Wallet on chain ${network.chainId} with balance ${formatEther(balance)} ETH`);
    const authorized = hasContractAddress
      ? await new Contract(appConfig.contractAddress, registryAbi, provider).isAttester(
          signerAddress,
        )
      : false;

    console.log(`Wallet ${signerAddress} is authorized attester: ${authorized}`);
    setWalletAddress(signerAddress);
    setWalletChainId(Number(network.chainId));
    setWalletBalance(Number(formatEther(balance)).toFixed(4));
    setIsAuthorizedAttester(authorized);
  }

  async function connectWallet() {
    console.log("Connecting wallet...");
    if (!window.ethereum) {
      setSubmitError("No wallet found. Install MetaMask or another injected wallet.");
      return;
    }

    setConnectingWallet(true);
    setSubmitError("");

    try {
      const provider = new BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []); //not working
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();
      console.log(`Wallet connected: ${signerAddress}`);
      await updateWalletState(provider, signerAddress);
      console.log(`Connected wallet ${signerAddress} on chain ${walletChainId}`);
      console.log("Wallet is authorized attester:", isAuthorizedAttester);
    } catch (error) {
      setSubmitError(extractError(error));
    } finally {
      setConnectingWallet(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError("");
    setTxHash("");

    if (!hasContractAddress) {
      setSubmitError("Set VITE_CONTRACT_ADDRESS before submitting transactions.");
      return;
    }

    if (!window.ethereum) {
      setSubmitError("No wallet found. Install MetaMask or another injected wallet.");
      return;
    }

    if (!walletAddress) {
      setSubmitError("Connect the authorized attester wallet first.");
      return;
    }

    if (!walletChainMatches) {
      setSubmitError(
        `Switch your wallet to chain ${appConfig.expectedChainId} before submitting.`,
      );
      return;
    }

    if (!isAddress(form.deviceAddress)) {
      setSubmitError("Enter a valid device wallet address.");
      return;
    }

    if (!form.serial.trim()) {
      setSubmitError("Serial is required.");
      return;
    }

    setSubmitting(true);

    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new Contract(appConfig.contractAddress, registryAbi, signer);
      const serialHash = keccak256(toUtf8Bytes(form.serial.trim()));
      const tx = await contract.registerDevice(serialHash, form.deviceAddress.trim());
      const receipt = await tx.wait();
      setTxHash(receipt.hash);
      setForm(emptyForm);
      await loadDevices();
      await updateWalletState(provider, walletAddress);
    } catch (error) {
      setSubmitError(extractError(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyDemoCapture() {
    setVerifyingDemoCapture(true);
    setDemoVerificationError("");

    try {
      if (!captureImageFile || !metadataFile || !signFile) {
        throw new Error("Choose an image, metadata.json, and sign.json before verifying.");
      }

      const manifest = await parseJsonFile(signFile);
      const expectedFiles = new Map(manifest.files.map((file) => [file.name, file]));

      const actualFiles = await Promise.all([
        hashFile(captureImageFile).then((file) => ({ ...file, name: captureImageFile.name })),
        hashFile(metadataFile).then((file) => ({ ...file, name: metadataFile.name })),
      ]);

      const fileResults = actualFiles.map((file) => {
        const expected = expectedFiles.get(file.name);
        return {
          ...file,
          hashMatches: Boolean(expected) && expected.hash === file.hash,
          sizeMatches: Boolean(expected) && Number(expected.size) === file.size,
        };
      });

      const actualContentHash = await computeContentHash(actualFiles);
      const filesVerified = fileResults.every((file) => file.hashMatches && file.sizeMatches);
      const contentHashMatches = manifest.content_hash === actualContentHash;
      const onChain = await verifyCaptureOnChain(manifest);
      const verified = filesVerified && contentHashMatches && onChain.verified;

      setDemoVerification({
        verified,
        filesVerified,
        checkedAt: new Date(),
        contentHashMatches,
        actualContentHash,
        expectedContentHash: manifest.content_hash,
        fileResults,
        onChain,
      });
    } catch (error) {
      setDemoVerification(null);
      setDemoVerificationError(extractError(error));
    } finally {
      setVerifyingDemoCapture(false);
    }
  }

  function handleCaptureImageChange(event) {
    const nextFile = event.target.files?.[0] || null;
    setDemoVerification(null);
    setDemoVerificationError("");
    setCaptureImageFile(nextFile);
  }

  function handleMetadataChange(event) {
    const nextFile = event.target.files?.[0] || null;
    setDemoVerification(null);
    setDemoVerificationError("");
    setMetadataFile(nextFile);
  }

  function handleSignChange(event) {
    const nextFile = event.target.files?.[0] || null;
    setDemoVerification(null);
    setDemoVerificationError("");
    setSignFile(nextFile);
  }

  useEffect(() => {
    loadDevices();
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;

    async function hydrateWallet() {
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_accounts", []);
      if (!accounts.length) return;
      await updateWalletState(provider, accounts[0]);
    }

    hydrateWallet().catch(() => {
      clearWalletState();
    });
  }, []);

  useEffect(() => {
    const injected = window.ethereum;
    if (!injected || typeof injected.on !== "function") return undefined;

    async function handleAccountsChanged(accounts) {
      if (!accounts.length) {
        clearWalletState();
        return;
      }

      const provider = new BrowserProvider(injected);
      await updateWalletState(provider, accounts[0]);
    }

    async function handleChainChanged() {
      await loadDevices();
      if (!walletAddress) return;
      const provider = new BrowserProvider(injected);
      await updateWalletState(provider, walletAddress);
    }

    injected.on("accountsChanged", handleAccountsChanged);
    injected.on("chainChanged", handleChainChanged);

    return () => {
      if (typeof injected.removeListener === "function") {
        injected.removeListener("accountsChanged", handleAccountsChanged);
        injected.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, [walletAddress]);

  useEffect(() => {
    if (!captureImageFile) {
      setCapturePreviewUrl("");
      return undefined;
    }

    const nextUrl = URL.createObjectURL(captureImageFile);
    setCapturePreviewUrl(nextUrl);

    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [captureImageFile]);

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">HardTrust</p>
          <h1>Registry control room for verified devices.</h1>
        </div>
        <button className="ghost-button" onClick={connectWallet} disabled={connectingWallet}>
          {connectingWallet ? "Connecting..." : walletAddress ? shortAddress(walletAddress) : "Connect wallet"}
        </button>
      </header>

      <main className="layout">
        <section className="hero panel">
          <div className="hero-copy">
            <p className="kicker">Hardware identity meets on-chain trust</p>
            <h2>HardTrust helps physical devices prove who they are and where their data comes from.</h2>
            <p className="lead">
              HardTrust starts with Raspberry Pi devices. Each device generates its own
              cryptographic identity, an authorized attester registers it on-chain, and its
              readings can be checked against that trusted registry. The result is simple: a
              registered device is trusted, and an unknown device is not.
            </p>

            <div className="hero-actions">
              <a className="primary-button" href="#verify-my-device">
                Verify my device
              </a>
              <button className="secondary-button" onClick={loadDevices} disabled={loadingDevices}>
                {loadingDevices ? "Refreshing..." : "Refresh registry"}
              </button>
            </div>
          </div>

          <div className="hero-meta">
            <article className="stat-card">
              <span>Core promise</span>
              <strong>Verified or unverified</strong>
            </article>
            <article className="stat-card">
              <span>Starting hardware</span>
              <strong>Raspberry Pi</strong>
            </article>
            <article className="stat-card">
              <span>Trusted devices now</span>
              <strong>{deviceStats.total}</strong>
            </article>
          </div>
        </section>

        <section className="panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">What it is for</p>
              <h2>HardTrust makes device provenance inspectable.</h2>
            </div>
          </div>

          <div className="story-grid">
            {storyPoints.map((item) => (
              <article className="story-card" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">How it works</p>
              <h2>From device identity to trusted verification.</h2>
            </div>
          </div>

          <div className="workflow-grid">
            {workflowSteps.map((item) => (
              <article className="workflow-card" key={item.step}>
                <span className="step-index">{item.step}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="status-grid">
          <div className="status-pill">
            <span>Contract</span>
            <strong>{appConfig.contractAddress || "Contract"}</strong>
          </div>
          <div className="status-pill">
            <span>Chain</span>
            <strong>{networkName || `Expected chain ${appConfig.expectedChainId}`}</strong>
          </div>
        </section>

        <section className="panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Registered devices</p>
              <h2>Every device currently registered in the contract.</h2>
            </div>
            <p className="timestamp">
              {lastUpdated ? `Last sync: ${lastUpdated.toLocaleTimeString()}` : "Waiting for first sync"}
            </p>
          </div>

          {listError ? <p className="message error">{listError}</p> : null}

          {loadingDevices ? (
            <div className="empty-state">Loading registry data from the chain...</div>
          ) : devices.length ? (
            <div className="device-grid">
              {devices.map((device) => (
                <article className="device-card" key={device.serialHash}>
                  <div className="device-card-head">
                    <span className="badge success">Verified</span>
                    <span>{formatTimestamp(device.attestedAt)}</span>
                  </div>
                  <h3>{shortAddress(device.deviceAddr)}</h3>
                  <dl>
                    <div>
                      <dt>Serial hash</dt>
                      <dd>{device.serialHash}</dd>
                    </div>
                    <div>
                      <dt>Device address</dt>
                      <dd>{device.deviceAddr}</dd>
                    </div>
                    <div>
                      <dt>Attester</dt>
                      <dd>{device.attester}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              No devices are registered yet. Deploy the contract, connect the attester wallet, and
              submit the first device below.
            </div>
          )}
        </section>

        <section className="panel register-panel" id="verify-my-device">
          <div className="section-head">
            <div>
              <p className="eyebrow">Verify my device</p>
              <h2>Register a device directly on-chain with the attester wallet.</h2>
            </div>
            <span className={`badge ${isAuthorizedAttester ? "success" : "warning"}`}>
              {isAuthorizedAttester ? "Attester wallet confirmed" : "Attester wallet required"}
            </span>
          </div>

          <div className="register-copy">
            <p>
              The contract only allows the configured attester address to call
              `registerDevice(serialHash, deviceAddr)`. This section is where the trusted device
              verification flow becomes an on-chain registration.
            </p>
            <p>
              The serial string is hashed in the browser using `keccak256(utf8(serial))`, matching
              the contract flow used by your CLI.
            </p>
          </div>

          <div className="wallet-box">
            <div>
              <span>Wallet</span>
              <strong>{walletAddress ? walletAddress : "No wallet connected"}</strong>
            </div>
            <div>
              <span>Balance</span>
              <strong>{walletBalance ? `${walletBalance} ETH` : "-"}</strong>
            </div>
            <div>
              <span>Chain</span>
              <strong>
                {walletChainId === null ? "-" : walletChainId}
                {walletChainMatches ? "" : " (wrong chain)"}
              </strong>
            </div>
          </div>

          <form className="register-form" onSubmit={handleSubmit}>
            <label>
              <span>Device serial</span>
              <input
                type="text"
                placeholder="100000004d01af60"
                value={form.serial}
                onChange={(event) =>
                  setForm((current) => ({ ...current, serial: event.target.value }))
                }
              />
            </label>

            <label>
              <span>Device address</span>
              <input
                type="text"
                placeholder="0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
                value={form.deviceAddress}
                onChange={(event) =>
                  setForm((current) => ({ ...current, deviceAddress: event.target.value }))
                }
              />
            </label>

            <div className="form-actions">
              <button
                className="primary-button"
                type="submit"
                disabled={submitting || !isAuthorizedAttester || !walletChainMatches}
              >
                {submitting ? "Submitting..." : "Register device"}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setForm(emptyForm)}
                disabled={submitting}
              >
                Clear form
              </button>
            </div>
          </form>

          {submitError ? <p className="message error">{submitError}</p> : null}
          {txHash ? (
            <p className="message success">
              Transaction confirmed: <code>{txHash}</code>
            </p>
          ) : null}
        </section>

        <section className="panel demo-verify-panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Capture verify</p>
              <h2>Choose your own files and run the MVP verification flow.</h2>
            </div>
            <span
              className={`badge ${
                demoVerification
                  ? demoVerification.verified
                    ? "success"
                    : "warning"
                  : "neutral"
              }`}
            >
              {demoVerification
                ? `verified: ${demoVerification.verified ? "true" : "false"}`
                : "Not checked"}
            </span>
          </div>

          <div className="demo-verify-grid">
            <div className="demo-preview-card">
              {capturePreviewUrl ? (
                <img
                  className="demo-preview-image"
                  src={capturePreviewUrl}
                  alt="Selected capture preview"
                />
              ) : (
                <div className="demo-preview-empty">Choose an image to preview it here.</div>
              )}
            </div>

            <div className="demo-verify-copy">
              <p>
                Select your capture image, `metadata.json`, and `sign.json`.
              </p>
              <p>
                Clicking `verify` hashes the selected image and metadata file, compares them with
                the manifest in `sign.json`, and returns a simple true or false result.
              </p>

              <div className="register-form">
                <label>
                  <span>Image file</span>
                  <input type="file" accept="image/*" onChange={handleCaptureImageChange} />
                </label>

                <label>
                  <span>metadata.json</span>
                  <input type="file" accept=".json,application/json" onChange={handleMetadataChange} />
                </label>

                <label>
                  <span>sign.json</span>
                  <input type="file" accept=".json,application/json" onChange={handleSignChange} />
                </label>
              </div>

              <div className="demo-selected-files">
                <span>{captureImageFile ? captureImageFile.name : "No image selected"}</span>
                <span>{metadataFile ? metadataFile.name : "No metadata selected"}</span>
                <span>{signFile ? signFile.name : "No sign file selected"}</span>
              </div>

              <div className="form-actions">
                <button
                  className="primary-button"
                  type="button"
                  onClick={handleVerifyDemoCapture}
                  disabled={
                    verifyingDemoCapture || !captureImageFile || !metadataFile || !signFile
                  }
                >
                  {verifyingDemoCapture ? "Verifying..." : "verify"}
                </button>
              </div>
            </div>
          </div>

          {demoVerificationError ? <p className="message error">{demoVerificationError}</p> : null}

          {demoVerification ? (
            <div className="demo-result-grid">
              <article className="status-pill">
                <span>Verification result</span>
                <strong>{demoVerification.verified ? "true" : "false"}</strong>
              </article>
              <article className="status-pill">
                <span>Local files</span>
                <strong>{demoVerification.filesVerified ? "match" : "mismatch"}</strong>
              </article>
              <article className="status-pill">
                <span>Content hash</span>
                <strong>{demoVerification.contentHashMatches ? "match" : "mismatch"}</strong>
              </article>
              <article className="status-pill">
                <span>On-chain</span>
                <strong>
                  {demoVerification.onChain.available
                    ? demoVerification.onChain.verified
                      ? "verified"
                      : "failed"
                    : "unavailable"}
                </strong>
              </article>
              <article className="status-pill">
                <span>Recovered signer</span>
                <strong>
                  {demoVerification.onChain.signer
                    ? shortAddress(demoVerification.onChain.signer)
                    : "-"}
                </strong>
              </article>
              <article className="status-pill">
                <span>Checked at</span>
                <strong>{demoVerification.checkedAt.toLocaleTimeString()}</strong>
              </article>
            </div>
          ) : null}

          {demoVerification ? (
            <div className="demo-result-grid">
              <article className="status-pill">
                <span>Registered device</span>
                <strong>{demoVerification.onChain.valid ? "yes" : "no"}</strong>
              </article>
              <article className="status-pill">
                <span>Script hash</span>
                <strong>
                  {demoVerification.onChain.scriptConfigured
                    ? demoVerification.onChain.scriptMatch
                      ? "match"
                      : "mismatch"
                    : "not configured"}
                </strong>
              </article>
              <article className="status-pill">
                <span>Binary hash</span>
                <strong>
                  {demoVerification.onChain.binaryConfigured
                    ? demoVerification.onChain.binaryMatch
                      ? "match"
                      : "mismatch"
                    : "not configured"}
                </strong>
              </article>
            </div>
          ) : null}

          {demoVerification?.onChain?.message ? (
            <p
              className={`message ${
                demoVerification.onChain.verified ? "success" : "error"
              }`}
            >
              {demoVerification.onChain.message}
            </p>
          ) : null}

          {demoVerification ? (
            <div className="demo-file-grid">
              {demoVerification.fileResults.map((file) => (
                <article className="device-card" key={file.name}>
                  <div className="device-card-head">
                    <span
                      className={`badge ${
                        file.hashMatches && file.sizeMatches ? "success" : "warning"
                      }`}
                    >
                      {file.hashMatches && file.sizeMatches ? "verified" : "failed"}
                    </span>
                    <span>{file.size} bytes</span>
                  </div>
                  <h3>{file.name}</h3>
                  <dl>
                    <div>
                      <dt>Hash</dt>
                      <dd>{file.hash}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>
                        {file.hashMatches && file.sizeMatches
                          ? "Hash and size match manifest"
                          : "Hash or size mismatch"}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AppContent />
    </AppErrorBoundary>
  );
}
