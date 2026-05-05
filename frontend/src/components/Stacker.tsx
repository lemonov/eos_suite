"use client";

import { useState } from "react";
import { Layers, CheckCircle2, Loader2, Play, Terminal, AlertCircle, Maximize2, Minimize2, ChevronDown, ChevronRight } from "lucide-react";

interface StackerProps {
  images: {
    raw: any[];
    processed: any[];
    stacked: any[];
  };
  onStackComplete: () => void;
}

export default function Stacker({ images, onStackComplete }: StackerProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [stacking, setStacking] = useState(false);
  const [outputName, setOutputName] = useState(`stack_${new Date().getTime()}.tif`);
  const [logs, setLogs] = useState<string>("");
  const [showLogs, setShowLogs] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<any | null>(null);
  
  // Stacking flags
  const [noContrast, setNoContrast] = useState(false);
  const [noPropagate, setNoPropagate] = useState(false);

  // Grouping & Toggle state
  const groups: Record<string, any[]> = {};
  images.raw.forEach(img => {
    const sessionKey = img.session || "Unknown Date";
    if (!groups[sessionKey]) groups[sessionKey] = [];
    groups[sessionKey].push(img);
  });
  
  const sortedDayKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (sortedDayKeys.length > 0) {
      initial[sortedDayKeys[0]] = true;
    }
    return initial;
  });

  const toggleGroup = (key: string) => {
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const formatSessionName = (session: string) => {
    if (!session || session === "Legacy" || session === "Unknown Date" || !session.includes('/')) return session || "Unknown Date";
    const parts = session.split('/');
    const dateParts = parts[0].split('_'); 
    const timeParts = parts[1].split('_'); 
    if (dateParts.length === 3 && timeParts.length === 3) {
      return `${dateParts[2]}/${dateParts[1]}/${dateParts[0]} ${timeParts[0]}:${timeParts[1]}:${timeParts[2]}`;
    }
    return session;
  };

  const toggleSelect = (name: string) => {
    setSelected(prev => 
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const handleStack = async () => {
    if (selected.length < 2) return alert("Select at least 2 images to stack");
    setStacking(true);
    setLogs("Initializing focus stack...\n");
    setShowLogs(true);
    
    const flags = [];
    if (noContrast) flags.push("--no-contrast");
    if (noPropagate) flags.push("--no-propagate");

    try {
      const res = await fetch("http://localhost:8000/stack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          image_names: selected, 
          output_name: outputName,
          flags: flags
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setLogs(prev => prev + (data.logs || "Stacking complete successfully."));
        onStackComplete();
        setSelected([]);
      } else {
        setShowLogs(true);
        // Robust error extraction
        let errorMsg = "Stacking failed";
        let detailedLogs = "";
        
        if (typeof data.detail === 'object') {
          errorMsg = data.detail.message || errorMsg;
          detailedLogs = data.detail.logs || "";
        } else {
          errorMsg = data.detail || errorMsg;
        }
        
        setLogs(prev => prev + `\n\n[!] ERROR: ${errorMsg}\n\n${detailedLogs}`);
      }
    } catch (e) {
      setShowLogs(true);
      setLogs(prev => prev + `\n\n[!] NETWORK ERROR: Failed to communicate with the stacking service.`);
    }
  };

  const handleBatchStack = async () => {
    const batchGroups: string[][] = [];
    const batchNames: string[] = [];
    
    Object.keys(groups).forEach(key => {
      const list = groups[key];
      if (list.length >= 2) {
        batchGroups.push(list.map(i => i.name));
        const cleanKey = key.replace(/[^a-zA-Z0-9]/g, '_');
        batchNames.push(`batch_stack_${cleanKey}.tif`);
      }
    });

    if (batchGroups.length === 0) return alert("No groups containing 2 or more RAW frames found.");
    
    setStacking(true);
    setLogs(`Initializing Auto-Batch Stacking for ${batchGroups.length} sequential sessions...\n`);
    setShowLogs(true);
    
    const flags = [];
    if (noContrast) flags.push("--no-contrast");
    if (noPropagate) flags.push("--no-propagate");

    try {
      const res = await fetch("http://localhost:8000/stack/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          groups: batchGroups, 
          output_names: batchNames,
          flags: flags
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        setLogs(prev => prev + `\n\n[✓] Batch successfully processed!\nGenerated: ${data.results?.length || 0} images.\nErrors: ${data.errors?.length || 0}`);
        onStackComplete();
      } else {
        setLogs(prev => prev + `\n\n[!] Error encountered across batch jobs.`);
      }
    } catch (e) {
      setLogs(prev => prev + `\n\n[!] Network exception during batch execution.`);
    } finally {
      setStacking(false);
    }
  };

  return (
    <div className="flex h-full bg-[#151515]">
      {/* Selection Grid */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {sortedDayKeys.map(dayKey => {
          const folderName = formatSessionName(dayKey);
          const isOpen = openGroups[dayKey] ?? false;
          
          return (
            <div key={dayKey} className="border border-white/5 bg-black/20 rounded-md overflow-hidden">
              <button 
                onClick={() => toggleGroup(dayKey)}
                className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                  <span className="text-xs font-bold uppercase tracking-widest text-white/80">{folderName}</span>
                  <span className="text-[10px] text-white/40 ml-2">({groups[dayKey].length} items)</span>
                </div>
              </button>
              
              {isOpen && (
                <div className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 bg-[#111]">
                  {groups[dayKey].map((img: any, idx: number) => (
                    <div 
                      key={idx} 
                      onClick={() => toggleSelect(img.name)}
                      className={`cursor-pointer group relative bg-black/40 border transition-all rounded-sm aspect-square overflow-hidden flex flex-col ${selected.includes(img.name) ? 'border-dark-accent ring-2 ring-dark-accent/20' : 'border-white/5 hover:border-white/20'}`}
                    >
                      <div className="relative flex-1 bg-black/20 min-h-0">
                        <img src={`http://localhost:8000${img.url}`} className="object-cover w-full h-full grayscale group-hover:grayscale-0 transition-all duration-500" alt={img.name} />
                        
                        <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-xs text-[8px] font-bold uppercase bg-blue-600/80 text-white z-10">
                          RAW
                        </div>

                        {selected.includes(img.name) && (
                          <div className="absolute top-1 right-1 text-dark-accent drop-shadow-lg animate-in zoom-in duration-200 z-10">
                            <CheckCircle2 size={18} fill="#151515" />
                          </div>
                        )}
                        
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setEnlargedImage(img); }}
                            className="bg-black/80 hover:text-dark-accent p-2 rounded-full text-white/50 hover:text-white transition-colors"
                            title="Fullscreen Preview"
                          >
                              <Maximize2 size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Filename Footer - Solid flex display */}
                      <div className="bg-[#111] p-2 border-t border-white/5 shrink-0">
                        <p className="text-[10px] font-bold text-white/90 truncate leading-tight" title={img.name}>
                          {img.name}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {images.raw.length === 0 && (
          <div className="text-center py-20 opacity-20">
            <p className="text-sm font-bold uppercase tracking-wider">No RAW images available for stacking</p>
          </div>
        )}
      </div>

      {/* Control Panel */}
      <div className="w-96 panel border-l bg-dark-sidebar p-6 flex flex-col gap-6 overflow-auto">
        <h3 className="sidebar-title flex items-center gap-2">
            <Layers size={14} className="text-dark-accent" /> Focus Stacking Workflow
        </h3>
        
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] opacity-40 uppercase">Output Filename</label>
            <input 
              type="text" 
              value={outputName} 
              onChange={e => setOutputName(e.target.value)}
              className="dark-input w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] opacity-40 uppercase">Algorithmic Options</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[11px] cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={noContrast} 
                  onChange={e => setNoContrast(e.target.checked)}
                  className="accent-dark-accent w-3 h-3"
                />
                <span className="opacity-60 group-hover:opacity-100 transition-opacity">Disable Contrast Match (--no-contrast)</span>
              </label>
              <label className="flex items-center gap-2 text-[11px] cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={noPropagate} 
                  onChange={e => setNoPropagate(e.target.checked)}
                  className="accent-dark-accent w-3 h-3"
                />
                <span className="opacity-60 group-hover:opacity-100 transition-opacity">No Info Propagation (--no-propagate)</span>
              </label>
            </div>
          </div>
        </div>

        <div className="p-4 bg-black/20 rounded-xs border border-white/5 space-y-2">
           <div className="flex justify-between text-[10px] uppercase">
             <span className="opacity-40">Selected Frames</span>
             <span className="text-dark-accent font-bold">{selected.length}</span>
           </div>
           <p className="text-[9px] opacity-30 leading-relaxed">
             Alignment and blending using the pre-compiled Fast Focus-Stacking binary.
           </p>
        </div>
        
        <div className="flex flex-col gap-2">
          <button
            onClick={handleStack}
            disabled={selected.length < 2 || stacking}
            className="w-full bg-dark-accent hover:bg-dark-accent/80 disabled:bg-white/5 text-black font-bold py-3 rounded-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 text-xs"
          >
            {stacking ? <Loader2 className="animate-spin" size={14} /> : <Play size={14} />}
            {stacking ? "Processing Stack..." : "Run Z-Stack"}
          </button>

          <button
            onClick={handleBatchStack}
            disabled={stacking}
            className="w-full bg-[#111] hover:bg-white/5 border border-white/5 disabled:opacity-30 text-white/80 font-bold py-2 rounded-sm flex items-center justify-center gap-2 shadow-md transition-all text-[10px] uppercase"
            title="Automatically processes all sets that contain 2 or more RAW exposures."
          >
            {stacking ? <Loader2 className="animate-spin" size={12} /> : <Layers size={12} />}
            Auto-Batch All Groups
          </button>
        </div>

        {showLogs && (
          <div className="flex-1 flex flex-col min-h-[200px]">
            <div className="flex items-center gap-2 mb-2">
               <Terminal size={12} className="text-dark-accent" />
               <span className="text-[10px] uppercase tracking-widest font-bold opacity-40">Process Logs</span>
               <button onClick={() => setLogs("")} className="ml-auto text-[9px] opacity-30 hover:opacity-100 uppercase">Clear</button>
            </div>
            <div className="flex-1 bg-black/40 rounded border border-white/5 p-3 font-mono text-[10px] whitespace-pre-wrap overflow-auto scrollbar-thin scrollbar-thumb-white/10 max-h-[400px]">
              {logs || "Waiting for output..."}
            </div>
          </div>
        )}

        <div className="mt-auto opacity-20 text-[9px] space-y-1 underline decoration-dotted">
           <p>Algorithm: focus-stack (Petteri Aimonen)</p>
           <p>OpenCV-based alignment & wavelet blending</p>
        </div>
      </div>

      {/* Fullscreen Preview Modal */}
      {enlargedImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center backdrop-blur-sm"
          onClick={() => setEnlargedImage(null)}
        >
          <button 
            onClick={() => setEnlargedImage(null)}
            className="absolute top-6 right-6 text-white/50 hover:text-white bg-white/5 p-3 rounded-full transition-colors z-50"
          >
            <Minimize2 size={24} />
          </button>
          
          <div className="relative max-w-[95vw] max-h-[95vh] flex flex-col items-center">
            <img 
              src={`http://localhost:8000${enlargedImage.normalized_url || enlargedImage.url}`} 
              className="max-w-full max-h-[90vh] object-contain" 
              alt={`Fullscreen ${enlargedImage.name}`}
              onClick={(e) => e.stopPropagation()} 
            />
            <div className="mt-4 px-4 py-2 bg-black/50 rounded flex gap-4 text-xs font-bold items-center sticky bottom-0">
              <span className="opacity-50 text-white">Filename:</span>
              <span className="text-white">{enlargedImage.name}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
