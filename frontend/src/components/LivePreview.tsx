"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Camera, RefreshCw, Maximize2, Minimize2 } from "lucide-react";

const API_BASE = "http://localhost:8000";

export default function LivePreview() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [isEnlarged, setIsEnlarged] = useState(false);
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);

  useEffect(() => {
    setPortalTarget(document.getElementById("center-viewport"));
  }, []);

  const fetchPreview = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/camera/preview`);
      if (res.ok) {
        const data = await res.json();
        setPreviewUrl(`${API_BASE}${data.url}`);
      }
    } catch (err) {
      console.error("Failed to fetch preview", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (autoRefresh) {
      // Use the stream endpoint directly with a cache buster
      setPreviewUrl(`${API_BASE}/camera/stream?t=${Date.now()}`);
      setIsLoading(false);
    } else {
      // Clear stream or fetch a single new frame if wanted
      // We'll leave the current previewUrl or clear it
    }
  }, [autoRefresh]);

  return (
    <div className="bg-dark-sidebar/40 border border-dark-border rounded-lg overflow-hidden flex flex-col">
      <div className="h-8 px-3 border-b border-dark-border flex items-center justify-between bg-white/5">
        <span className="text-[9px] uppercase font-bold tracking-widest text-white/60 flex items-center gap-2">
          <Camera size={10} className="text-dark-accent" /> Live View
        </span>
        <div className="flex items-center gap-2">
            <button 
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`text-[8px] px-1.5 py-0.5 rounded border ${autoRefresh ? 'bg-dark-accent/20 border-dark-accent text-dark-accent' : 'bg-transparent border-white/10 text-white/40'}`}
            >
                {autoRefresh ? "AUTO ON" : "AUTO OFF"}
            </button>
            <button 
                onClick={fetchPreview} 
                disabled={isLoading}
                className="text-white/40 hover:text-white transition-colors disabled:opacity-50"
            >
                <RefreshCw size={10} className={isLoading ? "animate-spin" : ""} />
            </button>
        </div>
      </div>
      
      <div className="aspect-video bg-black flex items-center justify-center relative group overflow-hidden">
        {previewUrl ? (
          <img 
            src={previewUrl} 
            className="w-full h-full object-contain cursor-pointer transition-transform duration-300 hover:scale-105" 
            alt="Camera Preview" 
            key={autoRefresh ? "stream" : previewUrl}
            onClick={() => setIsEnlarged(true)}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 opacity-20">
            <Camera size={24} />
            <span className="text-[10px]">No Preview Available</span>
          </div>
        )}
        
        {previewUrl && (
            <button 
                onClick={() => setIsEnlarged(true)}
                className="absolute right-2 bottom-2 bg-black/60 text-white/60 hover:text-white p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            >
                <Maximize2 size={12} />
            </button>
        )}

        {isLoading && !previewUrl && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <RefreshCw size={16} className="animate-spin text-dark-accent" />
            </div>
        )}
      </div>
      
      <div className="p-2 bg-black/20">
         <p className="text-[9px] text-white/40 leading-relaxed">
            Live View provides a real-time feed from the camera sensor for composition and focus check.
         </p>
      </div>

      {/* Enlarged View Modal - Portaled to center container */}
      {isEnlarged && previewUrl && portalTarget && createPortal(
        <div 
            className="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsEnlarged(false)}
        >
            <div className="absolute top-4 right-4 flex items-center gap-4 z-10">
                <span className="text-[10px] uppercase tracking-widest font-bold text-dark-accent bg-dark-accent/10 px-2 py-1 rounded">Live View</span>
                <button 
                    onClick={() => setIsEnlarged(false)}
                    className="text-white/50 hover:text-white bg-white/5 p-2 rounded-full transition-colors"
                >
                    <Minimize2 size={20} />
                </button>
            </div>
            <div className="w-full h-full p-8 flex items-center justify-center">
              <img 
                src={previewUrl} 
                className="max-w-full max-h-full object-contain drop-shadow-2xl" 
                alt="Enlarged Camera Preview"
                onClick={(e) => e.stopPropagation()} 
              />
            </div>
        </div>,
        portalTarget
      )}
    </div>
  );
}
