import { useEffect, useCallback, useRef } from 'react';

export const useKonamiCode = (callback: () => void) => {
    const keysRef = useRef<string[]>([]);
    const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

    const onKeyDown = useCallback((e: KeyboardEvent) => {
        keysRef.current = [...keysRef.current, e.key].slice(-konamiCode.length);
        if (JSON.stringify(keysRef.current) === JSON.stringify(konamiCode)) {
            callback();
            keysRef.current = [];
        }
    }, [callback, konamiCode]);

    useEffect(() => {
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onKeyDown]);
};