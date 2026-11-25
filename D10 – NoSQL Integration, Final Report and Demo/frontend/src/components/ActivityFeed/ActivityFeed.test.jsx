// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ActivityFeed from "./ActivityFeed.jsx";
import BidRanking from "../BidRanking/BidRanking.jsx";
import ContributionStatus from "../ContributionStatus/ContributionStatus.jsx";

afterEach(cleanup);
const events = Array.from({ length: 12 }, (_, i) => ({
  _id: `e${i}`,
  type: "contribution.recorded",
  occurred_at: "2026-11-22T10:00:00.000Z",
  actor: { role: "member", name: `Member ${i}` },
  data: { seq_no: 5, amount: "1000.00" },
}));

describe("Activity feed", () => {
  it("shows the latest 5 events, then more on request", async () => {
    const client = { get: vi.fn().mockResolvedValue({ data: { events } }) };
    render(<ActivityFeed client={client} circleId="1" />);
    expect(await screen.findByText(/Member 0 paid/)).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: /View more \(7 older\)/ }));
    expect(screen.getAllByRole("listitem")).toHaveLength(12);
    fireEvent.click(screen.getByRole("button", { name: "Show less" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
  });
});

describe("Status labels and bidding", () => {
  const cycle = { cycle_id: 5, seq_no: 5, status: "open" };
  const props = { client: {}, bids: [], cycle, members: [{ member_id: 1, name: "Ahmed Ali" }] };

  it("no bid form when bidding is closed; labelled bidding badge", () => {
    render(<BidRanking {...props} biddingOpen={false} />);
    expect(screen.queryByText("Place a bid")).toBeNull();
    expect(screen.getByText("Bidding is closed for this cycle.")).toBeTruthy();
    expect(screen.getByText("Bidding:")).toBeTruthy();
  });

  it("bid form while bidding is open", () => {
    render(<BidRanking {...props} biddingOpen />);
    expect(screen.getByText("Place a bid")).toBeTruthy();
  });

  it("unpaid rows are highlighted and the cycle badge is labelled", () => {
    const { container } = render(
      <ContributionStatus cycle={cycle} members={[{ member_id: 1, name: "A" }, { member_id: 2, name: "B" }]}
        paid={new Set([2])} contributionAmount="10.00" user={{ member_id: 9, role: "member" }} client={{}} />,
    );
    expect(container.querySelectorAll("tr.unpaid-row")).toHaveLength(1);
    expect(screen.getByText("Cycle:")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /record payment/i })).toBeNull(); // not their row
  });
});
