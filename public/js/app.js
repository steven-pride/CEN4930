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

    // Group observations by provider to compute overall provider averages and keep model breakdowns
    const providerMap = {};
    data.forEach((item) => {
        const provider = item.ProviderName || item.ProviderID || 'Unknown';
        const model = item.DisplayName || item.ModelDisplayName || item.ModelID || 'Unknown Model';
        const tps = Number(item.AvgThroughputTPS ?? item.ThroughputTPS ?? 0);
        const cost = item.BlendedCostPerMillion != null ? Number(item.BlendedCostPerMillion) : null;

        if (!providerMap[provider]) {
            providerMap[provider] = {
                providerName: provider,
                modelMap: {},
                totalTps: 0,
                count: 0
            };
        }

        // Aggregate per model under provider if multiple observations exist
        if (!providerMap[provider].modelMap[model]) {
            providerMap[provider].modelMap[model] = {
                model,
                tpsSum: 0,
                count: 0,
                cost
            };
        }

        providerMap[provider].modelMap[model].tpsSum += tps;
        providerMap[provider].modelMap[model].count += 1;
        if (cost !== null) {
            providerMap[provider].modelMap[model].cost = cost;
        }

        providerMap[provider].totalTps += tps;
        providerMap[provider].count += 1;
    });

    const providersList = Object.keys(providerMap).map((providerKey) => {
        const p = providerMap[providerKey];
        const overallAvgTps = p.count > 0 ? p.totalTps / p.count : 0;
        const models = Object.keys(p.modelMap).map((mKey) => {
            const m = p.modelMap[mKey];
            return {
                model: m.model,
                tps: m.count > 0 ? m.tpsSum / m.count : 0,
                cost: m.cost
            };
        }).sort((a, b) => b.tps - a.tps);

        return {
            providerName: p.providerName,
            overallAvgTps,
            models
        };
    });

    // Sort providers by overall average throughput descending
    const sortedProviders = providersList.sort((a, b) => b.overallAvgTps - a.overallAvgTps);

    const labels = sortedProviders.map((p) => p.providerName);
    const values = sortedProviders.map((p) => p.overallAvgTps);
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
                        title: (items) => {
                            if (!items || !items.length) return '';
                            return items[0].label;
                        },
                        label: (ctx) => {
                            const providerObj = sortedProviders[ctx.dataIndex];
                            const tps = providerObj ? providerObj.overallAvgTps : ctx.parsed.x;
                            return ` Overall: ${tps.toFixed(1)} TPS`;
                        },
                        afterBody: (items) => {
                            if (!items || !items.length) return [];
                            const providerObj = sortedProviders[items[0].dataIndex];
                            if (!providerObj || !providerObj.models || providerObj.models.length === 0) return [];

                            const lines = ['─────────────────────────────'];
                            providerObj.models.forEach((m) => {
                                const costText = m.cost != null ? ` ($${m.cost.toFixed(2)}/1M)` : '';
                                lines.push(`\u2022 ${m.model}: ${m.tps.toFixed(1)} TPS${costText}`);
                            });
                            return lines;
                        }
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

// Chart 3: Throughput per Dollar (Scatter Plot with Aggregated Points and Range Whiskers)
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

    // Aggregate observations by (Provider, Model) pair to eliminate vertical smearing
    const pairMap = {};
    data.forEach((item) => {
        const provider = item.ProviderName || item.ProviderID || 'Unknown';
        const modelName = item.DisplayName || item.ModelDisplayName || item.ModelID || 'Unknown Model';
        const cost = Number(item.BlendedCostPerMillion ?? item.PromptCostPerMillion ?? item.cost ?? 0);
        const tps = Number(item.ThroughputTPS ?? item.AvgThroughputTPS ?? item.throughput ?? 0);

        const pairKey = `${provider}:::${modelName}`;
        if (!pairMap[pairKey]) {
            pairMap[pairKey] = {
                provider,
                modelName,
                cost,
                tpsList: []
            };
        }

        pairMap[pairKey].tpsList.push(tps);
        if (cost > 0) {
            pairMap[pairKey].cost = cost;
        }
    });

    // Group aggregated points by provider for dataset coloring and legend
    const providerMap = {};
    Object.values(pairMap).forEach((pair) => {
        const tpsList = pair.tpsList;
        const count = tpsList.length;
        const meanTps = count > 0 ? tpsList.reduce((sum, v) => sum + v, 0) / count : 0;
        const minTps = Math.min(...tpsList);
        const maxTps = Math.max(...tpsList);

        if (!providerMap[pair.provider]) {
            providerMap[pair.provider] = [];
        }

        providerMap[pair.provider].push({
            x: pair.cost,
            y: meanTps,
            model: pair.modelName,
            minTps,
            maxTps,
            count
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
            pointHoverRadius: 9
        };
    });

    // Custom plugin to render vertical range whiskers (min to max TPS) per aggregated point
    const rangeWhiskersPlugin = {
        id: 'rangeWhiskers',
        afterDatasetsDraw(chart) {
            const ctx = chart.ctx;
            chart.data.datasets.forEach((dataset, datasetIndex) => {
                const meta = chart.getDatasetMeta(datasetIndex);
                if (meta.hidden) return;
                const color = dataset.borderColor || '#64748b';

                dataset.data.forEach((point, pointIndex) => {
                    if (point.minTps == null || point.maxTps == null || point.minTps === point.maxTps) {
                        return;
                    }
                    const pointElement = meta.data[pointIndex];
                    if (!pointElement) return;

                    const xPixel = pointElement.x;
                    const yMinPixel = chart.scales.y.getPixelForValue(point.minTps);
                    const yMaxPixel = chart.scales.y.getPixelForValue(point.maxTps);

                    ctx.save();
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    // Vertical range line
                    ctx.moveTo(xPixel, yMinPixel);
                    ctx.lineTo(xPixel, yMaxPixel);
                    // Top whisker cap
                    ctx.moveTo(xPixel - 4, yMaxPixel);
                    ctx.lineTo(xPixel + 4, yMaxPixel);
                    // Bottom whisker cap
                    ctx.moveTo(xPixel - 4, yMinPixel);
                    ctx.lineTo(xPixel + 4, yMinPixel);
                    ctx.stroke();
                    ctx.restore();
                });
            });
        }
    };

    const ctx = canvas.getContext('2d');
    scatterChartInstance = new Chart(ctx, {
        type: 'scatter',
        data: { datasets },
        plugins: [rangeWhiskersPlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        title: (items) => {
                            if (!items || !items.length) return '';
                            const raw = items[0].raw || {};
                            return `${raw.model || 'Model'} (${items[0].dataset.label})`;
                        },
                        label: (ctx) => {
                            const raw = ctx.raw || {};
                            const lines = [
                                ` Cost: $${raw.x?.toFixed(2)}/1M tokens`,
                                ` Avg Throughput: ${raw.y?.toFixed(1)} TPS`
                            ];
                            if (raw.minTps != null && raw.maxTps != null && raw.minTps !== raw.maxTps) {
                                lines.push(` Range: ${raw.minTps.toFixed(1)} - ${raw.maxTps.toFixed(1)} TPS (${raw.count} samples)`);
                            } else if (raw.count > 1) {
                                lines.push(` Sample Count: ${raw.count}`);
                            }
                            return lines;
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
