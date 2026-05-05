"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

export interface CanvasImage {
  id: string;
  name: string;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  blendMode: string;
  scaleX: number;
  scaleY: number;
  rotation: number;
  maskLines: any[];
  brightness?: number;
  contrast?: number;
  saturation?: number;
  activeFilter?: string;
  filterIntensity?: number;
  blurLines?: any[];
  text?: string;
  fontSize?: number;
  color?: string;
}

interface CanvasContextType {
  canvasImages: CanvasImage[];
  setCanvasImages: React.Dispatch<React.SetStateAction<CanvasImage[]>>;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  updateImage: (id: string, changes: Partial<CanvasImage>) => void;
  handleBringToFront: () => void;
  handleSendToBack: () => void;
}

const CanvasContext = createContext<CanvasContextType | undefined>(undefined);

export const CanvasProvider = ({ children }: { children: ReactNode }) => {
  const [canvasImages, setCanvasImages] = useState<CanvasImage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const updateImage = (id: string, changes: Partial<CanvasImage>) => {
    setCanvasImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, ...changes } : img))
    );
  };

  const handleBringToFront = () => {
    if (!selectedId) return;
    setCanvasImages((prev) => {
      const selected = prev.find((i) => i.id === selectedId);
      if (!selected) return prev;
      return [...prev.filter((i) => i.id !== selectedId), selected];
    });
  };

  const handleSendToBack = () => {
    if (!selectedId) return;
    setCanvasImages((prev) => {
      const selected = prev.find((i) => i.id === selectedId);
      if (!selected) return prev;
      return [selected, ...prev.filter((i) => i.id !== selectedId)];
    });
  };

  return (
    <CanvasContext.Provider
      value={{
        canvasImages,
        setCanvasImages,
        selectedId,
        setSelectedId,
        updateImage,
        handleBringToFront,
        handleSendToBack,
      }}
    >
      {children}
    </CanvasContext.Provider>
  );
};

export const useCanvas = () => {
  const context = useContext(CanvasContext);
  if (context === undefined) {
    throw new Error("useCanvas must be used within a CanvasProvider");
  }
  return context;
};
