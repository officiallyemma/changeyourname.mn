export { };

type ApiSession = {
    id?: string;
    sessionId?: string;
    createdAt?: number | string;
    firstAt?: number | string;
    eventTimestamps?: number[];
    activity?: ApiActivityItem[];
    [key: string]: any;
};

type ApiActivityItem = {
    timestamp?: number | string;
    createdAt?: number | string;
    time?: number | string;
    eventType?: number | string;
    type?: number | string;
    name?: string;
    eventName?: string;
    [key: string]: any;
};

declare global {
    interface Window {
        Chart: any;
    }
}

const API_KEY = "umami_M2aqfKQJ9ETyBfmmXqjzEUKGrSwK589D";
const CHART_JS_URL = "https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js";

function normalizeTimestamps(items: number[] = []) {
    return (items ?? [])
        // .map((item) => Number(item?.timestamp ?? item?.createdAt ?? item?.time ?? 0))
        .filter((value) => Number.isFinite(value) && value > 0)
        .sort((a, b) => a - b);
}

function ensureChartJs(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (window.Chart) return resolve();

        const existing = document.querySelector("script[data-chartjs]");
        if (existing) {
            existing.addEventListener("load", () => resolve(), { once: true });
            existing.addEventListener("error", () => reject(new Error("Chart.js failed to load")), { once: true });
            return;
        }

        const script = document.createElement("script");
        script.src = CHART_JS_URL;
        script.async = true;
        script.setAttribute("data-chartjs", "true");
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Chart.js failed to load"));
        document.head.appendChild(script);
    });
}

async function fetchSessionActivity({
    websiteId,
    sessionId,
    startAt,
    endAt,
}: {
    websiteId: string;
    sessionId: string;
    startAt: number;
    endAt: number;
}) {
    const url = new URL(`https://umami.changeyourname.mn/api/websites/${websiteId}/sessions/${sessionId}/activity`, window.location.origin);
    url.searchParams.set("startAt", String(startAt));
    url.searchParams.set("endAt", String(endAt));

    const res = await fetch(url.toString(), {
        headers: {
            Accept: "application/json",
            Authorization: `Bearer ${API_KEY}`,
        },
    });

    if (!res.ok) {
        if (res.status === 404) return [];
        throw new Error(`Session activity fetch failed: ${res.status} ${res.statusText}`);
    }

    const payload = await res.json();

    return Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.events)
            ? payload.events
            : Array.isArray(payload)
                ? payload
                : [];
}

