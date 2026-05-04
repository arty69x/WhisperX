import React, { useCallback, useState, useEffect, useRef } from 'react';
import { SparklesIcon, CpuChipIcon } from '@heroicons/react/24/outline';

interface InputAreaProps {
  onGenerate: (prompt: string, file?: File) => void;
  isGenerating: boolean;
  disabled?: boolean;
}

const CyclingText = () => {
    const words = [
        "A NAPKIN SKETCH",
        "A CHAOTIC WHITEBOARD",
        "A DASHBOARD BLUEPRINT",
        "A SCI-FI INTERFACE",
        "A DIAGRAM OF A MACHINE",
        "AN ANCIENT SCROLL"
    ];
    const [index, setIndex] = useState(0);
    const [fade, setFade] = useState(true);

    useEffect(() => {
        const interval = setInterval(() => {
            setFade(false);
            setTimeout(() => {
                setIndex(prev => (prev + 1) % words.length);
                setFade(true);
            }, 600);
        }, 3500);
        return () => clearInterval(interval);
    }, [words.length]);

    return (
        <span className={`inline-block whitespace-nowrap transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] transform ${fade ? 'opacity-100 translate-y-0 filter-none scale-100' : 'opacity-0 translate-y-8 blur-lg scale-90'} text-transparent bg-clip-text bg-gradient-to-r from-[#b28dff] via-white to-acc font-black pb-2 border-b border-acc/20 drop-shadow-[0_0_15px_rgba(0,216,255,0.5)] uppercase tracking-tight`}>
            {words[index]}
        </span>
    );
};

