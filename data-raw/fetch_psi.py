import json, sys, urllib.request, urllib.parse, os
out = sys.argv[1]
ids = sys.argv[2:]
base = "https://psi.nasa.gov/geode-py/ws"
def get(url):
    with urllib.request.urlopen(url, timeout=60) as r: return r.read()
for pid in ids:
    j = get(f"{base}/repo/investigations/{pid}")
    open(os.path.join(out, f"{pid}.json"), "wb").write(j)
    d = json.loads(j)
    tabs = d.get("experimentalTable") or []
    names = []
    for t in tabs:
        fn = t["file_name"]
        if not fn.lower().endswith(".csv"): names.append(fn+" (skipped)"); continue
        u = f"{base}/studies/{pid}/download?file={urllib.parse.quote(fn)}&version=1&redirect=false"
        signed = get(u).decode().strip().strip('"')
        data = get(signed)
        open(os.path.join(out, fn.replace("/", "_")), "wb").write(data)
        names.append(f"{fn} ({len(data)} B)")
    print(pid, d.get("investigationAcronym"), "|", d.get("title","")[:60], "|", names)
