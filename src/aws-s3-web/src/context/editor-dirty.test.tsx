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
});
