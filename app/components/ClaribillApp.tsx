"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { loadApiKey, saveApiKey, clearApiKey } from "../lib/apiKeyStorage";

const ApiKeySetup = dynamic(() => import("./ApiKeySetup"), { ssr: false });
const Dashboard = dynamic(() => import("./Dashboard"), { ssr: false });

export default function ClaribillApp() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Hydrate from localStorage after mount (SSR-safe) — intentional setState-in-effect
    const stored = loadApiKey();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setApiKey(stored);
    setReady(true);
  }, []);

  const handleSaveKey = (key: string) => {
    saveApiKey(key);
    setApiKey(key);
  };

  const handleClearKey = () => {
    clearApiKey();
    setApiKey(null);
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--parchment)" }}>
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--terracotta)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (!apiKey) {
    return <ApiKeySetup onSave={handleSaveKey} />;
  }

  return <Dashboard apiKey={apiKey} onClearKey={handleClearKey} />;
}
