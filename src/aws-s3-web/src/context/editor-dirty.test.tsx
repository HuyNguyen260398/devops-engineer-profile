import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { EditorDirtyProvider, useEditorDirty } from "./editor-dirty";

function Probe() {
  const { dirty, setDirty } = useEditorDirty();
  return (
    <button onClick={() => setDirty(!dirty)}>{dirty ? "dirty" : "clean"}</button>
  );
}

describe("EditorDirtyContext", () => {
  it("defaults to clean and toggles via setDirty", () => {
    render(
      <EditorDirtyProvider>
        <Probe />
      </EditorDirtyProvider>,
    );
    const btn = screen.getByRole("button");
    expect(btn).toHaveTextContent("clean");
    fireEvent.click(btn);
    expect(btn).toHaveTextContent("dirty");
  });

  it("guards unload only while dirty", () => {
    render(
      <EditorDirtyProvider>
        <Probe />
      </EditorDirtyProvider>,
    );
    const btn = screen.getByRole("button");

    // Clean: no prompt.
    let event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);

    // Dirty: prompt.
    fireEvent.click(btn);
    event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);

    // Cleared (e.g. saved): the guard releases synchronously, no prompt on navigate.
    fireEvent.click(btn);
    event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});
