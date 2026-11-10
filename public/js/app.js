// Client-side Dashboard for LLM Inference Provider Benchmarks
// Uses Chart.js to render Latency, Throughput, and Throughput per Dollar charts.

let latencyChartInstance = null;
let throughputChartInstance = null;
let scatterChartInstance = null;

// Dynamically generate a consistent color for any provider name
function getProviderColor(providerName) {
    if (!providerName) return 'hsl(215, 80%, 55%)';
    let hash = 0;
    for (let i = 0; i < providerName.length; i++) {
        hash = providerName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
}

// Initialize dashboard once DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadModels();
    loadDashboard();
});

function setupEventListeners() {
    const modelSelect = document.getElementById('modelSelect');
    const refreshBtn = document.getElementById('refreshBtn');

    if (modelSelect) {
        modelSelect.addEventListener('change', () => {
            loadDashboard(modelSelect.value);
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            const selectedModel = modelSelect ? modelSelect.value : '';
            loadDashboard(selectedModel);
        });
    }
}

// Fetch list of models and populate the dropdown
async function loadModels() {
    const modelSelect = document.getElementById('modelSelect');
    if (!modelSelect) return;

    try {
        const response = await fetch('/api/models');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const models = await response.json();

        if (Array.isArray(models)) {
            populateModelDropdown(models);
        }
    } catch (err) {
        console.warn('Could not load models from /api/models:', err.message);
    }
}

function populateModelDropdown(models) {
    const modelSelect = document.getElementById('modelSelect');
    if (!modelSelect) return;

    // Retain "All Models" option
    modelSelect.innerHTML = '<option value="">All Models (Combined)</option>';

    models.forEach((m) => {
        const option = document.createElement('option');
        option.value = m.ModelID || m.id;
        option.textContent = m.DisplayName || m.displayName || m.ModelID || m.id;
        modelSelect.appendChild(option);
    });
}

// Fetch metrics and update all 3 dashboard charts
async function loadDashboard(modelId = '') {
    const statusIndicator = document.getElementById('statusIndicator');
    if (statusIndicator) {
        statusIndicator.textContent = 'Loading latest metrics...';
    }

    const queryParam = modelId ? `?modelId=${encodeURIComponent(modelId)}` : '';

    let latencyData = [];
    let throughputData = [];
    let scatterData = [];

    try {
        const [latencyRes, throughputRes, scatterRes] = await Promise.all([
            fetch(`/api/metrics/latency${queryParam}`).catch(() => null),
            fetch(`/api/metrics/throughput${queryParam}`).catch(() => null),
            fetch('/api/metrics/throughput-per-dollar').catch(() => null)
        ]);

        if (latencyRes && latencyRes.ok) latencyData = await latencyRes.json();
        if (throughputRes && throughputRes.ok) throughputData = await throughputRes.json();
        if (scatterRes && scatterRes.ok) scatterData = await scatterRes.json();
    } catch (err) {
        console.warn('Error fetching API metrics:', err.message);
    }

    renderLatencyChart(latencyData);
    renderThroughputChart(throughputData);
    renderScatterChart(scatterData);

    if (statusIndicator) {
        const timestamp = new Date().toLocaleTimeString();
        const totalRecords = (latencyData?.length || 0) + (throughputData?.length || 0) + (scatterData?.length || 0);
        if (totalRecords === 0) {
            statusIndicator.textContent = `No metrics found \u2022 Checked at ${timestamp}`;
        } else {
            statusIndicator.textContent = `Live data updated at ${timestamp}`;
        }
    }
}

