"use client";

import React from "react";
import { Maximize2, Eraser, Type } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ToolbarProps {
  tool: string;
  setTool: (t: any) => void;
  eraserRadius: number;
  setEraserRadius: (r: number) => void;
  eraserHardness: number;
  setEraserHardness: (h: number) => void;
  eraserProfile: "linear" | "gaussian";
  setEraserProfile: (p: "linear" | "gaussian") => void;
  handleUndo: () => void;
  historyLength: number;
  selectedId: string | null;
  updateImage: (id: string, changes: any) => void;
}

export default function Toolbar({
  tool,
  setTool,
  eraserRadius,
  setEraserRadius,
  eraserHardness,
  setEraserHardness,
  eraserProfile,
  setEraserProfile,
  handleUndo,
  historyLength,
  selectedId,
  updateImage
}: ToolbarProps) {
  return (
    <div className="min-h-[40px] py-2 bg-dark-sidebar/40 border-b border-dark-border flex flex-wrap items-center px-4 gap-y-3 gap-x-4">
      <div className="flex items-center gap-2 shrink-0">
        <button 
          onClick={() => setTool("transform")}
          className={cn("p-1.5 rounded transition-colors flex items-center gap-2", tool === "transform" ? "bg-dark-accent/20 text-dark-accent" : "text-white/40 hover:text-white")}
        >
          <Maximize2 size={12} />
          <span className="text-[10px] uppercase font-bold">Transform</span>
        </button>
        <button 
          onClick={() => setTool("eraser")}
          className={cn("p-1.5 rounded transition-colors flex items-center gap-2", tool === "eraser" ? "bg-dark-accent/20 text-dark-accent" : "text-white/40 hover:text-white")}
        >
          <Eraser size={12} />
          <span className="text-[10px] uppercase font-bold">Eraser</span>
        </button>
        <button 
          onClick={() => setTool("text")}
          className={cn("p-1.5 rounded transition-colors flex items-center gap-2", tool === "text" ? "bg-dark-accent/20 text-dark-accent" : "text-white/40 hover:text-white")}
        >
          <Type size={12} />
          <span className="text-[10px] uppercase font-bold">Text</span>
        </button>

        <button 
          onClick={handleUndo}
          disabled={historyLength <= 1}
          className="p-1.5 rounded disabled:opacity-20 text-white/40 hover:text-white transition-colors flex items-center gap-2 border border-white/5"
        >
          <span className="text-[10px] uppercase font-bold">Undo</span>
        </button>
      </div>

      {tool === "eraser" && (
        <div className="flex items-center gap-4 ml-4 px-4 border-l border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-[9px] uppercase font-bold text-white/40">Size</span>
            <input 
              type="range" min="5" max="200" value={eraserRadius}
              onChange={(e) => setEraserRadius(Number(e.target.value))}
              className="w-24 accent-dark-accent"
            />
            <span className="text-[10px] text-white/80 font-bold min-w-[24px]">{eraserRadius}px</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[9px] uppercase font-bold text-white/40">Softness</span>
            <input 
              type="range" min="0" max="1" step="0.1" value={eraserHardness}
              onChange={(e) => setEraserHardness(Number(e.target.value))}
              className="w-24 accent-dark-accent"
            />
            <span className="text-[10px] text-white/80 font-bold min-w-[24px]">{Math.round(eraserHardness * 100)}%</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[9px] uppercase font-bold text-white/40">Profile</span>
            <select
              value={eraserProfile}
              onChange={(e) => setEraserProfile(e.target.value as any)}
              className="bg-black/40 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-white font-bold"
            >
              <option value="linear">Uniform</option>
              <option value="gaussian">Linear</option>
            </select>
          </div>
          <button 
            onClick={() => selectedId && updateImage(selectedId, { maskLines: [] })}
            className="text-[10px] uppercase font-bold text-white/40 hover:text-red-400 border border-white/10 px-2 py-1 rounded transition-colors"
          >
            Clear Mask
          </button>
        </div>
      )}
    </div>
  );
}
