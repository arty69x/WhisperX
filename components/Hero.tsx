import React from 'react';
import { SparklesIcon } from '@heroicons/react/24/outline';

export const Hero: React.FC = () => {
  return (
    <div className="relative z-10 w-full max-w-5xl mx-auto px-6 pt-24 pb-16 flex flex-col items-center">
        {/* Futuristic Origin Badge */}
        <div className="group relative inline-flex items-center space-x-3 mb-12 px-6 py-3 rounded-full border border-white/10 bg-white/5 backdrop-blur-2xl overflow-hidden cursor-default transition-all duration-700 hover:border-acc/50 hover:bg-white/10 hover:shadow-[0_0_40px_rgba(0,216,255,0.3)] hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-r from-acc/10 to-pur/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out"></div>
            <div className="relative z-10 flex items-center space-x-3">
              <SparklesIcon className="w-5 h-5 text-acc drop-shadow-[0_0_12px_#00d8ff] group-hover:animate-pulse" />
              <span className="font-mono text-xs md:text-sm font-bold tracking-[0.3em] text-transparent bg-clip-text bg-gradient-to-r from-acc via-white to-acc bg-[length:200%_auto] animate-hologram uppercase">WhisperX Synth Engine</span>
            </div>
        </div>

        {/* Massive Dimensional Typography */}
        <h1 className="text-6xl sm:text-7xl md:text-[7.5rem] lg:text-[8.5rem] font-display font-black tracking-tighter text-center leading-[0.8] mb-12 drop-shadow-2xl flex flex-col items-center">
          <span className="block text-transparent bg-clip-text bg-gradient-to-b from-white via-white/90 to-white/30 drop-shadow-[0_10px_40px_rgba(255,255,255,0.15)] pb-6">
             REALITY TO
          </span>
          <span className="relative inline-block mt-2">
             <span className="absolute inset-0 bg-gradient-to-r from-acc via-pur to-acc blur-[80px] opacity-40 animate-pulse"></span>
             <span className="absolute inset-0 bg-gradient-to-r from-acc via-pur to-acc blur-[30px] opacity-80 mix-blend-screen"></span>
             <span className="relative text-transparent bg-clip-text bg-gradient-to-r from-acc via-[#b28dff] to-acc bg-[length:200%_auto] animate-hologram inline-block filter drop-shadow-[0_0_20px_rgba(0,216,255,0.8)] pb-4">CODE.</span>
          </span>
        </h1>
        
        {/* Subtle high-end description text */}
        <p className="text-lg sm:text-xl md:text-2xl text-muted font-light tracking-wider text-center max-w-3xl mx-auto leading-relaxed px-8">
          The absolute pinnacle of visual translation. Upload any abstract reference and let <strong className="text-txt font-medium tracking-widest uppercase font-mono text-sm ml-1 relative"><span className="absolute -bottom-1 left-0 w-full h-[2px] bg-acc/50"></span>WhisperX</strong> render a flawless, interactive digital twin.
        </p>
    </div>
  );
};
