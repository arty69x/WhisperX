export const playSound = (type: 'hover' | 'click' | 'success' | 'generate') => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        const now = ctx.currentTime;
        
        // Very subtle volume levels
        const masterVol = 0.03;
        
        if (type === 'hover') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.03);
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(masterVol, now + 0.01);
            gain.gain.linearRampToValueAtTime(0, now + 0.03);
            osc.start(now);
            osc.stop(now + 0.03);
        } else if (type === 'click') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(300, now + 0.08);
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(masterVol * 1.5, now + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            osc.start(now);
            osc.stop(now + 0.08);
        } else if (type === 'success') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, now); // A4
            osc.frequency.setValueAtTime(554.37, now + 0.1); // C#
            osc.frequency.setValueAtTime(659.25, now + 0.2); // E
            
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(masterVol * 2, now + 0.05);
            gain.gain.linearRampToValueAtTime(masterVol, now + 0.3);
            gain.gain.linearRampToValueAtTime(0, now + 0.5);
            osc.start(now);
            osc.stop(now + 0.5);
        } else if (type === 'generate') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.4);
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(masterVol * 1.5, now + 0.05);
            gain.gain.linearRampToValueAtTime(0, now + 0.4);
            
            // Add a second oscillator for depth
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sawtooth';
            osc2.frequency.setValueAtTime(100, now);
            osc2.frequency.exponentialRampToValueAtTime(200, now + 0.4);
            gain2.gain.setValueAtTime(0, now);
            gain2.gain.linearRampToValueAtTime(masterVol, now + 0.05);
            gain2.gain.linearRampToValueAtTime(0, now + 0.4);
            
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            
            osc2.start(now);
            osc2.stop(now + 0.4);
            
            osc.start(now);
            osc.stop(now + 0.4);
        }
    } catch (e) {
        // ignore audio errors
    }
}
