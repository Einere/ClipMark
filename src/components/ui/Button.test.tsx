import { act } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("uses the secondary variant by default", async () => {
    await act(async () => {
      root.render(createElement(Button, null, "Open"));
    });

    const button = container.querySelector("button");

    expect(button).not.toBeNull();
    expect(button?.className).toContain("bg-surface-container-high");
    expect(button?.className).toContain("text-on-surface");
    expect(button?.className).toContain("radius-squircle");
    expect(button?.getAttribute("type")).toBe("button");
  });

  it("applies the primary variant styles", async () => {
    await act(async () => {
      root.render(createElement(Button, { variant: "primary" }, "Save"));
    });

    const button = container.querySelector("button");

    expect(button?.className).toContain("bg-primary-container");
    expect(button?.className).toContain("text-on-primary");
    expect(button?.className).toContain("hover:bg-primary");
    expect(button?.className).toContain("active:bg-surface-tint");
  });

  it("supports the Stitch-inspired tertiary variant", async () => {
    await act(async () => {
      root.render(createElement(Button, { variant: "tertiary" }, "Cancel"));
    });

    const button = container.querySelector("button");

    expect(button?.className).toContain("bg-transparent");
    expect(button?.className).toContain("text-primary");
    expect(button?.className).toContain("hover:bg-[var(--color-active-tint)]");
  });

  it("merges custom class names with the shared button styles", async () => {
    await act(async () => {
      root.render(
        createElement(Button, { className: "shadow-none", type: "submit" }, "Submit"),
      );
    });

    const button = container.querySelector("button");

    expect(button?.className).toContain("inline-flex");
    expect(button?.className).toContain("shadow-none");
    expect(button?.getAttribute("type")).toBe("submit");
  });
});
