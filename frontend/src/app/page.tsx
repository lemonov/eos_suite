"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Library from "@/components/Library";
import Stacker from "@/components/Stacker";
import CanvasView from "@/components/CanvasView";
import AdjustView from "@/components/AdjustView";
import LivePreview from "@/components/LivePreview";
import { Layers, Image as ImageIcon, Box, Sliders, Info } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { CanvasProvider } from "@/context/CanvasContext";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ImageInfo {
  name: string;
  url: string;
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
    return () => clearInterval(interval);
  }, []);

  return (
    <CanvasProvider>
      <main className="flex h-screen w-screen overflow-hidden bg-dark-bg text-dark-text">
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
            <button
              onClick={() => setActiveTab("adjust")}
              className={cn(
                "flex items-center justify-center gap-2 w-40 h-full text-[10px] uppercase tracking-wider font-semibold transition-colors",
                activeTab === "adjust" ? "text-dark-accent border-b-2 border-dark-accent" : "text-white/40 hover:text-white/60"
              )}
            >
              <Sliders size={14} /> Adjust
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
              {activeTab === "adjust" && <AdjustView images={images} onRefresh={fetchImages} />}
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
