import { expect, it, vi } from "vite-plus/test";

import { act, render } from "../../../test/render";
import { useLoadAllHistory } from "./useLoadAllHistory";

function Harness(props: { thread: string; loadPage: () => Promise<boolean> }) {
  const history = useLoadAllHistory(props.thread, props.loadPage);
  return (
    <>
      <button
        onClick={() => {
          history.loadAll();
          history.loadAll();
        }}
      >
        Load all
      </button>
      <button onClick={history.stop}>Stop</button>
      <output>
        {history.loadingAll ? "Loading" : "Idle"}
        {history.error}
      </output>
    </>
  );
}

it("loads pages sequentially, ignores duplicate starts, and stops on Stop or navigation", async () => {
  const resolvers: Array<(loaded: boolean) => void> = [];
  const loadPage = vi.fn(() => new Promise<boolean>((resolve) => resolvers.push(resolve)));
  // No route dependencies: this harness passes the navigation key directly.
  await using screen = await render(<Harness thread="a" loadPage={loadPage} />, { router: false });
  await screen.getByRole("button", { name: "Load all" }).click();
  expect(loadPage).toHaveBeenCalledTimes(1);
  await act(() => resolvers[0]!(true));
  expect(loadPage).toHaveBeenCalledTimes(2);
  await screen.getByRole("button", { name: "Stop" }).click();
  await act(() => resolvers[1]!(true));
  expect(loadPage).toHaveBeenCalledTimes(2);
  await expect.element(screen.getByRole("status")).toHaveTextContent("Idle");
  await screen.getByRole("button", { name: "Load all" }).click();
  expect(loadPage).toHaveBeenCalledTimes(3);
  await screen.rerender(<Harness thread="b" loadPage={loadPage} />);
  await act(() => resolvers[2]!(true));
  await expect.element(screen.getByRole("status")).toHaveTextContent("Idle");
  expect(loadPage).toHaveBeenCalledTimes(3);
});

it("shows request failures and allows retry", async () => {
  const loadPage = vi
    .fn<() => Promise<boolean>>()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue(false);
  // No route dependencies: only the loading lifecycle is exercised.
  await using screen = await render(<Harness thread="a" loadPage={loadPage} />, { router: false });
  await screen.getByRole("button", { name: "Load all" }).click();
  await expect
    .element(screen.getByRole("status"))
    .toHaveTextContent("IdleCouldn’t load earlier turns. Try again.");
  await screen.getByRole("button", { name: "Load all" }).click();
  await expect.element(screen.getByRole("status")).toHaveTextContent("Idle");
  await vi.waitFor(() => expect(loadPage).toHaveBeenCalledTimes(2));
});
