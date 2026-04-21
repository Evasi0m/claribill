"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const ApiKeySetup = dynamic(() => import("./ApiKeySetup"), { ssr: false });
const Dashboard = dynamic(() => import("./Dashboard"), { ssr: false });

const STORAGE_KEY = "CLARIBILL_API_KEY";

export default function ClaribillApp() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setApiKey(stored);
    setReady(true);
  }, []);

  const handleSaveKey = (key: string) => {
    localStorage.setItem(STORAGE_KEY, key);
    setApiKey(key);
  };

  const handleClearKey = () => {
    localStorage.removeItem(STORAGE_KEY);
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
