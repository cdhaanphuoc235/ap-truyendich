import React from "react";
import { render, screen } from "@testing-library/react";
import { TickContext } from "../clock/TickProvider";
import { useCountdown } from "../hooks/useCountdown";

function View({ endAt }: { endAt: string }) {
  const secs = useCountdown(endAt);
  return <div data-testid="secs">{secs}</div>;
}

function renderWithTick(now: number, endAt: string) {
  return render(
    <TickContext.Provider value={now}>
      <View endAt={endAt} />
    </TickContext.Provider>
  );
}

describe("useCountdown (with global tick)", () => {
  it("shows remaining seconds and clamps to 0", () => {
    const now = Date.now();
    const end = new Date(now + 5500).toISOString(); // 5.5s
    const { rerender } = renderWithTick(now, end);
    expect(screen.getByTestId("secs").textContent).toBe("5");

    // advance 3 seconds
    rerender(
      <TickContext.Provider value={now + 3000}>
        <View endAt={end} />
      </TickContext.Provider>
    );
    expect(screen.getByTestId("secs").textContent).toBe("2");

    // advance beyond end
    rerender(
      <TickContext.Provider value={now + 10_000}>
        <View endAt={end} />
      </TickContext.Provider>
    );
    expect(screen.getByTestId("secs").textContent).toBe("0");
  });
});
