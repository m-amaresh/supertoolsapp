"use client";

import { useCallback, useState } from "react";

export interface ToolState {
  input: string;
  output: string;
  error: string | null;
}

export interface ToolStateActions {
  setInput: (value: string) => void;
  setOutput: (value: string) => void;
  setError: (value: string | null) => void;
  handleClear: () => void;
  handlePasteFromClipboard: (
    clipboardReadFn: () => Promise<string | null>,
    onPaste?: (text: string) => void,
  ) => Promise<void>;
}

/**
 * Custom hook for managing common tool state (input, output, error)
 * and providing standard handlers for clear and clipboard paste operations.
 */
export function useToolState(
  initialInput = "",
  initialOutput = "",
  initialError: string | null = null,
): [ToolState, ToolStateActions] {
  const [input, setInput] = useState(initialInput);
  const [output, setOutput] = useState(initialOutput);
  const [error, setError] = useState<string | null>(initialError);

  const handleClear = useCallback(() => {
    setInput("");
    setOutput("");
    setError(null);
  }, []);

  const handlePasteFromClipboard = useCallback(
    async (
      clipboardReadFn: () => Promise<string | null>,
      onPaste?: (text: string) => void,
    ) => {
      const text = await clipboardReadFn();
      if (text !== null) {
        setInput(text);
        onPaste?.(text);
      }
    },
    [],
  );

  const state: ToolState = { input, output, error };
  const actions: ToolStateActions = {
    setInput,
    setOutput,
    setError,
    handleClear,
    handlePasteFromClipboard,
  };

  return [state, actions];
}
