"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Library from "@/components/Library";
import Stacker from "@/components/Stacker";
import CanvasView from "@/components/CanvasView";
import LivePreview from "@/components/LivePreview";
import { Layers, Image as ImageIcon, Box, Info, AlertCircle } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { CanvasProvider } from "@/context/CanvasContext";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ImageInfo {
  name: string;
  url: string;
  thumb_url?: string;
  type: "raw" | "processed" | "stacked";
  width?: number;
  height?: number;
  session?: string;
}

interface ImagesState {
  raw: ImageInfo[];
  processed: ImageInfo[];
  stacked: ImageInfo[];
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<"library" | "stacker" | "canvas" | "adjust">("library");
  const [images, setImages] = useState<ImagesState>({ raw: [], processed: [], stacked: [] });
  const [conflict, setConflict] = useState(false);
  const [clientId] = useState(() => Math.random().toString(36).substring(2) + Date.now().toString(36));

  const fetchImages = async () => {
    try {
      const res = await fetch("http://localhost:8000/images");
      const data = await res.json();
      setImages(data);
    } catch (err) {
      console.error("Failed to fetch images", err);
    }
  };

  useEffect(() => {
    fetchImages();
    const interval = setInterval(fetchImages, 5000);
    
    // Heartbeat logic
    const heartbeat = setInterval(async () => {
      try {
        const res = await fetch("http://localhost:8000/health/ping", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ client_id: clientId })
        });
        if (res.status === 409) {
          setConflict(true);
        } else if (res.ok && conflict) {
          setConflict(false);
        }
      } catch (e) {
        // Ignored
      }
    }, 3000);

    return () => {
      clearInterval(interval);
      clearInterval(heartbeat);
    };
  }, [clientId, conflict]);

  return (
    <CanvasProvider>
      <main className="flex h-screen w-screen overflow-hidden bg-dark-bg text-dark-text relative">
        {conflict && (
          <div className="absolute inset-0 z-[999] bg-black/90 backdrop-blur flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
             <AlertCircle size={48} className="text-red-500 mb-4" />
             <h2 className="text-xl font-bold uppercase tracking-widest text-white mb-2">Another Instance Active</h2>
             <p className="text-white/50 max-w-md">
                The EOS Suite camera service only supports one active client at a time to prevent hardware lockups. 
                Please close this tab, or close the other active tab to continue.
             </p>
          </div>
        )}
        <div className="flex flex-col w-full h-full overflow-hidden">
          {/* Top Navigation / Module Switcher (Globally Centered) */}
          <div className="flex items-center justify-center h-10 border-b border-dark-border bg-dark-sidebar/50 z-30">
            <button
              onClick={() => setActiveTab("library")}
              className={cn(
                "flex items-center justify-center gap-2 w-40 h-full text-[10px] uppercase tracking-wider font-semibold transition-colors",
                activeTab === "library" ? "text-dark-accent border-b-2 border-dark-accent" : "text-white/40 hover:text-white/60"
              )}
            >
              <ImageIcon size={14} /> Take pictures
            </button>
            <button
              onClick={() => setActiveTab("stacker")}
              className={cn(
                "flex items-center justify-center gap-2 w-40 h-full text-[10px] uppercase tracking-wider font-semibold transition-colors",
                activeTab === "stacker" ? "text-dark-accent border-b-2 border-dark-accent" : "text-white/40 hover:text-white/60"
              )}
            >
              <Box size={14} /> Stack
            </button>
            <button
              onClick={() => setActiveTab("canvas")}
              className={cn(
                "flex items-center justify-center gap-2 w-40 h-full text-[10px] uppercase tracking-wider font-semibold transition-colors",
                activeTab === "canvas" ? "text-dark-accent border-b-2 border-dark-accent" : "text-white/40 hover:text-white/60"
              )}
            >
              <Layers size={14} /> Stitch
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden relative">
            {/* Left Sidebar - Only show in Library mode */}
            {activeTab === "library" && <Sidebar onCapture={fetchImages} />}

            {/* Viewport */}
            <div id="center-viewport" className="flex-1 overflow-auto relative bg-dark-bg border-x border-dark-border">
              {activeTab === "library" && <Library images={images} onRefresh={fetchImages} />}
              {activeTab === "stacker" && <Stacker images={images} onStackComplete={fetchImages} />}
              {activeTab === "canvas" && <CanvasView images={images} />}
            </div>

            {/* Right Sidebar */}
            {activeTab === "library" && (
              <div className="w-72 panel border-l flex flex-col bg-dark-sidebar/40 overflow-hidden">
                <div className="flex-1 overflow-auto">
                  <div className="p-4 space-y-6">
                    <h3 className="sidebar-title flex items-center gap-2 mb-6">
                        <Info size={12} className="text-dark-accent" /> Control Center
                    </h3>
                    <LivePreview />
                    
                    <div className="space-y-3">
                        <h4 className="text-[9px] uppercase font-bold tracking-widest text-white/20">System Info</h4>
                        <div className="p-3 rounded border border-white/5 bg-black/20 space-y-2">
                            <div className="flex justify-between text-[9px]">
                                <span className="text-white/40">Z-Stacking Status:</span>
                                <span className="text-green-500/60">Ready</span>
                            </div>
                            <div className="flex justify-between text-[9px]">
                                <span className="text-white/40">USB Bus:</span>
                                <span className="text-white/60">Connected</span>
                            </div>
                        </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 border-t border-white/5 bg-black/20">
                  <p className="text-[10px] text-white/20 italic">
                      Select a module from the top bar to begin.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </CanvasProvider>
  );
}
