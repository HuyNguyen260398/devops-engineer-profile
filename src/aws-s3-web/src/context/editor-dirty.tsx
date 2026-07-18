"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

interface EditorDirtyValue {
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
}

const EditorDirtyContext = createContext<EditorDirtyValue>({ dirty: false, setDirty: () => undefined });

export function EditorDirtyProvider({ children }: { children: ReactNode }) {
  const [dirty, setDirtyState] = useState(false);
  // Mirror the flag in a ref so the beforeunload handler reads the live value.
  // A programmatic save clears this synchronously before navigating, avoiding a
  // spurious "Leave site?" prompt that a state update alone would race against.
  const dirtyRef = useRef(false);
  const setDirty = useCallback((d: boolean) => {
    dirtyRef.current = d;
    setDirtyState(d);
  }, []);

  // Guard accidental tab close / reload while there are unsaved edits.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  return <EditorDirtyContext.Provider value={{ dirty, setDirty }}>{children}</EditorDirtyContext.Provider>;
}

export function useEditorDirty(): EditorDirtyValue {
  return useContext(EditorDirtyContext);
}