async function fetchAllSessionsForRange({
    websiteId,
    startAt,
    endAt,
    pageSize = 100,
}: {
    websiteId: string;
    startAt: number;
    endAt: number;
    pageSize?: number;
}) {
    const allSessions: ApiSession[] = [];
    let page = 1;

    while (true) {
        const url = new URL(`https://umami.changeyourname.mn/api/websites/${websiteId}/sessions`, window.location.origin);
        url.searchParams.set("startAt", String(startAt));
        url.searchParams.set("endAt", String(endAt));
        url.searchParams.set("page", String(page));
        url.searchParams.set("limit", String(pageSize));

        const res = await fetch(url.toString(), {
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${API_KEY}`,
            },
        });

        if (!res.ok) throw new Error(`Sessions fetch failed: ${res.status} ${res.statusText}`);

        const payload = await res.json();
        const items = Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.sessions)
                ? payload.sessions
                : Array.isArray(payload)
                    ? payload
                    : [];

        if (!items.length) break;

        allSessions.push(...items);

        // const total = Number(payload?.total ?? payload?.count ?? payload?.pageInfo?.total ?? 0) || 0;
        // const totalPages = Number(payload?.totalPages ?? payload?.pageInfo?.totalPages ?? 0) || 0;

        // const hasMoreByTotal = totalPages > 0 ? page < totalPages : false;
        // const hasMoreByCount = items.length === pageSize && allSessions.length < total;
        // const hasMore = hasMoreByTotal || hasMoreByCount;

        if (payload.page >= payload.pageSize) break;
        page += 1;
    }

    const enrichedSessions: ApiSession[] = [];

    for (const session of allSessions) {
        const sessionId = session.id ?? session.sessionId;
        if (!sessionId) continue;

        const activity = await fetchSessionActivity({
            websiteId,
            sessionId,
            startAt,
            endAt,
        });


        activity.forEach((event, i) => {
            if (event.hasData) {
                console.log("Event has data:", event.eventId, event);
                // fetch https://umami.changeyourname.mn/api/websites/xxxx/event-data/992abca4-5cae-47ac-a5f9-f80d0507563d&unit=hour&timezone=America%2FChicago
                const url = new URL(`https://umami.changeyourname.mn/api/websites/${websiteId}/event-data/${event.eventId}`, window.location.origin);
                url.searchParams.set("startAt", String(startAt));
                url.searchParams.set("endAt", String(endAt));
                url.searchParams.set("unit", "hour");
                url.searchParams.set("timezone", "America/Chicago");
                fetch(url.toString(), {
                    headers: {
                        Accept: "application/json",
                        Authorization: `Bearer ${API_KEY}`,
                    },
                })
                    .then((res) => res.json())
                    .then((data) => {
                        console.log("Fetched event data for event:", event.eventId, data);
                        activity[i].data = data
                        // const timestamps = normalizeTimestamps(activity);

                    })
                    .catch((err) => {
                        console.error("Failed to fetch event data for event:", event.eventId, err);
                    });


            }
        });

        enrichedSessions.push({
            ...session,
            sessionId,
            // eventTimestamps: timestamps,
            activity: activity
        });


    }

    console.log('Enriched sessions with activity timestamps:', enrichedSessions);
    return enrichedSessions;
}

function parseTimestamp(value: number | string | undefined): number | null {
    if (typeof value === "number") {
        return Number.isFinite(value) && value > 0 ? value : null;
    }

    if (typeof value === "string") {
        const numeric = Number(value);
        if (Number.isFinite(numeric) && numeric > 0) return numeric;

        const parsed = Date.parse(value);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }

    return null;
}

function isPageviewEvent(activity: ApiActivityItem): boolean {
    const eventType = activity.eventType ?? activity.type;
    const typeName = String(activity.name ?? activity.eventName ?? "").toLowerCase();
    const rawType = String(eventType ?? "").toLowerCase();

    return rawType === "1"
        || rawType === "pageview"
        || rawType === "page-view"
        || typeName === "pageview"
        || typeName === "page-view";
}

function isPageExitEvent(activity: ApiActivityItem): boolean {
    const eventType = activity.eventType ?? activity.type;
    const typeName = String(activity.name ?? activity.eventName ?? "").toLowerCase();
    const rawType = String(eventType ?? "").toLowerCase();

    return rawType === "page-exit"
        || rawType === "page_exit"
        || rawType === "exit"
        || typeName === "page-exit"
        || typeName === "page_exit"
        || typeName === "exit";
}

function getSessionDurationMs(session: ApiSession): number | null {
    const activities = Array.isArray(session.activity) ? session.activity : [];

    const pageviews = activities
        .filter(isPageviewEvent)
        .map((activity) => parseTimestamp(activity.createdAt ?? activity.timestamp ?? activity.time))
        .filter((value): value is number => value !== null)
        .sort((a, b) => a - b);

    const exits = activities
        .filter(isPageExitEvent)
        .map((activity) => parseTimestamp(activity.createdAt ?? activity.timestamp ?? activity.time))
        .filter((value): value is number => value !== null)
        .sort((a, b) => a - b);

    if (!pageviews.length || !exits.length) {
        console.warn("Skipping session without pageview/page-exit pair:", session.sessionId ?? session.id, {
            pageviews: pageviews.length,
            exits: exits.length,
        });
        return null;
    }

    const firstPageview = pageviews[0];
    const matchingExit = exits.find((timestamp) => timestamp >= firstPageview);

    if (!matchingExit) {
        console.warn("Skipping session with unmatched pageview/page-exit timestamps:", session.sessionId ?? session.id, {
            firstPageview,
            exits,
        });
        return null;
    }

    return Math.max(0, matchingExit - firstPageview);
}

