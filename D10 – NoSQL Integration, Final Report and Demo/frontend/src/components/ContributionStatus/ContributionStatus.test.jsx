// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ContributionStatus from "./ContributionStatus.jsx";

const members = [
  { member_id: 1, name: "Ahmed Ali" },
  { member_id: 2, name: "Mohamed Hassan" },
  { member_id: 3, name: "Omar Khaled" },
];
const cycle = { cycle_id: 5, seq_no: 5, status: "open" };
const setup = (props = {}) => {
  const client = { post: vi.fn().mockResolvedValue({ data: {} }) };
  const onRecorded = vi.fn();
  render(
    <ContributionStatus
      cycle={cycle}
      members={members}
      paid={new Set([3])}
      contributionAmount="1000.00"
      user={{ member_id: 1, role: "member" }}
      client={client}
      payoutState="provisional"
      onRecorded={onRecorded}
      {...props}
    />,
  );
  return { client, onRecorded };
};
afterEach(cleanup);

describe("Record payment", () => {
  it("a member only gets the button on their own unpaid row", () => {
    setup();
    expect(screen.getAllByRole("button", { name: /record payment/i })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Record payment for Ahmed Ali" })).toBeTruthy();
  });

  it("the organizer gets it on every unpaid row, never on paid rows", () => {
    setup({ user: { member_id: 11, role: "organizer" } });
    const buttons = screen.getAllByRole("button", { name: /record payment/i });
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Record payment for Ahmed Ali",
      "Record payment for Mohamed Hassan",
    ]);
  });

  it("no buttons when the cycle does not take contributions", () => {
    for (const status of ["closed", "pending", "expired"]) {
      setup({ cycle: { ...cycle, status } });
      expect(screen.queryAllByRole("button", { name: /record payment/i })).toHaveLength(0);
      cleanup();
    }
  });

  it("asks for confirmation, says no money moves, then posts exactly once", async () => {
    const { client, onRecorded } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Record payment for Ahmed Ali" }));
    expect(client.post).not.toHaveBeenCalled();
    expect(screen.getByText(/No money is\s+transferred/)).toBeTruthy();
    expect(screen.getByRole("dialog").textContent).toMatch(/Record your payment of 1,000.00 for Cycle 5\?/);
    const confirm = screen.getByRole("button", { name: "Confirm payment" });
    fireEvent.click(confirm);
    fireEvent.click(confirm); // double click
    await waitFor(() => expect(onRecorded).toHaveBeenCalledTimes(1));
    expect(client.post).toHaveBeenCalledTimes(1);
    expect(client.post).toHaveBeenCalledWith("/contributions", { member_id: 1, cycle_id: 5 });
    expect(screen.getByRole("status").textContent).toMatch(/Payment recorded: your contribution for Cycle 5/);
  });

  it("warns when the last missing contribution will trigger the payout", () => {
    setup({ paid: new Set([2, 3]), payoutState: "awaiting_funding" });
    fireEvent.click(screen.getByRole("button", { name: "Record payment for Ahmed Ali" }));
    expect(screen.getByText(/last missing contribution/)).toBeTruthy();
  });

  it("no payout warning while bidding is still open", () => {
    setup({ paid: new Set([2, 3]), payoutState: "provisional" });
    fireEvent.click(screen.getByRole("button", { name: "Record payment for Ahmed Ali" }));
    expect(screen.queryByText(/last missing contribution/)).toBeNull();
  });

  it("shows the server's error and keeps the confirmation open", async () => {
    const { client, onRecorded } = setup();
    client.post.mockRejectedValueOnce(new Error("Duplicate value or resource already exists"));
    fireEvent.click(screen.getByRole("button", { name: "Record payment for Ahmed Ali" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm payment" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Duplicate/);
    expect(onRecorded).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Confirm payment" })).toBeTruthy();
  });

  it("cancel closes the confirmation without posting", () => {
    const { client } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Record payment for Ahmed Ali" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(client.post).not.toHaveBeenCalled();
  });
});
