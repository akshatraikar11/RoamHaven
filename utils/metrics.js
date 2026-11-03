/**
 * Observability Skill: Zero-Dependency Prometheus Metrics Engine
 * Standard Prometheus 0.0.4 Text Exposition Format
 * Tracks:
 *   - http_requests_total (Counter by method, route, status)
 *   - http_request_duration_ms (Histogram with latency buckets for p95/p99)
 *   - http_active_connections (Gauge)
 *   - payment_total (Counter: razorpay, upi, wallet)
 *   - idempotency_replay_total (Counter)
 *   - circuit_breaker_state_total (Counter)
 */

class Counter {
  constructor(name, help, labelNames = []) {
    this.name = name;
    this.help = help;
    this.labelNames = labelNames;
    this.values = new Map();
  }

  inc(labels = {}, value = 1) {
    const key = this._toKey(labels);
    const curr = this.values.get(key) || 0;
    this.values.set(key, curr + value);
  }

  _toKey(labels) {
    if (!this.labelNames.length) return "";
    return this.labelNames.map((l) => `${l}="${labels[l] || 'unknown'}"`).join(",");
  }

  toPrometheus() {
    let out = `# HELP ${this.name} ${this.help}\n# TYPE ${this.name} counter\n`;
    if (this.values.size === 0) {
      out += `${this.name} 0\n`;
      return out;
    }
    for (const [labels, val] of this.values.entries()) {
      const labelStr = labels ? `{${labels}}` : "";
      out += `${this.name}${labelStr} ${val}\n`;
    }
    return out;
  }
}

class Gauge {
  constructor(name, help) {
    this.name = name;
    this.help = help;
    this.value = 0;
  }

  inc(val = 1) {
    this.value += val;
  }

  dec(val = 1) {
    this.value = Math.max(0, this.value - val);
  }

  set(val) {
    this.value = val;
  }

  toPrometheus() {
    return `# HELP ${this.name} ${this.help}\n# TYPE ${this.name} gauge\n${this.name} ${this.value}\n`;
  }
}

class Histogram {
  constructor(name, help, buckets = [10, 50, 100, 200, 350, 700, 1500, 5000]) {
    this.name = name;
    this.help = help;
    this.buckets = buckets.sort((a, b) => a - b);
    this.bucketCounts = new Map();
    this.sum = 0;
    this.count = 0;
  }

  observe(val) {
    this.count++;
    this.sum += val;
    for (const b of this.buckets) {
      if (val <= b) {
        this.bucketCounts.set(b, (this.bucketCounts.get(b) || 0) + 1);
      }
    }
  }

  toPrometheus() {
    let out = `# HELP ${this.name} ${this.help}\n# TYPE ${this.name} histogram\n`;
    let cumulative = 0;
    for (const b of this.buckets) {
      cumulative = this.bucketCounts.get(b) || 0;
      out += `${this.name}_bucket{le="${b}"} ${cumulative}\n`;
    }
    out += `${this.name}_bucket{le="+Inf"} ${this.count}\n`;
    out += `${this.name}_sum ${this.sum}\n`;
    out += `${this.name}_count ${this.count}\n`;
    return out;
  }
}

// Registry
const httpRequestsTotal = new Counter(
  "http_requests_total",
  "Total number of HTTP requests processed",
  ["method", "route", "status"]
);

const httpRequestDurationMs = new Histogram(
  "http_request_duration_ms",
  "HTTP request duration in milliseconds"
);

const httpActiveConnections = new Gauge(
  "http_active_connections",
  "Current active concurrent HTTP connections"
);

const paymentTotal = new Counter(
  "payment_total",
  "Total payments initiated by method and status",
  ["method", "status"]
);

const idempotencyReplayTotal = new Counter(
  "idempotency_replay_total",
  "Number of duplicate requests replayed from idempotency cache"
);

const circuitBreakerStateTotal = new Counter(
  "circuit_breaker_events_total",
  "Circuit breaker trip and state transitions",
  ["service", "event"]
);

function metricsMiddleware(req, res, next) {
  const start = Date.now();
  httpActiveConnections.inc();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const cleanRoute = (req.baseUrl + (req.route?.path || req.path || ""))
      .replace(/[0-9a-f]{24}/gi, ":id")
      .slice(0, 80);

    httpRequestsTotal.inc({
      method: req.method,
      route: cleanRoute || "/",
      status: String(res.statusCode),
    });
    httpRequestDurationMs.observe(duration);
    httpActiveConnections.dec();
  });

  next();
}

function metricsHandler(req, res) {
  res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  const payload = [
    httpRequestsTotal.toPrometheus(),
    httpRequestDurationMs.toPrometheus(),
    httpActiveConnections.toPrometheus(),
    paymentTotal.toPrometheus(),
    idempotencyReplayTotal.toPrometheus(),
    circuitBreakerStateTotal.toPrometheus(),
    `# Process metrics\nprocess_uptime_seconds ${Math.floor(process.uptime())}\nprocess_heap_bytes ${process.memoryUsage().heapUsed}\n`,
  ].join("\n");
  res.send(payload);
}

module.exports = {
  metricsMiddleware,
  metricsHandler,
  httpRequestsTotal,
  httpRequestDurationMs,
  httpActiveConnections,
  paymentTotal,
  idempotencyReplayTotal,
  circuitBreakerStateTotal,
};
