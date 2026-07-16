"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

interface EditorDirtyValue {
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
}

const EditorDirtyContext = createContext<EditorDirtyValue>({ dirty: false, setDirty: () => undefined });

export function EditorDirtyProvider({ children }: { children: ReactNode }) {
  const [dirty, setDirtyState] = useState(false);
  const setDirty = useCallback((d: boolean) => setDirtyState(d), []);

  // Guard accidental tab close / reload while there are unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  return <EditorDirtyContext.Provider value={{ dirty, setDirty }}>{children}</EditorDirtyContext.Provider>;
}

export function useEditorDirty(): EditorDirtyValue {
  return useContext(EditorDirtyContext);
}
