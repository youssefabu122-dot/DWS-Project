// The three user-facing cycle statuses (the API sends display_status and outcome).
const FALLBACK = { open: "open", closed: "closed", expired: "closed", awaiting_decision: "expired" };
export const STATUS = {
  open: { label: "Open", tone: "blue" },
  closed: { label: "Closed", tone: "gray" },
  expired: { label: "Expired", tone: "amber" },
};

export const displayStatus = (cycle) =>
  cycle?.display_status ?? FALLBACK[cycle?.status] ?? "open";

// "Open", "Open · bidding closed", "Closed", "Closed · no winner", "Expired"
export function cycleLabel(cycle, biddingOpen = cycle?.bidding_open) {
  const status = displayStatus(cycle);
  let label = STATUS[status].label;
  if (cycle?.outcome === "no_winner") label += " · no winner";
  else if (status === "open" && biddingOpen === false) label += " · bidding closed";
  return label;
}
