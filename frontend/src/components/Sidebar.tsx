"use client";

import { useState, useEffect } from "react";
import { Camera, RefreshCw, Sliders, Zap } from "lucide-react";

interface SidebarProps {
  onCapture: () => void;
}

export default function Sidebar({ onCapture }: SidebarProps) {
  const [status, setStatus] = useState({ connected: false });
  const [loading, setLoading] = useState(false);
  const [probing, setProbing] = useState(false);
  const [config, setConfig] = useState({ iso: "100", shutterspeed: "1/100" });
  const [isoOptions, setIsoOptions] = useState<string[]>([]);
  const [ssOptions, setSsOptions] = useState<string[]>([]);

  const checkStatus = async () => {
    try {
      const res = await fetch("http://localhost:8000/camera/status");
      const data = await res.json();
      setStatus(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleConfigChange = async (name: string, value: string) => {
    setConfig(prev => ({ ...prev, [name]: value }));
    try {
      await fetch(`http://localhost:8000/camera/config/${name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleCapture = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/camera/capture", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        console.log("Captured:", data);
        // Small delay to ensure filesystem sync before fetching updated list
        await new Promise(r => setTimeout(r, 500));
        onCapture();
      } else {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        alert(`Capture failed: ${err.detail}`);
      }
    } catch (e) {
      alert("Capture failed: network error");
    } finally {
      setLoading(false);
    }
  };

  const handleProbe = async () => {
    setProbing(true);
    try {
      const res = await fetch("http://localhost:8000/camera/probe", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setConfig({ iso: data.iso, shutterspeed: data.shutterspeed });
        alert(`Probe successful: Set to ISO ${data.iso}, ${data.shutterspeed}`);
      } else {
        alert("Exposure probe failed");
      }
    } catch (e) {
      alert("Probe failed: network error");
    } finally {
      setProbing(false);
    }
  };

  const fetchOptions = async () => {
    try {
      const [isoRes, ssRes] = await Promise.all([
        fetch("http://localhost:8000/camera/options/iso"),
        fetch("http://localhost:8000/camera/options/shutterspeed")
      ]);
      const isoData = await isoRes.json();
      const ssData = await ssRes.json();
      setIsoOptions(isoData.options);
      setSsOptions(ssData.options);
    } catch (e) {
      console.error("Failed to fetch camera options", e);
    }
  };

  useEffect(() => {
    checkStatus();
    fetchOptions();
    const int = setInterval(checkStatus, 10000);
    return () => clearInterval(int);
  }, []);

  return (
    <div className="w-64 panel border-r flex flex-col p-4 shadow-xl z-10 transition-all">
      <div className="flex items-center gap-2 mb-8">
        <div className={`w-2 h-2 rounded-full ${status.connected ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"}`} />
        <span className="text-[10px] uppercase tracking-widest font-bold opacity-60">
          Canon EOS {status.connected ? "Connected" : "Disconnected"}
        </span>
      </div>

      <div className="space-y-6">
        <section>
          <div className="sidebar-title flex items-center gap-2 mb-4">
              <Zap size={10} className="text-dark-accent" /> Control
          </div>
          <button
            onClick={handleCapture}
            disabled={!status.connected || loading}
            className="w-full bg-dark-accent hover:bg-dark-accent/80 disabled:bg-white/5 disabled:text-white/20 text-black font-bold py-3 rounded-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 text-xs"
          >
            <Camera size={14} /> {loading ? "Capturing..." : "Shutter Release"}
          </button>
        </section>

        <section>
          <div className="sidebar-title flex items-center gap-2 mb-4">
              <Sliders size={10} className="text-dark-accent" /> Exposure
          </div>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] opacity-40 uppercase">ISO</label>
               <select 
                value={config.iso}
                onChange={(e) => handleConfigChange("iso", e.target.value)}
                className="w-full dark-input h-8 text-[11px] bg-black/40 border-white/5"
              >
                {isoOptions.length > 0 ? (
                    isoOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)
                ) : (
                    <>
                        <option value="100">100</option>
                        <option value="200">200</option>
                        <option value="400">400</option>
                        <option value="800">800</option>
                        <option value="1600">1600</option>
                    </>
                )}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] opacity-40 uppercase">Shutter Speed</label>
               <select 
                value={config.shutterspeed}
                onChange={(e) => handleConfigChange("shutterspeed", e.target.value)}
                className="w-full dark-input h-8 text-[11px] bg-black/40 border-white/5"
              >
                {ssOptions.length > 0 ? (
                    ssOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)
                ) : (
                    <>
                        <option value="1/30">1/30</option>
                        <option value="1/60">1/60</option>
                        <option value="1/100">1/100</option>
                        <option value="1/200">1/200</option>
                        <option value="1/500">1/500</option>
                        <option value="1/1000">1/1000</option>
                    </>
                )}
              </select>
            </div>

            <button
              onClick={handleProbe}
              disabled={!status.connected || probing}
              className="w-full mt-2 bg-white/5 hover:bg-white/10 disabled:opacity-30 border border-white/10 text-white/60 text-[9px] uppercase font-bold py-2 rounded-sm flex items-center justify-center gap-2 transition-all"
            >
              <Zap size={10} className="text-dark-accent" /> {probing ? "Probing..." : "Auto Probe Exposure"}
            </button>
          </div>
        </section>

        <section>
          <div className="sidebar-title flex items-center gap-2 mb-4">
              <RefreshCw size={10} className="text-dark-accent" /> Actions
          </div>
          <button onClick={checkStatus} className="dark-button w-full justify-center flex gap-2 border-white/5">
             <RefreshCw size={12} /> Sync Settings
          </button>
        </section>
      </div>

      <div className="mt-auto pt-4 border-t border-white/5 opacity-20 hover:opacity-50 transition-opacity">
        <p className="text-[9px] text-center uppercase tracking-tighter">Powered by gPhoto2 & Antigravity</p>
      </div>
    </div>
  );
}
