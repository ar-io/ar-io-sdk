import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it } from "vitest";

import App from "./App";

describe("ESM browser validation", () => {
  it("should load the app and SDK", async () => {
    await act(async () => render(<App />));

    await waitFor(
      () => {
        screen.getByTestId("load-info-result");
      },
      {
        interval: 5_000,
        timeout: 120_000,
      },
    );

    const result = screen.getByTestId("load-info-result");
    expect(result).toHaveTextContent("true");
  });

  it("should retrieve ids from registry", async () => {
    await act(async () => render(<App />));

    await waitFor(
      () => {
        screen.getByTestId("load-registry-result");
      },
      {
        interval: 5_000,
        timeout: 120_000,
      },
    );

    const result = screen.getByTestId("load-registry-result");
    expect(result).toHaveTextContent("true");
  });
});
