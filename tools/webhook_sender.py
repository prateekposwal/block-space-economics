#!/usr/bin/env python3
"""Webhook sender — POSTs alerts to configured URLs.

Two alert sources, merged here so there is ONE outbound channel:
  * tools/alerts.json       — ops-health (single writer; it overwrites each run)
  * data/bridge_alerts.json — the bridge backing-ratio watchtower

Keeping them separate files avoids fighting over the single-writer ops file, and
merging at the sender means a bridge alert actually reaches the webhook instead of
being written to a file nobody reads.

Config: tools/webhook_config.json
Each entry: {"url": "https://example.com/webhook", "events": ["high_fee", ...]}
"""
import json, os, sys, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from netfetch import bounded_call  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_FILE = os.path.join(os.path.dirname(__file__), 'webhook_config.json')
ALERT_FILE = os.path.join(os.path.dirname(__file__), 'alerts.json')
BRIDGE_ALERT_FILE = os.path.join(ROOT, 'data', 'bridge_alerts.json')


def _load_alerts(path, tag):
    """Return ([tagged alert strings], timestamp) for one alert file."""
    try:
        with open(path) as f:
            d = json.load(f)
    except Exception:
        return [], None
    got = [a for a in (d.get('alerts') or []) if a]
    return [tag + a for a in got], (d.get('timestamp') or d.get('at'))


def main():
    alerts, ts = [], None
    for path, tag in ((ALERT_FILE, ''), (BRIDGE_ALERT_FILE, 'BRIDGE: ')):
        got, t = _load_alerts(path, tag)
        alerts += got
        ts = ts or t

    if not alerts:
        return
    alert_data = {"alerts": alerts, "timestamp": ts}
    
    # Load webhook config
    config = {"webhooks": []}
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE) as f:
            config = json.load(f)
    
    if not config.get('webhooks'):
        print("No webhooks configured. Create tools/webhook_config.json:")
        print('[{"url": "https://your-server.com/webhook", "events": ["high_fee"]}]')
        return
    
    payload = json.dumps({
        "source": "bitcoinsahi.com",
        "timestamp": alert_data.get("timestamp", ""),
        "alerts": alerts,
    }).encode()
    
    for hook in config['webhooks']:
        try:
            req = urllib.request.Request(hook['url'], data=payload,
                headers={'Content-Type': 'application/json'}, method='POST')

            def _post(_req=req):
                with urllib.request.urlopen(_req, timeout=10) as _r:
                    return _r.status

            # bounded_call re-raises the original error, so the except below is
            # unchanged; it only adds a deadline that also covers DNS. Without it a
            # dead webhook host could stall the alert path.
            status = bounded_call(_post, 10)
            print(f"Webhook sent to {hook['url']}: {status}")
            if status >= 300:
                print(f"  WARNING non-2xx response: {status}")
        except Exception as e:
            print(f"Webhook failed for {hook['url']}: {e}")

if __name__ == "__main__":
    main()
