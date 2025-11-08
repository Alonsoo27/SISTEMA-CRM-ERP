// ============================================
// MÓDULO DE GRÁFICOS PARA PDF
// Genera gráficos profesionales usando Chart.js
// SOLUCIÓN: Renderizar a imagen y luego insertar en PDF
// ============================================

const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const PDFStyles = require('./PDFStyles');

class PDFCharts {
    /**
     * Generar gráfico donut (rosca) como imagen
     * @param {Array} datos - [{label, valor, color}, ...]
     * @param {Object} opciones - {width, height, showLegend}
     * @returns {Promise<Buffer>} Buffer de imagen PNG
     */
    static async generarDonut(datos, opciones = {}) {
        const {
            width = 600,
            height = 400,
            showLegend = true,
            title = ''
        } = opciones;

        const chartJSNodeCanvas = new ChartJSNodeCanvas({
            width,
            height,
            backgroundColour: 'white'
        });

        const configuration = {
            type: 'doughnut',
            data: {
                labels: datos.map(d => d.label),
                datasets: [{
                    data: datos.map(d => d.valor),
                    backgroundColor: datos.map(d => d.color),
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: false,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: showLegend,
                        position: 'right',
                        labels: {
                            font: {
                                size: 12,
                                family: 'Arial'
                            },
                            padding: 15,
                            usePointStyle: true
                        }
                    },
                    title: {
                        display: !!title,
                        text: title,
                        font: {
                            size: 16,
                            weight: 'bold'
                        },
                        padding: 20
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        };

        return await chartJSNodeCanvas.renderToBuffer(configuration);
    }

    /**
     * Generar gauge semicircular (medidor) como imagen
     * @param {Number} valor - Valor actual
     * @param {Object} opciones - {max, label, width, height}
     * @returns {Promise<Buffer>} Buffer de imagen PNG
     */
    static async generarGauge(valor, opciones = {}) {
        const {
            max = 150,
            label = 'Eficiencia',
            width = 500,
            height = 350,
            unidad = '%'
        } = opciones;

        // Determinar color según valor
        let color;
        if (valor <= 100) color = PDFStyles.COLORES.VERDE;
        else if (valor <= 120) color = PDFStyles.COLORES.AMARILLO;
        else color = PDFStyles.COLORES.ROJO;

        const chartJSNodeCanvas = new ChartJSNodeCanvas({
            width,
            height,
            backgroundColour: 'white'
        });

        const configuration = {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [valor, Math.max(0, max - valor)],
                    backgroundColor: [color, '#f3f4f6'],
                    borderWidth: 0,
                    circumference: 180,
                    rotation: 270
                }]
            },
            options: {
                responsive: false,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: label,
                        font: {
                            size: 18,
                            weight: 'bold'
                        },
                        padding: 20
                    },
                    tooltip: {
                        enabled: false
                    }
                }
            },
            plugins: [{
                id: 'gaugeText',
                afterDraw: (chart) => {
                    const ctx = chart.ctx;
                    const centerX = (chart.chartArea.left + chart.chartArea.right) / 2;
                    const centerY = chart.chartArea.bottom - 30;

                    // Valor grande
                    ctx.save();
                    ctx.font = 'bold 48px Arial';
                    ctx.fillStyle = color;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(`${valor}${unidad}`, centerX, centerY);
                    ctx.restore();

                    // Label pequeño debajo
                    ctx.save();
                    ctx.font = '14px Arial';
                    ctx.fillStyle = '#6b7280';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'top';
                    ctx.fillText(`de ${max}${unidad}`, centerX, centerY + 35);
                    ctx.restore();
                }
            }]
        };

        return await chartJSNodeCanvas.renderToBuffer(configuration);
    }

    /**
     * Generar gráfico de barras horizontales como imagen
     * @param {Array} datos - [{label, valor, color}, ...]
     * @param {Object} opciones - {width, height, title}
     * @returns {Promise<Buffer>} Buffer de imagen PNG
     */
    static async generarBarrasHorizontal(datos, opciones = {}) {
        const {
            width = 700,
            height = 400,
            title = ''
        } = opciones;

        const chartJSNodeCanvas = new ChartJSNodeCanvas({
            width,
            height,
            backgroundColour: 'white'
        });

        const configuration = {
            type: 'bar',
            data: {
                labels: datos.map(d => d.label),
                datasets: [{
                    label: 'Actividades Completadas',
                    data: datos.map(d => d.valor),
                    backgroundColor: datos.map(d => d.color || PDFStyles.COLORES.AZUL_MEDIO),
                    borderWidth: 0,
                    borderRadius: 6
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: false,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: !!title,
                        text: title,
                        font: {
                            size: 16,
                            weight: 'bold'
                        },
                        padding: 20
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: {
                            display: true,
                            color: '#f3f4f6'
                        },
                        ticks: {
                            font: {
                                size: 11
                            }
                        }
                    },
                    y: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                size: 12
                            }
                        }
                    }
                }
            }
        };

        return await chartJSNodeCanvas.renderToBuffer(configuration);
    }

    /**
     * Generar gráfico de líneas (tendencia temporal)
     * @param {Array} datos - [{label, valor}, ...]
     * @param {Object} opciones - {width, height, title}
     * @returns {Promise<Buffer>} Buffer de imagen PNG
     */
    static async generarLineas(datos, opciones = {}) {
        const {
            width = 700,
            height = 350,
            title = '',
            color = PDFStyles.COLORES.AZUL_MEDIO
        } = opciones;

        const chartJSNodeCanvas = new ChartJSNodeCanvas({
            width,
            height,
            backgroundColour: 'white'
        });

        const configuration = {
            type: 'line',
            data: {
                labels: datos.map(d => d.label),
                datasets: [{
                    label: 'Tendencia',
                    data: datos.map(d => d.valor),
                    borderColor: color,
                    backgroundColor: color + '20', // 20% opacity
                    fill: true,
                    tension: 0.3,
                    borderWidth: 3,
                    pointRadius: 5,
                    pointBackgroundColor: color,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: false,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: !!title,
                        text: title,
                        font: {
                            size: 16,
                            weight: 'bold'
                        },
                        padding: 20
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            display: true,
                            color: '#f3f4f6'
                        },
                        ticks: {
                            font: {
                                size: 11
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                size: 11
                            }
                        }
                    }
                }
            }
        };

        return await chartJSNodeCanvas.renderToBuffer(configuration);
    }

    /**
     * Generar gráfico de barras comparativo (antes/después)
     * @param {Array} datos - [{label, anterior, actual}, ...]
     * @param {Object} opciones - {width, height, title}
     * @returns {Promise<Buffer>} Buffer de imagen PNG
     */
    static async generarComparativo(datos, opciones = {}) {
        const {
            width = 700,
            height = 400,
            title = 'Comparativa Períodos'
        } = opciones;

        const chartJSNodeCanvas = new ChartJSNodeCanvas({
            width,
            height,
            backgroundColour: 'white'
        });

        const configuration = {
            type: 'bar',
            data: {
                labels: datos.map(d => d.label),
                datasets: [
                    {
                        label: 'Período Anterior',
                        data: datos.map(d => d.anterior),
                        backgroundColor: PDFStyles.COLORES.GRIS,
                        borderWidth: 0,
                        borderRadius: 6
                    },
                    {
                        label: 'Período Actual',
                        data: datos.map(d => d.actual),
                        backgroundColor: PDFStyles.COLORES.AZUL_MEDIO,
                        borderWidth: 0,
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: false,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            font: {
                                size: 12
                            },
                            padding: 15,
                            usePointStyle: true
                        }
                    },
                    title: {
                        display: !!title,
                        text: title,
                        font: {
                            size: 16,
                            weight: 'bold'
                        },
                        padding: 20
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            display: true,
                            color: '#f3f4f6'
                        },
                        ticks: {
                            font: {
                                size: 11
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                size: 11
                            }
                        }
                    }
                }
            }
        };

        return await chartJSNodeCanvas.renderToBuffer(configuration);
    }
}

module.exports = PDFCharts;
