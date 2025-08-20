import React, { useState, useEffect, useCallback, useRef } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
}

const CursorTrail: React.FC = () => {
    const [particles, setParticles] = useState<Particle[]>([]);
    const particleId = useRef(0);

    const addParticle = useCallback((x: number, y: number) => {
        const id = particleId.current++;
        setParticles(prev => [...prev.slice(-40), { id, x, y }]);
        setTimeout(() => {
            setParticles(prev => prev.filter(p => p.id !== id));
        }, 1200); // Animation duration
    }, []);

    useEffect(() => {
        let lastTime = 0;
        const throttleInterval = 16; // ms

        const handleMouseMove = (e: MouseEvent) => {
            const now = Date.now();
            if (now - lastTime < throttleInterval) return;
            lastTime = now;
            addParticle(e.clientX, e.clientY);
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [addParticle]);
    
    return (
        <div className="pointer-events-none fixed inset-0 z-[9999]">
            {particles.map(p => (
                <div
                    key={p.id}
                    className="absolute rounded-full animate-[wisp-fade-out_1.2s_ease-out_forwards]"
                    style={{
                        left: p.x - 6,
                        top: p.y - 6,
                        width: '12px',
                        height: '12px',
                        background: 'radial-gradient(circle, rgba(var(--color-primary-rgb),0.8) 0%, rgba(var(--color-secondary-rgb),0.4) 100%)',
                    }}
                />
            ))}
        </div>
    );
};

export default CursorTrail;