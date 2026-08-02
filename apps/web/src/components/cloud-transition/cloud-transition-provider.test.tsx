import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CloudTransitionProvider,
  useCloudTransition,
} from "./cloud-transition-provider";

const push = vi.fn();
const prefetch = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, prefetch }),
}));

function Trigger() {
  const {
    isTransitioning,
    notifyMapReady,
    notifyHomeReady,
    startMapTransition,
    startHomeTransition,
  } = useCloudTransition();

  return (
    <>
      <button onClick={() => startMapTransition()} type="button">start</button>
      <button onClick={notifyMapReady} type="button">ready</button>
      <button onClick={() => startHomeTransition()} type="button">start home</button>
      <button onClick={notifyHomeReady} type="button">home ready</button>
      <output>{String(isTransitioning)}</output>
    </>
  );
}

describe("CloudTransitionProvider", () => {
  beforeEach(() => {
    push.mockReset();
    prefetch.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("covers, routes, holds two seconds, then reveals after map readiness", () => {
    render(<CloudTransitionProvider><Trigger /></CloudTransitionProvider>);

    fireEvent.click(screen.getByRole("button", { name: "start" }));

    expect(screen.getByTestId("cloud-transition-overlay")).toHaveAttribute("data-phase", "covering");
    expect(screen.getByText("true")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(550));

    expect(push).toHaveBeenCalledWith("/map");
    expect(screen.getByTestId("cloud-transition-overlay")).toHaveAttribute("data-phase", "holding");

    fireEvent.click(screen.getByRole("button", { name: "ready" }));
    act(() => vi.advanceTimersByTime(1_999));

    expect(screen.getByTestId("cloud-transition-overlay")).toHaveAttribute("data-phase", "holding");

    act(() => vi.advanceTimersByTime(1));

    expect(screen.getByTestId("cloud-transition-overlay")).toHaveAttribute("data-phase", "revealing");
  });

  it("does not start a second route transition while the first transition is active", () => {
    render(<CloudTransitionProvider><Trigger /></CloudTransitionProvider>);

    fireEvent.click(screen.getByRole("button", { name: "start" }));
    fireEvent.click(screen.getByRole("button", { name: "start" }));
    act(() => vi.advanceTimersByTime(550));

    expect(push).toHaveBeenCalledTimes(1);
  });

  it("covers, routes home, holds two seconds, then reveals after home readiness", () => {
    render(<CloudTransitionProvider><Trigger /></CloudTransitionProvider>);

    fireEvent.click(screen.getByRole("button", { name: "start home" }));

    expect(screen.getByTestId("cloud-transition-overlay")).toHaveAttribute("data-phase", "covering");

    act(() => vi.advanceTimersByTime(550));

    expect(push).toHaveBeenCalledWith("/preview");
    expect(screen.getByTestId("cloud-transition-overlay")).toHaveAttribute("data-phase", "holding");

    fireEvent.click(screen.getByRole("button", { name: "home ready" }));
    act(() => vi.advanceTimersByTime(2_000));

    expect(screen.getByTestId("cloud-transition-overlay")).toHaveAttribute("data-phase", "revealing");
  });

  it("renders a cropped image sprite for each cloud layer", () => {
    render(<CloudTransitionProvider><Trigger /></CloudTransitionProvider>);

    fireEvent.click(screen.getByRole("button", { name: "start" }));

    expect(screen.getAllByTestId("cloud-transition-cloud")).toHaveLength(39);
    expect(screen.getAllByTestId("cloud-transition-sprite")).toHaveLength(39);
    expect(
      screen
        .getAllByTestId("cloud-transition-cloud")
        .filter((element) => element.getAttribute("data-edge-seal")),
    ).toHaveLength(3);
    expect(
      screen
        .getAllByTestId("cloud-transition-cloud")
        .map((element) => element.getAttribute("data-edge-seal")),
    ).toEqual(expect.arrayContaining(["top", "top-left", "top-right"]));
    expect(
      screen
        .getAllByTestId("cloud-transition-cloud")
        .filter((element) => element.getAttribute("data-mobile-seal") === "true"),
    ).toHaveLength(5);
  });

  it("reveals after the fallback wait when map readiness is unavailable", () => {
    render(<CloudTransitionProvider><Trigger /></CloudTransitionProvider>);

    fireEvent.click(screen.getByRole("button", { name: "start" }));
    act(() => vi.advanceTimersByTime(550));
    act(() => vi.advanceTimersByTime(5_000));

    expect(screen.getByTestId("cloud-transition-overlay")).toHaveAttribute("data-phase", "revealing");
  });
});
