#!/usr/bin/env python3
"""Bounded HTTP fetch whose deadline also covers DNS.

WHY THIS EXISTS

urllib's `timeout` bounds socket operations but NOT name resolution.
`socket.getaddrinfo` has no timeout of its own and can block indefinitely when a
resolver is slow or wedged. That is the hole a collector job fell through: it ran
2,943s against a 300s limit, and separately the bridge watchtower ran 9,335s,
starving every job behind them. Raising the socket timeout does not help — the
blocking call is the resolver, before any socket exists.

THE FIX

Run the whole request inside a DAEMON thread and wait on a queue with a deadline.
A daemon thread is not joined at interpreter exit, so a lookup that never returns
cannot hold the process open: the caller raises TimeoutError at the deadline and
the script moves on (or is killed) promptly. An abandoned thread leaks, but these
are short-lived processes and the alternative is a wedged pipeline.

This bounds DNS, connect, TLS, and read together — one deadline for the call, not
one per phase.

USAGE

    import sys, os
    sys.path.insert(0, os.path.join(ROOT, "tools"))
    from netfetch import bounded_get

    raw  = bounded_get(url, timeout=20)                    # bytes
    obj  = bounded_get(url, timeout=20, json=True)         # parsed
    body, headers = bounded_get(url, timeout=20, with_headers=True)
"""
import json as _json
import queue
import socket
import threading
import urllib.error
import urllib.request

UA = {"User-Agent": "bitcoinsahi-research/1.0 (+https://bitcoinsahi.com)"}

# Scripts may set this once to bound every call that does not pass a timeout.
DEFAULT_TIMEOUT = 20.0

# Grace added to the queue wait so the in-thread socket timeout usually wins and
# we get the real error, rather than racing it.
_GRACE = 2.0


class FetchError(Exception):
    """Network/HTTP failure (as opposed to exceeding the deadline)."""


def _is_timeout(e):
    """True for a socket/URL timeout, wherever it surfaced from.

    A deadline can be hit in two places: the socket timeout inside the thread
    (surfaces as URLError(reason=timeout)) or the queue deadline (DNS hang). Both
    mean the same thing to a caller, so both become TimeoutError.
    """
    if isinstance(e, (TimeoutError, socket.timeout)):
        return True
    if isinstance(e, urllib.error.URLError):
        return isinstance(getattr(e, "reason", None), (TimeoutError, socket.timeout))
    return False


def _request(url, timeout, headers, data, method):
    req = urllib.request.Request(url, headers=headers or UA, data=data, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read(), dict(r.headers)


def bounded_get(url, timeout=None, headers=None, data=None, method=None,
                json=False, with_headers=False, retries=0):
    """Fetch `url` under a wall-clock deadline that also covers DNS.

    Returns bytes, or a parsed object when json=True, or (body, headers) when
    with_headers=True. Raises TimeoutError past the deadline and FetchError on
    a network/HTTP error (after `retries` extra attempts).
    """
    t = DEFAULT_TIMEOUT if timeout is None else float(timeout)
    last = None
    for _ in range(retries + 1):
        q = queue.Queue(maxsize=1)

        def run():
            try:
                q.put((True, _request(url, t, headers, data, method)))
            except BaseException as e:          # noqa: BLE001 - relay to caller
                q.put((False, e))

        threading.Thread(target=run, daemon=True).start()
        try:
            ok, val = q.get(timeout=t + _GRACE)
        except queue.Empty:
            raise TimeoutError("bounded_get: %s exceeded %.1fs (DNS+socket)" % (url, t))
        if ok:
            body, hdrs = val
            if with_headers:
                return body, hdrs
            return _json.loads(body.decode("utf-8", "replace")) if json else body
        if _is_timeout(val):
            raise TimeoutError("bounded_get: %s exceeded %.1fs (socket)" % (url, t))
        last = val

    if isinstance(last, urllib.error.HTTPError):
        raise FetchError("HTTP %s for %s" % (last.code, url))
    raise FetchError("%s: %s" % (url, last))


def bounded_call(fn, timeout=None, *args, **kwargs):
    """Bound ANY blocking call (not just HTTP), e.g. a bitcoin-cli RPC.

    Same daemon-thread + deadline mechanism, so a hung subprocess or socket
    cannot outlive its budget.
    """
    t = DEFAULT_TIMEOUT if timeout is None else float(timeout)
    q = queue.Queue(maxsize=1)

    def run():
        try:
            q.put((True, fn(*args, **kwargs)))
        except BaseException as e:              # noqa: BLE001
            q.put((False, e))

    threading.Thread(target=run, daemon=True).start()
    try:
        ok, val = q.get(timeout=t + _GRACE)
    except queue.Empty:
        raise TimeoutError("bounded_call: exceeded %.1fs" % t)
    if not ok:
        raise val
    return val


if __name__ == "__main__":
    # Self-test: a live fetch, a blackholed address (must hit the deadline), and
    # a bounded_call. No repo files touched.
    import time
    ok = True

    try:
        n = len(bounded_get("https://blockstream.info/api/blocks/tip/height", timeout=15))
        print("1) live fetch            -> %d bytes  PASS" % n)
    except Exception as e:
        ok = False
        print("1) live fetch            -> FAIL: %r" % e)

    t0 = time.time()
    try:
        bounded_get("http://10.255.255.1/", timeout=2)
        print("2) blackhole             -> returned?!  FAIL")
        ok = False
    except TimeoutError:
        dt = time.time() - t0
        good = dt < 6
        ok &= good
        print("2) blackhole deadline    -> TimeoutError in %.1fs  %s" % (dt, "PASS" if good else "FAIL"))
    except Exception as e:
        ok = False
        print("2) blackhole             -> FAIL: %r" % e)

    try:
        bounded_call(lambda: 42, 5)
        print("3) bounded_call          -> PASS")
    except Exception as e:
        ok = False
        print("3) bounded_call          -> FAIL: %r" % e)

    print("SELF-TEST " + ("PASS" if ok else "FAIL"))
