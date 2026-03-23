import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Toast } from "./Toast";

describe("Toast", () => {
  it("renders an info toast by default", () => {
    const markup = renderToStaticMarkup(
      createElement(Toast, { message: "Saved" }),
    );

    expect(markup).toContain("toast toast--info");
    expect(markup).toContain("Saved");
    expect(markup).toContain('role="status"');
  });

  it("renders an error toast when requested", () => {
    const markup = renderToStaticMarkup(
      createElement(Toast, { message: "File not found", tone: "error" }),
    );

    expect(markup).toContain("toast toast--error");
    expect(markup).toContain("File not found");
  });
});
