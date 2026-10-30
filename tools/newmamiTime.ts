export { };

type ActivityEvent = {
    createdAt?: string | number | null;
    eventType?: number | string | null;
    eventName?: string | null;
    totalTimeSeconds?: number | string | null;
    data?: Array<{
        dataKey?: string;
        numberValue?: number | string | null;
        stringValue?: string | null;
        [key: string]: unknown;
    }> | Record<string, unknown>;
    [key: string]: unknown;
};

type Session = {
    id?: string;
    sessionId?: string;
    createdAt?: string | number | null;
    activity?: ActivityEvent[];
    [key: string]: unknown;
};

declare global {
    interface Window {
        Chart: any;
    }
}

const DATA_URL = "/test.json";
const CHART_JS_URL = "https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js";

function toDateMs(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
        const n = Number(value);
        if (Number.isFinite(n)) return n;
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function looksLikePageView(event: ActivityEvent): boolean {
    const rawType = String(event.eventType ?? "").trim();
    const name = String(event.eventName ?? "").trim().toLowerCase();
    return rawType === "1"
        || rawType === "pageview"
        || rawType === "page-view"
        || name === "pageview"
        || name === "page-view"
        || name === "view";
}

function looksLikePageExit(event: ActivityEvent): boolean {
    const rawType = String(event.eventType ?? "").trim();
    const name = String(event.eventName ?? "").trim().toLowerCase();
    return rawType === "2"
        || rawType === "page-exit"
        || rawType === "page_exit"
        || rawType === "exit"
        || name === "page-exit"
        || name === "page_exit"
        || name === "exit";
}

function normalizeTotalTimeSeconds(event: ActivityEvent): number | null {
    const nested = event.data;
    if (Array.isArray(nested)) {
        for (const item of nested) {
            if (item?.dataKey === "totalTimeSeconds") {
                const value = item.numberValue ?? item.stringValue;
                if (typeof value === "number" && Number.isFinite(value)) return value;
                if (typeof value === "string") {
                    const numeric = Number(value);
                    if (Number.isFinite(numeric)) return numeric;
                }
            }
        }
    }

    return null;
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

async function fetchSessionListPages(): Promise<Session[][]> {
    const response = await fetch(DATA_URL);
    if (!response.ok) {
        throw new Error(`Failed to load ${DATA_URL}: ${response.status}`);
    }

    const parsed: unknown = await response.json();
    const sessionList = Array.isArray(parsed) ? (parsed as Session[]) : [];
    console.log(`Fetched ${sessionList.length} sessions from ${DATA_URL}`);
    return [sessionList];
}

function getSessionActivity(session: Session): ActivityEvent[] {
    return Array.isArray(session.activity) ? session.activity : [];
}

function collectPageExitSeconds(session: Session): number[] {
    const activity = getSessionActivity(session)
        .slice()
        .sort((a, b) => {
            const aTime = toDateMs(a.createdAt) ?? 0;
            const bTime = toDateMs(b.createdAt) ?? 0;
            return aTime - bTime;
        });

    const results: number[] = [];
    let lastExitBeforeNextView: ActivityEvent | null = null;
    let seenPageView = false;

    for (const event of activity) {
        if (looksLikePageView(event)) {
            if (seenPageView && lastExitBeforeNextView) {
                const value = normalizeTotalTimeSeconds(lastExitBeforeNextView);
                if (value !== null) results.push(value);
            }

            seenPageView = true;
            lastExitBeforeNextView = null;
            continue;
        }

        if (looksLikePageExit(event)) {
            lastExitBeforeNextView = event;
        }
    }

    // if (lastExitBeforeNextView) {
    //     const value = normalizeTotalTimeSeconds(lastExitBeforeNextView);
    //     if (value !== null) results.push(value);
    // }

    return results;
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

function buildDurationHistogram(values: number[], bucketMs = 30_000) {
    const durations = values
        .filter((value) => Number.isFinite(value) && value >= 0)
        .sort((a, b) => a - b);

    if (!durations.length) {
        return { labels: ["00:00"], counts: [0] };
    }

    const maxDuration = Math.max(...durations);
    const boundaries: number[] = [bucketMs];

    while (boundaries[boundaries.length - 1] < maxDuration) {
        const next = boundaries[boundaries.length - 1] * 2;
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
    values: number[],
    {
        bucketMs = 30_000,
        title = "Session duration distribution",
    }: {
        bucketMs?: number;
        title?: string;
    } = {}
) {
    await ensureChartJs();

    const { labels, counts } = buildDurationHistogram(values, bucketMs);

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
                legend: { display: true },
                tooltip: {
                    callbacks: {
                        label(context: any) {
                            return `${context.label}: ${context.parsed.y} sessions`;
                        },
                    },
                },
            },
            onClick: (_: unknown, elements: Array<{ index: number }>) => {
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
    const pages = await fetchSessionListPages();
    const sessions = pages.flatMap((page) => page);
    const MAX_SECONDS = 6 * 60 * 60; // example cap: 2 hours

    const exitTimes = sessions
        .flatMap((session) => collectPageExitSeconds(session))
        .map((seconds) => Math.min(seconds, MAX_SECONDS));
    const exitTimesMs = exitTimes.map((seconds) => seconds * 1000);

    console.log("Matched exit totals:", exitTimesMs);

    // calculate and log some statistics
    const totalCount = exitTimesMs.length;
    const totalSum = exitTimesMs.reduce((sum, value) => sum + value, 0);
    const average = totalCount > 0 ? totalSum / totalCount : 0;
    const min = Math.min(...exitTimesMs);
    const max = Math.max(...exitTimesMs);
    console.log("Statistics:");
    console.log("  Total count:", totalCount);
    console.log("  Total sum:", totalSum);
    console.log("  Average:", average);
    console.log("  Min:", min);
    console.log("  Max:", max);
    // std dev
    const variance = exitTimesMs.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / totalCount;
    const stdDev = Math.sqrt(variance);
    console.log("  Std Dev:", stdDev);
    // median
    const sorted = [...exitTimesMs].sort((a, b) => a - b);
    const median = totalCount % 2 === 0 ? (sorted[totalCount / 2 - 1] + sorted[totalCount / 2]) / 2 : sorted[Math.floor(totalCount / 2)];
    console.log("  Median:", median);


    await renderDurationHistogram(exitTimesMs, {
        bucketMs: 30_000,
        title: "Page-exit duration distribution",
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        void loadDurationChart();
    });
} else {
    void loadDurationChart();
}
