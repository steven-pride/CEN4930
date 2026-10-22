// Client-side dashboard scaffolding using Chart.js

let latencyChartInstance = null;
let throughputChartInstance = null;
let scatterChartInstance = null;

// Initialize dashboard on load
document.addEventListener('DOMContentLoaded', () => {
    initLatencyChart();
    initThroughputChart();
    initScatterChart();
});

// Chart 1: Latency Over Time (Line Chart)
function initLatencyChart() {
    const ctx = document.getElementById('latencyChart').getContext('2d');
    latencyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['12:00', '13:00', '14:00', '15:00', '16:00'],
            datasets: [
                {
                    label: 'Together AI (ms)',
                    data: [240, 245, 238, 250, 242],
                    borderColor: '#4e73df',
                    tension: 0.2
                },
                {
                    label: 'Groq (ms)',
                    data: [115, 120, 118, 125, 121],
                    borderColor: '#1cc88a',
                    tension: 0.2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { title: { display: true, text: 'Latency (ms)' } },
                x: { title: { display: true, text: 'Time' } }
            }
        }
    });
}

// Chart 2: Averaged Throughput by Model (Horizontal Bar Chart)
function initThroughputChart() {
    const ctx = document.getElementById('throughputChart').getContext('2d');
    throughputChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Groq', 'Together AI', 'DeepInfra'],
            datasets: [
                {
                    label: 'Tokens Per Second (TPS)',
                    data: [285.4, 142.1, 160.8],
                    backgroundColor: ['#1cc88a', '#4e73df', '#36b9cc']
                }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: 'Throughput (TPS)' } }
            }
        }
    });
}

// Chart 3: Throughput per Dollar (Scatter Plot)
function initScatterChart() {
    const ctx = document.getElementById('scatterChart').getContext('2d');
    scatterChartInstance = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: 'Together AI',
                    data: [{ x: 0.20, y: 142.1 }],
                    backgroundColor: '#4e73df'
                },
                {
                    label: 'Groq',
                    data: [{ x: 0.08, y: 285.4 }],
                    backgroundColor: '#1cc88a'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: 'Blended Cost ($ / 1M Tokens)' } },
                y: { title: { display: true, text: 'Throughput (TPS)' } }
            }
        }
    });
}