export const InputArea: React.FC<InputAreaProps> = ({ onGenerate, isGenerating, disabled = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const cardRef = useRef<HTMLLabelElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLLabelElement>) => {
    if (!cardRef.current || isGenerating || disabled) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Intense 3D tilt
    const rotateXValue = -((y - centerY) / centerY) * 10;
    const rotateYValue = ((x - centerX) / centerX) * 10;
    setRotateX(rotateXValue);
    setRotateY(rotateYValue);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
  };

  const handleFile = (file: File) => {
    const MAX_SIZE_MB = 10;
    const isSupportedType = file.type.startsWith('image/') || file.type === 'application/pdf';
    const isUnderSize = file.size <= MAX_SIZE_MB * 1024 * 1024;

    if (!isSupportedType) {
      alert("Format violation. Please select an image or PDF artifact.");
      return;
    }
    
    if (!isUnderSize) {
      alert(`Mass exceeds safe limits. Max ${MAX_SIZE_MB}MB allowed.`);
      return;
    }

    onGenerate("", file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        handleFile(e.target.files[0]);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || isGenerating) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [disabled, isGenerating]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    if (!disabled && !isGenerating) {
        setIsDragging(true);
    }
  }, [disabled, isGenerating]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  return (
    <div className="w-full max-w-5xl mx-auto perspective-[2000px] mt-8 pb-32 px-4">
      <div 
        className={`relative group transition-all duration-700 ease-out ${isDragging ? 'scale-[1.02]' : ''}`}
        style={{ perspective: "2000px" }}
      >
        {/* Glow underneath the card */}
        <div className={`absolute -inset-1 bg-gradient-to-r from-acc via-pur to-acc rounded-[2rem] blur-2xl opacity-20 group-hover:opacity-60 transition-opacity duration-700 ease-out animate-pulse ${isDragging ? 'opacity-80' : ''}`}></div>

        <label
          ref={cardRef}
          className={`
            relative block w-full
            h-72 sm:h-80 md:h-[26rem]
            bg-bg2/80 
            backdrop-blur-3xl
            rounded-[2rem] border border-white/5
            cursor-pointer overflow-hidden
            transition-all duration-700 ease-out
            shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_20px_60px_-10px_rgba(0,0,0,0.8)]
            ${isDragging 
              ? 'border-acc/50 bg-bg2/90 shadow-[inset_0_0_80px_rgba(0,216,255,0.2)]' 
              : 'hover:border-acc/30 hover:bg-bg3/60 hover:shadow-[0_30px_80px_rgba(0,0,0,0.8)] hover:shadow-acc/20'
            }
            ${isGenerating ? 'pointer-events-none' : ''}
          `}
          style={{
            transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(0)`,
            transformStyle: "preserve-3d"
          }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
            {/* Holographic background grid */}
            <div className="absolute inset-0 pointer-events-none opacity-20 group-hover:opacity-40 transition-opacity duration-700 mix-blend-screen" 
                 style={{backgroundImage: 'radial-gradient(circle at center, rgba(0,216,255,0.2) 2px, transparent 2px)', backgroundSize: '40px 40px', backgroundPosition: 'center', transform: 'translateZ(-50px)'}}>
            </div>

            {/* Dynamic scanline element */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[2rem]">
               <div className="w-full h-1 bg-gradient-to-r from-transparent via-acc/50 to-transparent shadow-[0_0_20px_rgba(0,216,255,0.8)] transform -translate-y-full opacity-0 group-hover:opacity-100 group-hover:animate-[wave_3s_ease-in-out_infinite_alternate]"></div>
            </div>
            
            {/* Cyberpunk corner accents */}
            <svg className={`absolute top-6 left-6 w-16 h-16 pointer-events-none fill-none stroke-current stroke-[2] transition-colors duration-700 ${isDragging ? 'text-acc' : 'text-white/10 group-hover:text-acc/60'}`} viewBox="0 0 100 100">
               <path d="M 0,20 L 0,0 L 20,0" />
               <circle cx="10" cy="10" r="2" fill="currentColor" />
            </svg>
            <svg className={`absolute top-6 right-6 w-16 h-16 pointer-events-none fill-none stroke-current stroke-[2] transition-colors duration-700 ${isDragging ? 'text-acc' : 'text-white/10 group-hover:text-acc/60'}`} viewBox="0 0 100 100">
               <path d="M 100,20 L 100,0 L 80,0" />
               <circle cx="90" cy="10" r="2" fill="currentColor" />
            </svg>
            <svg className={`absolute bottom-6 left-6 w-16 h-16 pointer-events-none fill-none stroke-current stroke-[2] transition-colors duration-700 ${isDragging ? 'text-acc' : 'text-white/10 group-hover:text-acc/60'}`} viewBox="0 0 100 100">
               <path d="M 0,80 L 0,100 L 20,100" />
               <circle cx="10" cy="90" r="2" fill="currentColor" />
            </svg>
            <svg className={`absolute bottom-6 right-6 w-16 h-16 pointer-events-none fill-none stroke-current stroke-[2] transition-colors duration-700 ${isDragging ? 'text-acc' : 'text-white/10 group-hover:text-acc/60'}`} viewBox="0 0 100 100">
               <path d="M 100,80 L 100,100 L 80,100" />
               <circle cx="90" cy="90" r="2" fill="currentColor" />
            </svg>

            {/* Inner Content with 3D Pop */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 z-10" style={{ transform: "translateZ(80px)" }}>
                
                {/* Visual core node */}
                <div className="relative mb-12 flex justify-center">
                    {/* Ring 1 - Outer */}
                    <div className={`absolute inset-0 -m-8 border border-white/5 rounded-full transition-all duration-1000 ${isGenerating ? 'animate-[spin_4s_linear_infinite] border-acc/20' : 'group-hover:border-pur/20 group-hover:scale-110'}`}></div>
                    {/* Ring 2 - Inner */}
                    <div className={`absolute inset-0 -m-4 border border-dashed border-white/10 rounded-full transition-all duration-1000 ${isGenerating ? 'animate-[spin_3s_linear_infinite_reverse] border-acc/40' : 'group-hover:border-acc/30 group-hover:scale-[1.15]'}`}></div>
                    
                    <div className={`relative w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center transition-all duration-700 shadow-2xl ${isDragging ? 'scale-110 bg-acc/10 shadow-[0_0_40px_rgba(0,216,255,0.4)]' : 'bg-white/5 group-hover:-translate-y-2 group-hover:shadow-[0_20px_40px_rgba(0,216,255,0.2)] group-hover:bg-white/10'}`}>
                        {isGenerating ? (
                            <CpuChipIcon className="w-10 h-10 md:w-12 md:h-12 text-acc drop-shadow-[0_0_12px_rgba(0,216,255,1)] animate-pulse" />
                        ) : (
                            <SparklesIcon className={`w-10 h-10 md:w-12 md:h-12 transition-all duration-700 ${isDragging ? 'text-acc drop-shadow-[0_0_12px_rgba(0,216,255,0.8)]' : 'text-white/50 group-hover:text-white'}`} />
                        )}
                    </div>
                </div>

                <div className="space-y-4 md:space-y-6 w-full max-w-4xl text-center">
                    <h3 className="flex flex-col items-center justify-center text-2xl sm:text-3xl md:text-5xl lg:text-5xl text-txt leading-[1.1] font-black font-display tracking-tighter gap-2 transition-all duration-700 group-hover:drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                        {isGenerating ? (
                            <div className="flex flex-col items-center">
                                <span className="text-acc drop-shadow-[0_0_12px_rgba(0,216,255,0.8)] tracking-widest uppercase text-xl md:text-3xl">Synthesizing Reality</span>
                                <div className="flex space-x-3 mt-6">
                                    <span className="w-3 h-3 bg-acc rounded-full animate-[bounce_1s_infinite_0ms] shadow-[0_0_10px_#00d8ff]"></span>
                                    <span className="w-3 h-3 bg-white rounded-full animate-[bounce_1s_infinite_200ms] shadow-[0_0_10px_#fff]"></span>
                                    <span className="w-3 h-3 bg-pur rounded-full animate-[bounce_1s_infinite_400ms] shadow-[0_0_10px_#7c4dff]"></span>
                                </div>
                            </div>
                        ) : isDragging ? (
                            <span className="text-acc drop-shadow-[0_0_15px_rgba(0,216,255,1)] text-4xl uppercase tracking-widest">Release to Initialize</span>
                        ) : (
                            <>
                                <span className="text-white/80 group-hover:text-white transition-colors duration-500">CONVERT</span>
                                <div className="h-10 sm:h-12 md:h-16 lg:h-20 flex items-center justify-center w-full">
                                   <CyclingText />
                                </div>
                                <span className="text-white/80 group-hover:text-white transition-colors duration-500">INTO EXISTENCE</span>
                            </>
                        )}
                    </h3>
                    <p className={`text-muted text-xs sm:text-sm md:text-base font-medium tracking-[0.3em] uppercase font-mono transition-all duration-500 scale-100 ${isDragging ? 'text-acc opacity-100 scale-105' : 'group-hover:text-acc/80 opacity-60 group-hover:opacity-100'}`}>
                        {isGenerating ? "Processing multi-dimensional matrices" : isDragging ? "Uplink sequence ready" : "Drag artifact to begin uplink"}
                    </p>
                </div>
            </div>

            <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileChange}
                disabled={isGenerating || disabled}
            />
        </label>
      </div>
    </div>
  );
};
