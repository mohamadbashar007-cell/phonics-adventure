declare global {
  interface Window {
    __missingImageLoggerAttached?: boolean;
  }
}

const logMissingImage = (target: HTMLImageElement) => {
  const relativePath = target.src.replace(window.location.origin, '');
  console.warn(`[images] Missing asset: ${relativePath || target.src}`);
};

export const registerMissingImageLogger = () => {
  if (typeof window === 'undefined' || !import.meta.env.DEV || window.__missingImageLoggerAttached) {
    return;
  }

  const handleErrorCapture = (event: Event) => {
    const target = event.target as HTMLElement | null;
    if (!target || !(target instanceof HTMLImageElement)) return;
    logMissingImage(target);
  };

  window.addEventListener('error', handleErrorCapture, true);
  window.__missingImageLoggerAttached = true;
};