function formatDurationMmSs(totalSeconds: number): string {
    const safeSeconds = Math.max(0, Math.round(totalSeconds));
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDurationShort(ms: number): string {
    return formatDurationMmSs(ms / 1000);
}

function buildDurationHistogram(
    sessions: ApiSession[],
    bucketMs = 30_000
) {
    const durations = sessions
        .map(getSessionDurationMs)
        .filter((value): value is number => value !== null && Number.isFinite(value) && value >= 0)
        .sort((a, b) => a - b);

    if (!durations.length) {
        return { labels: ["00:00"], counts: [0] };
    }

    const maxDuration = Math.max(...durations);
    const boundaries: number[] = [bucketMs];

    while (boundaries[boundaries.length - 1] < maxDuration) {
        const next = boundaries[boundaries.length - 1] + bucketMs;
        if (next <= boundaries[boundaries.length - 1]) break;
        boundaries.push(next);
    }

    const labels = boundaries.map((end, index) => {
        const start = index === 0 ? 0 : boundaries[index - 1];
        return `${formatDurationShort(start)}–${formatDurationShort(end)}`;
    });

    const counts = new Array(labels.length).fill(0);

    for (const duration of durations) {
        let bucketIndex = 0;
        while (bucketIndex < boundaries.length && duration > boundaries[bucketIndex]) {
            bucketIndex += 1;
        }
        counts[Math.min(bucketIndex, counts.length - 1)] += 1;
    }

    return { labels, counts };
}

async function renderDurationHistogram(
    sessions: ApiSession[],
    {
        bucketMs = 30_000,
        title = "Session duration distribution",
    }: {
        bucketMs?: number;
        title?: string;
    } = {}
) {
    await ensureChartJs();

    const { labels, counts } = buildDurationHistogram(sessions, bucketMs);

    let host = document.getElementById("duration-histogram");
    if (!host) {
        host = document.createElement("div");
        host.id = "duration-histogram";
        host.style.width = "100%";
        host.style.maxWidth = "900px";
        host.style.height = "420px";
        host.style.margin = "24px auto";
        document.body.appendChild(host);
    }

    host.innerHTML = "";
    const canvas = document.createElement("canvas");
    host.appendChild(canvas);

    // @ts-ignore
    new window.Chart(canvas, {
        type: "bar",
        data: {
            labels,
            datasets: [
                {
                    label: title,
                    data: counts,
                    backgroundColor: "rgba(16, 185, 129, 0.7)",
                    borderColor: "rgba(5, 150, 105, 1)",
                    borderWidth: 1,
                    borderRadius: 4,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "index",
                intersect: false,
            },
            plugins: {
                legend: {
                    display: true,
                },
                tooltip: {
                    callbacks: {
                        label(context) {
                            return `${context.label}: ${context.parsed.y} sessions`;
                        },
                    },
                },
            },
            onClick: (_, elements) => {
                if (!elements.length) return;
                const index = elements[0].index;
                console.log("Bucket:", labels[index], "Count:", counts[index]);
            },
            scales: {
                x: {
                    title: { display: true, text: "Session duration" },
                },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: "Sessions" },
                    ticks: { precision: 0 },
                },
            },
        },
    });
}

async function loadDurationChart() {
    const websiteId = "5d893a3d-30d6-4290-a5e7-30048c509aa9";
    const startAt = new Date("2025-10-20T00:00:00Z").getTime();
    const endAt = new Date("2026-11-20T23:59:59Z").getTime();

    const sessions = await fetchAllSessionsForRange({
        websiteId,
        startAt,
        endAt,
        pageSize: 100,
    });



    console.log("Sessions with activity timestamps:", sessions);

    await renderDurationHistogram(sessions, {
        bucketMs: 60_000,
        title: "Duration distribution",
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        void loadDurationChart();
    });
} else {
    void loadDurationChart();
}