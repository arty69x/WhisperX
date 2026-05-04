import React, { useState, useEffect } from 'react';
import { XMarkIcon, ChevronRightIcon, ChevronLeftIcon, CheckIcon } from '@heroicons/react/24/outline';

interface OnboardingProps {
    onClose: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onClose }) => {
    const [step, setStep] = useState(0);

    const steps = [
        {
            title: "Welcome to WhisperX",
            description: "An advanced AI-powered interface builder. Let's walk through how to convert your ideas into reality.",
            target: "welcome",
            position: "center" as const
        },
        {
            title: "Step 1: The Uplink Node",
            description: "Drag and drop any design artifact—a napkin sketch, a wireframe, or a screenshot—into the core node, or simply type a prompt describing what you want.",
            target: "upload-area",
            position: "bottom" as const
        },
        {
            title: "Step 2: Live Preview",
            description: "Watch as the AI synthesizes your UI in real-time. You can interact with the generated components immediately in this holographic viewport.",
            target: "preview-area",
            position: "center" as const
        },
        {
            title: "Step 3: The AI Assistant",
            description: "Open the chat panel to refine your creation. Select any code block or element and ask the AI to modify styles, add logic, or explain the architecture.",
            target: "chat-panel",
            position: "bottom" as const
        }
    ];

    const currentStep = steps[step];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 animate-[fadeIn_0.5s_ease-out]">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-bg/80 backdrop-blur-md transition-all duration-500"></div>

            {/* Modal */}
            <div className="relative w-full max-w-lg bg-bg2 border border-acc/40 rounded-3xl shadow-[0_0_80px_rgba(0,216,255,0.15)] overflow-hidden">
                {/* Glow */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-acc via-pur to-acc"></div>
                
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-dim hover:text-white hover:bg-bg3 rounded-full transition-colors"
                >
                    <XMarkIcon className="w-5 h-5" />
                </button>

                <div className="p-8">
                    <div className="flex items-center space-x-2 mb-6">
                        {steps.map((_, i) => (
                            <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === step ? 'w-8 bg-acc shadow-[0_0_10px_rgba(0,216,255,0.8)]' : i < step ? 'w-4 bg-pur/50' : 'w-4 bg-bdr'}`}></div>
                        ))}
                    </div>

                    <h2 className="text-2xl font-bold font-display text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60 mb-4 tracking-tight">
                        {currentStep.title}
                    </h2>
                    <p className="text-dim text-sm sm:text-base leading-relaxed mb-8">
                        {currentStep.description}
                    </p>

                    <div className="flex justify-between items-center mt-8">
                        <button 
                            onClick={() => setStep(Math.max(0, step - 1))}
                            disabled={step === 0}
                            className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all ${step === 0 ? 'opacity-0 pointer-events-none' : 'text-dim hover:text-white hover:bg-bg3'}`}
                        >
                            <ChevronLeftIcon className="w-4 h-4" />
                            <span className="text-sm font-bold uppercase tracking-wider">Back</span>
                        </button>

                        {step < steps.length - 1 ? (
                            <button 
                                onClick={() => setStep(step + 1)}
                                className="flex items-center space-x-2 px-6 py-3 bg-acc/10 text-acc border border-acc/30 hover:border-acc rounded-xl hover:shadow-[0_0_20px_rgba(0,216,255,0.4)] transition-all font-bold uppercase tracking-wider text-sm"
                            >
                                <span>Next</span>
                                <ChevronRightIcon className="w-4 h-4" />
                            </button>
                        ) : (
                            <button 
                                onClick={onClose}
                                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-acc to-pur text-white shadow-[0_0_20px_rgba(0,216,255,0.4)] hover:shadow-[0_0_30px_rgba(124,77,255,0.6)] rounded-xl transition-all font-bold uppercase tracking-wider text-sm hover:scale-105"
                            >
                                <span>Initialize</span>
                                <CheckIcon className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
