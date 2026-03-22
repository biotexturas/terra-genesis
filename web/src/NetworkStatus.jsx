import React, { useEffect, useState } from "react";
import { JsonRpcProvider } from "ethers";
import { appConfig } from "./contract";

const CHAIN_NAMES = {
  31337: "Local Anvil",
  43113: "Avalanche Fuji",
};

export default function NetworkStatus() {
  const [status, setStatus] = useState({ color: "gray", label: "Connecting..." });

  useEffect(() => {
    let cancelled = false;

    async function checkNetwork() {
      try {
        const provider = new JsonRpcProvider(appConfig.rpcUrl);
        const network = await provider.getNetwork();
        if (cancelled) return;
        const chainId = Number(network.chainId);
        const name = CHAIN_NAMES[chainId];
        setStatus(
          name
            ? { color: "#22c55e", label: name }
            : { color: "#eab308", label: "Unknown Network" },
        );
      } catch {
        if (!cancelled) setStatus({ color: "#ef4444", label: "Disconnected" });
      }
    }

    checkNetwork();

    const eth = window.ethereum;
    if (eth) {
      const onChange = () => checkNetwork();
      eth.on("chainChanged", onChange);
      return () => {
        cancelled = true;
        eth.removeListener("chainChanged", onChange);
      };
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="network-status">
      <span
        className="network-dot"
        style={{ backgroundColor: status.color }}
      />
      <span className="network-label">{status.label}</span>
    </div>
  );
}
