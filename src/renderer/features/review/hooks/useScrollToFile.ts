import { useRef, useCallback, useState } from 'react';

interface UseScrollToFileReturn {
  fileRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  highlightedFile: string | null;
  scrollToFile: (filePath: string) => void;
  registerFileRef: (filePath: string, element: HTMLDivElement | null) => void;
}

export function useScrollToFile(): UseScrollToFileReturn {
  const fileRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [highlightedFile, setHighlightedFile] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const registerFileRef = useCallback(
    (filePath: string, element: HTMLDivElement | null) => {
      if (element) {
        fileRefs.current.set(filePath, element);
      } else {
        fileRefs.current.delete(filePath);
      }
    },
    []
  );

  const scrollToFile = useCallback((filePath: string) => {
    const element = fileRefs.current.get(filePath);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // Clear any existing highlight timeout
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }

      // Briefly highlight the file
      setHighlightedFile(filePath);
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedFile(null);
      }, 1500);
    }
  }, []);

  return {
    fileRefs,
    highlightedFile,
    scrollToFile,
    registerFileRef,
  };
}
