import { useCallback, useEffect, useRef, useState } from "react";
import { client } from "../../api.js";

import Header from "../Header/Header.jsx";
import Panel from "../Panel/Panel.jsx";
import CircleOverview from "../CircleOverview/CircleOverview.jsx";
import ContributionStatus from "../ContributionStatus/ContributionStatus.jsx";
import NextPayout from "../NextPayout/NextPayout.jsx";
import BidRanking from "../BidRanking/BidRanking.jsx";
import Icon from "../Icon/Icon.jsx";
import ActivityFeed from "../ActivityFeed/ActivityFeed.jsx";
import BiddingAnalytics from "../BiddingAnalytics/BiddingAnalytics.jsx";
import OrganizerControls from "../OrganizerControls/OrganizerControls.jsx";
import { cycleLabel } from "../../cycleStatus.js";

export default function Dashboard({ user, onLogout }) {
  const [circles, setCircles] = useState([]);
  const [circleId, setCircleId] = useState("");
  const [cycleId, setCycleId] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updated, setUpdated] = useState(null);
  const refreshRef = useRef(null);
  const [expiredKey, setExpiredKey] = useState("");
  const handleExpired = useCallback((cycleId, closesAt) => {
    setExpiredKey(`${cycleId}:${closesAt}`);
    refreshRef.current?.();
  }, []);

  async function loadCircles() {
    setLoadingList(true);
    setListError("");
    try {
      const { data: rows } = await client.get("/circles");
      setCircles(rows);
      setCircleId((id) =>
        rows.some((c) => String(c.circle_id) === id)
          ? id
          : String(rows[0]?.circle_id || ""),
      );
    } catch (err) {
      setListError(err.message);
    } finally {
      setLoadingList(false);
    }
  }
  useEffect(() => {
    let active = true;
    client
      .get("/circles")
      .then(({ data: rows }) => {
        if (!active) return;
        setCircles(rows);
        setCircleId(String(rows[0]?.circle_id || ""));
      })
      .catch((error) => {
        if (active) setListError(error.message);
      })
      .finally(() => {
        if (active) setLoadingList(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!circleId) return;
    let disposed = false,
      running = false,
      pending = false,
      timer;
    const controller = new AbortController();
    async function refresh() {
      if (disposed) return;
      if (running) {
        pending = true;
        return;
      }
      running = true;
      setRefreshing(true);
      clearTimeout(timer);
      try {
        // One shared refresh keeps panels consistent and avoids separate polling loops.
        const options = { signal: controller.signal };
        const responses = await Promise.all([
          client.get(`/circles/${circleId}`, options),
          client.get(`/circles/${circleId}/members`, options),
          client.get(`/circles/${circleId}/cycles`, options),
        ]);
        const [circle, members, cycles] = responses.map(
          (response) => response.data,
        );
        const cycle =
          cycles.find((c) => String(c.cycle_id) === cycleId) ||
          cycles.find((c) => c.status === "open") ||
          cycles.find((c) => c.status === "awaiting_decision") ||
          cycles.at(-1);
        let bids = [];
        let nextPayout = null;
        if (cycle) {
          const [rankingResponse, payoutResponse] = await Promise.all([
            client.get(`/cycles/${cycle.cycle_id}/bids/ranking`, options),
            client.get(`/circles/${circleId}/next-payout`, {
              ...options,
              params: { cycle_id: cycle.cycle_id },
            }),
          ]);
          bids = rankingResponse.data;
          nextPayout = payoutResponse.data;
        }
        if (!disposed) {
          setData({
            circle,
            members,
            cycles,
            cycle: nextPayout?.cycle || cycle,
            bids,
            nextPayout,
          });
          setError("");
          setUpdated(new Date());
        }
      } catch (err) {
        if (!disposed) setError(err.message);
      } finally {
        running = false;
        if (!disposed) {
          setRefreshing(false);
          if (pending) {
            pending = false;
            refresh();
          } else schedule();
        }
      }
    }
    function schedule() {
      timer = setTimeout(
        () => (document.hidden ? schedule() : refresh()),
        15000,
      );
    }
    refreshRef.current = refresh;
    Promise.resolve().then(refresh);
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(timer);
      refreshRef.current = null;
    };
  }, [circleId, cycleId]);

  const paid = new Set(data?.nextPayout?.paid_member_ids || []);
  // Members who already received the pot in this circle (no longer eligible to bid).
  const eligibleIds = new Set(
    (data?.nextPayout?.eligible_members || []).map((m) => m.member_id),
  );
  const payoutRecipients = new Set(
    data?.nextPayout
      ? data.members
          .filter((m) => !eligibleIds.has(m.member_id))
          .map((m) => m.member_id)
      : [],
  );
  const biddingOpen =
    Boolean(data?.nextPayout?.bidding_open) &&
    expiredKey !== `${data?.cycle?.cycle_id}:${data?.nextPayout?.closes_at}`;
  return (
    <>
      <Header
        connected={Boolean(updated)}
        paused={Boolean(error || listError)}
        user={user}
        onLogout={onLogout}
      />
      <main className="dashboard">
        <div className="toolbar">
          <div className="selectors">
            <label>
              Savings circle
              <select
                value={circleId}
                disabled={loadingList || !circles.length}
                onChange={(event) => {
                  setCircleId(event.target.value);
                  setCycleId("");
                  setData(null);
                  setError("");
                  setUpdated(null);
                }}
              >
                <option value="" disabled>
                  {loadingList
                    ? "Loading circles…"
                    : listError
                      ? "Circles unavailable"
                      : !circles.length
                        ? "No circles available"
                        : "Choose a circle"}
                </option>
                {circles.map((circle) => (
                  <option key={circle.circle_id} value={circle.circle_id}>
                    {circle.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Selected cycle
              <select
                value={data?.cycle?.cycle_id || ""}
                disabled={!data?.cycles.length}
                onChange={(event) => {
                  setCycleId(event.target.value);
                  setData(null);
                  setError("");
                  setUpdated(null);
                }}
              >
                <option value="" disabled>
                  {!data ? "Loading cycles…" : "No cycles available"}
                </option>
                {data?.cycles.map((cycle) => (
                  <option key={cycle.cycle_id} value={cycle.cycle_id}>
                    Cycle {cycle.seq_no} —{" "}
                    {cycleLabel(
                      cycle,
                      data?.cycle?.cycle_id === cycle.cycle_id
                        ? biddingOpen
                        : cycle.bidding_open,
                    )}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="refresh-controls">
            <span className="updated" role="status">
              {updated
                ? `Last updated ${updated.toLocaleTimeString()}`
                : refreshing || loadingList
                  ? "Loading dashboard…"
                  : "Not updated yet"}
            </span>
            <button
              className="button-outline"
              disabled={refreshing || loadingList}
              onClick={() =>
                circleId ? refreshRef.current?.() : loadCircles()
              }
            >
              <Icon name="refresh" />
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
        {listError && (
          <div role="alert" className="error">
            <Icon name="info" />
            <span>{listError}</span>
            <button onClick={loadCircles} disabled={loadingList}>
              Retry circles
            </button>
          </div>
        )}
        {error && (
          <div role="alert" className="error">
            <Icon name="info" />
            <span>
              {error}{" "}
              {data &&
                "Previously loaded data is shown. Bidding is paused until refresh succeeds."}
            </span>
          </div>
        )}
        {loadingList && (
          <p className="empty-state" role="status">
            Loading circles…
          </p>
        )}
        {circleId && !data && !error && !loadingList && (
          <div className="loading-cards" role="status">
            Loading circle details…
          </div>
        )}
        {!loadingList && !listError && !circles.length && (
          <Panel title="Your circles">
            <p className="empty-state">
              {user.role === "organizer" ? "No circles yet." : "You are not a member of any circle yet."}
            </p>
          </Panel>
        )}
        {data && (
          <>
            <CircleOverview circle={data.circle} />
            {!data.cycle ? (
              <Panel title="Cycles">
                <p className="empty-state">No cycles in this circle yet.</p>
              </Panel>
            ) : (
              <div className="dashboard-grid">
                <ContributionStatus
                  key={data.cycle.cycle_id}
                  cycle={data.cycle}
                  members={data.members}
                  paid={paid}
                  contributionAmount={data.circle.contribution_amount}
                  user={user}
                  client={client}
                  payoutState={data.nextPayout?.state}
                  payoutRecipients={payoutRecipients}
                  onRecorded={() => {
                    // Stay on this cycle even if the payment completes it.
                    const id = String(data.cycle.cycle_id);
                    if (cycleId === id) refreshRef.current?.();
                    else setCycleId(id);
                  }}
                />
                <aside className="side-stack" aria-label="Payout and bids">
                  <NextPayout
                    details={data.nextPayout}
                    onExpired={handleExpired}
                  />
                  {user.role === "organizer" && data.nextPayout?.cycle && (
                    <OrganizerControls
                      key={data.nextPayout.cycle.cycle_id}
                      client={client}
                      details={data.nextPayout}
                      onDone={() => refreshRef.current?.()}
                    />
                  )}
                  <BidRanking
                    client={client}
                    biddingOpen={biddingOpen}
                    bids={data.bids}
                    cycle={data.cycle}
                    members={
                      // D9: a member can only bid as themselves; members who already
                      // received the pot in this circle cannot bid at all.
                      data.members.filter(
                        (m) =>
                          eligibleIds.has(m.member_id) &&
                          (user.role !== "member" || m.member_id === user.member_id),
                      )
                    }
                    alreadyPaidOut={
                      user.role === "member" && payoutRecipients.has(user.member_id)
                    }
                    error={error}
                    onSubmitted={() => refreshRef.current?.()}
                  />
                </aside>
              </div>
            )}
            <BiddingAnalytics
              client={client}
              circleId={circleId}
              refreshKey={updated?.getTime()}
            />
            <ActivityFeed
              key={circleId}
              client={client}
              circleId={circleId}
              refreshKey={updated?.getTime()}
            />
          </>
        )}
      </main>
    </>
  );
}
