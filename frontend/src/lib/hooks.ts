import { useState, useEffect } from 'react';

/**
 * Hook that delays showing loading state to prevent flickering when data loads quickly
 * @param isLoading - The actual loading state
 * @param delay - Delay in milliseconds before showing loading state (default: 200ms)
 * @returns boolean indicating whether to show loading state
 */
export function useDelayedLoading(isLoading: boolean, delay: number = 200): boolean {
  const [showLoading, setShowLoading] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (isLoading) {
      // Start timer to show loading state after delay
      timeoutId = setTimeout(() => {
        setShowLoading(true);
      }, delay);
    } else {
      // Immediately hide loading state when data is loaded
      setShowLoading(false);
    }

    return () => {
      clearTimeout(timeoutId);
    };
  }, [isLoading, delay]);

  return showLoading;
}
