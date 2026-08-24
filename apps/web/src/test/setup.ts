import "@testing-library/jest-dom/vitest";
import { createElement, type ReactNode } from "react";
import { vi } from "vitest";

vi.mock("server-only", () => ({}));

// Next's client Link depends on the App Router context, which is not present
// in the jsdom test environment. Keep route assertions focused on the href
// while allowing every page/component test to render the shared shell.
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children?: ReactNode; [key: string]: unknown }) =>
    createElement("a", props, children),
}));

vi.mock("next/image", () => ({
  default: (input: { children?: ReactNode; [key: string]: unknown }) => {
    const { children, fill, priority, sizes, loader, ...props } = input;
    void fill;
    void priority;
    void sizes;
    void loader;
    return createElement("img", props, children);
  },
}));
