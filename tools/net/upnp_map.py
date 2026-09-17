#!/usr/bin/env python3
"""UPnP IGD port-mapper (stdlib only — no install).

Discovers the home router's Internet Gateway Device over SSDP and, with --map,
asks it to forward a TCP port to this machine. This is the same mechanism Bitcoin
Core's NAT-PMP would use, but for routers that only speak UPnP.

Usage:
  python3 tools/net/upnp_map.py --discover
  python3 tools/net/upnp_map.py --map --port 8333 --internal 192.168.29.211
  python3 tools/net/upnp_map.py --list
  python3 tools/net/upnp_map.py --unmap --port 8333
"""
import argparse
import re
import socket
import sys
import urllib.request
import xml.etree.ElementTree as ET

SSDP_ADDR = ("239.255.255.250", 1900)
SEARCH = ("M-SEARCH * HTTP/1.1\r\n"
          "HOST: 239.255.255.250:1900\r\n"
          'MAN: "ssdp:discover"\r\n'
          "MX: 2\r\n"
          "ST: urn:schemas-upnp-org:device:InternetGatewayDevice:1\r\n"
          "\r\n")
NS = "{urn:schemas-upnp-org:device-1-0}"


def ssdp_discover(timeout=4):
    """Return the LOCATION URL of the first IGD that answers."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.settimeout(timeout)
    s.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 2)
    try:
        s.sendto(SEARCH.encode(), SSDP_ADDR)
        while True:
            try:
                data, _ = s.recvfrom(65507)
            except socket.timeout:
                return None
            m = re.search(rb"(?i)^LOCATION:\s*(\S+)", data, re.M)
            if m:
                return m.group(1).decode()
    finally:
        s.close()


def control_url(location):
    """Fetch the device description and return (service_type, controlURL, base)."""
    with urllib.request.urlopen(location, timeout=8) as r:
        root = ET.fromstring(r.read())
    base = location
    for svc in root.iter(NS + "service"):
        st = svc.findtext(NS + "serviceType") or ""
        if "WANIPConnection" in st or "WANPPPConnection" in st:
            cu = svc.findtext(NS + "controlURL")
            if cu:
                return st, cu
    # fall back: any WAN* service
    for svc in root.iter(NS + "service"):
        st = svc.findtext(NS + "serviceType") or ""
        if "WAN" in st:
            return st, svc.findtext(NS + "controlURL")
    return None, None


def join(base, path):
    if path.startswith("http"):
        return path
    root = re.match(r"https?://[^/]+", base).group(0)
    if not path.startswith("/"):
        path = "/" + path
    return root + path


def soap(url, service, action, body):
    env = ('<?xml version="1.0"?>\n'
           '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" '
           's:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">'
           '<s:Body><u:%s xmlns:u="%s">%s</u:%s></s:Body></s:Envelope>'
           % (action, service, body, action))
    req = urllib.request.Request(url, data=env.encode(), method="POST", headers={
        "Content-Type": 'text/xml; charset="utf-8"',
        "SOAPAction": '"%s#%s"' % (service, action),
    })
    with urllib.request.urlopen(req, timeout=10) as r:
        return r.read().decode(errors="replace")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--discover", action="store_true")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--map", action="store_true")
    ap.add_argument("--unmap", action="store_true")
    ap.add_argument("--port", type=int, default=8333)
    ap.add_argument("--internal", default=None)
    args = ap.parse_args()

    loc = ssdp_discover()
    if not loc:
        print("NO IGD FOUND — the router does not advertise UPnP, or UPnP is disabled.")
        return 2
    print("IGD description :", loc)
    st, cu = control_url(loc)
    if not cu:
        print("No WAN connection service in the IGD description — UPnP mapping unavailable.")
        return 2
    url = join(loc, cu)
    print("service         :", st)
    print("control URL     :", url)

    if args.discover and not (args.list or args.map or args.unmap):
        return 0

    if args.list:
        try:
            out = soap(url, st, "GetGenericPortMappingEntry",
                       "<NewPortMappingIndex>0</NewPortMappingIndex>")
            print("first mapping   :", re.sub(r"\s+", " ", out)[:300])
        except Exception as e:
            print("list failed     :", e)

    if args.map:
        if not args.internal:
            print("--map needs --internal <LAN IP>")
            return 2
        body = ("<NewRemoteHost></NewRemoteHost>"
                "<NewExternalPort>%d</NewExternalPort>"
                "<NewProtocol>TCP</NewProtocol>"
                "<NewInternalPort>%d</NewInternalPort>"
                "<NewInternalClient>%s</NewInternalClient>"
                "<NewEnabled>1</NewEnabled>"
                "<NewPortMappingDescription>bitcoin</NewPortMappingDescription>"
                "<NewLeaseDuration>0</NewLeaseDuration>"
                % (args.port, args.port, args.internal))
        try:
            soap(url, st, "AddPortMapping", body)
            print("MAPPED          : TCP %d -> %s:%d" % (args.port, args.internal, args.port))
        except Exception as e:
            print("map failed      :", e)
            return 3
        try:
            out = soap(url, st, "GetExternalIPAddress", "<NewExternalIPAddress></NewExternalIPAddress>")
            m = re.search(r"<NewExternalIPAddress>([^<]*)<", out)
            if m:
                print("external IP     :", m.group(1))
        except Exception:
            pass

    if args.unmap:
        body = ("<NewRemoteHost></NewRemoteHost>"
                "<NewExternalPort>%d</NewExternalPort><NewProtocol>TCP</NewProtocol>"
                % args.port)
        try:
            soap(url, st, "DeletePortMapping", body)
            print("UNMAPPED        : TCP %d" % args.port)
        except Exception as e:
            print("unmap failed    :", e)
    return 0


if __name__ == "__main__":
    sys.exit(main())