// Chart 1: Latency Over Time (Line Chart)
function renderLatencyChart(data) {
    const canvas = document.getElementById('latencyChart');
    if (!canvas) return;

    if (latencyChartInstance) {
        latencyChartInstance.destroy();
        latencyChartInstance = null;
    }

    if (!Array.isArray(data) || data.length === 0) {
        return;
    }

    // Extract sorted unique time buckets
    const timeLabels = Array.from(new Set(data.map((item) => {
        const rawTime = item.TimeBucket || item.CollectedAt || item.timeBucket || '';
        return formatTimeBucket(rawTime);
    }))).sort();

    // Group latency values by provider
    const providerMap = {};
    data.forEach((item) => {
        const provider = item.ProviderName || item.ProviderID || item.providerId || 'Unknown';
        const rawTime = item.TimeBucket || item.CollectedAt || item.timeBucket || '';
        const timeLabel = formatTimeBucket(rawTime);
        const latency = Number(item.AvgLatencyMs ?? item.FirstResponseLatencyMs ?? item.avgLatency ?? 0);

        if (!providerMap[provider]) {
            providerMap[provider] = {};
        }
        providerMap[provider][timeLabel] = latency;
    });

    const datasets = Object.keys(providerMap).map((provider) => {
        const color = getProviderColor(provider);
        const points = timeLabels.map((time) => providerMap[provider][time] ?? null);

        return {
            label: `${provider} (ms)`,
            data: points,
            borderColor: color,
            backgroundColor: color,
            borderWidth: 2,
            pointRadius: 3,
            tension: 0.25,
            spanGaps: true
        };
    });

    const ctx = canvas.getContext('2d');
    latencyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y != null ? ctx.parsed.y.toFixed(1) + ' ms' : 'N/A'}`
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Time / Observation' },
                    grid: { color: '#f1f5f9' }
                },
                y: {
                    title: { display: true, text: 'First Response Latency (ms)' },
                    beginAtZero: true,
                    grid: { color: '#f1f5f9' }
                }
            }
        }
    });
}

// Chart 2: Averaged Throughput (Horizontal Bar Chart)
function renderThroughputChart(data) {
    const canvas = document.getElementById('throughputChart');
    if (!canvas) return;

    if (throughputChartInstance) {
        throughputChartInstance.destroy();
        throughputChartInstance = null;
    }

    if (!Array.isArray(data) || data.length === 0) {
        return;
    }

    // Sort by average throughput descending
    const sortedData = [...data].sort((a, b) => {
        const valA = Number(a.AvgThroughputTPS ?? a.ThroughputTPS ?? 0);
        const valB = Number(b.AvgThroughputTPS ?? b.ThroughputTPS ?? 0);
        return valB - valA;
    });

    const labels = sortedData.map((d) => d.ProviderName || d.ProviderID || d.DisplayName || 'Unknown');
    const values = sortedData.map((d) => Number(d.AvgThroughputTPS ?? d.ThroughputTPS ?? 0));
    const colors = labels.map((label) => getProviderColor(label));

    const ctx = canvas.getContext('2d');
    throughputChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Tokens Per Second (TPS)',
                data: values,
                backgroundColor: colors,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` ${ctx.parsed.x.toFixed(1)} TPS`
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Average Throughput (TPS)' },
                    beginAtZero: true,
                    grid: { color: '#f1f5f9' }
                },
                y: {
                    grid: { display: false }
                }
            }
        }
    });
}

// Chart 3: Throughput per Dollar (Scatter Plot)
function renderScatterChart(data) {
    const canvas = document.getElementById('scatterChart');
    if (!canvas) return;

    if (scatterChartInstance) {
        scatterChartInstance.destroy();
        scatterChartInstance = null;
    }

    if (!Array.isArray(data) || data.length === 0) {
        return;
    }

    // Group scatter points by provider
    const providerMap = {};
    data.forEach((item) => {
        const provider = item.ProviderName || item.ProviderID || 'Unknown';
        const cost = Number(item.BlendedCostPerMillion ?? item.PromptCostPerMillion ?? item.cost ?? 0);
        const tps = Number(item.ThroughputTPS ?? item.AvgThroughputTPS ?? item.throughput ?? 0);
        const modelName = item.DisplayName || item.ModelID || '';

        if (!providerMap[provider]) {
            providerMap[provider] = [];
        }

        providerMap[provider].push({
            x: cost,
            y: tps,
            model: modelName
        });
    });

    const datasets = Object.keys(providerMap).map((provider) => {
        const color = getProviderColor(provider);
        return {
            label: provider,
            data: providerMap[provider],
            backgroundColor: color,
            borderColor: color,
            pointRadius: 6,
            pointHoverRadius: 8
        };
    });

    const ctx = canvas.getContext('2d');
    scatterChartInstance = new Chart(ctx, {
        type: 'scatter',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const raw = ctx.raw || {};
                            const modelLabel = raw.model ? ` (${raw.model})` : '';
                            return ` ${ctx.dataset.label}${modelLabel}: $${raw.x?.toFixed(2)}/1M tok, ${raw.y?.toFixed(1)} TPS`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Blended Cost ($ / 1M Tokens)' },
                    beginAtZero: true,
                    grid: { color: '#f1f5f9' }
                },
                y: {
                    title: { display: true, text: 'Throughput (TPS)' },
                    beginAtZero: true,
                    grid: { color: '#f1f5f9' }
                }
            }
        }
    });
}

// Format raw ISO date or time string for chart axis
function formatTimeBucket(raw) {
    if (!raw) return '';
    try {
        const date = new Date(raw);
        if (!isNaN(date.getTime())) {
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const month = date.getMonth() + 1;
            const day = date.getDate();
            return `${month}/${day} ${hours}:${minutes}`;
        }
    } catch (_) {}
    return String(raw);
}
