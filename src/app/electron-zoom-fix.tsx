import { useEffect } from 'react';

export const ElectronZoomFix = () => {
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && 
          (e.key === '+' || e.key === '-' || e.key === '0' || e.key === '=' || 
           e.key === 'Add' || e.key === 'Subtract')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // Mit capture: true werden Events früher abgefangen
    document.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    document.addEventListener('keydown', handleKeydown, { capture: true });

    return () => {
      document.removeEventListener('wheel', handleWheel);
      document.removeEventListener('keydown', handleKeydown);
    };
  }, []);

  return null;
};