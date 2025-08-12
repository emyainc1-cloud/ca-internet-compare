export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  const address = (req.query.address || "").toString().trim();
  const zip = (req.query.zip || "").toString().trim().slice(0,5);
  if (!address && !zip) {
    return res.status(400).json({ error: "Provide address or zip" });
  }

  const phoneNumber = "805-956-5700";

  const providerCatalog = {
    "Spectrum":  { minPrice: 30.00, maxDown: 1000, phone: phoneNumber, logo: "/logos/spectrum.png" },
    "Xfinity":   { minPrice: 30.00, maxDown: 2000, phone: phoneNumber, logo: "/logos/xfinity.png" },
    "Frontier":  { minPrice: 49.99, maxDown: 2000, phone: phoneNumber, logo: "/logos/frontier.png" },
    "T-Mobile":  { minPrice: 50.00, maxDown: 415,  phone: phoneNumber, logo: "/logos/tmobile.png" },
    "Viasat":    { minPrice: 69.99, maxDown: 150,  phone: phoneNumber, logo: "/logos/viasat.png" },
    "Hughesnet": { minPrice: 49.99, maxDown: 100,  phone: phoneNumber, logo: "/logos/hughesnet.png" },
    "EarthLink": { minPrice: 40.00, maxDown: 2000, phone: phoneNumber, logo: "/logos/earthlink.png" }
  };

  const normalize = (raw) => {
    const s = (raw||"").toLowerCase();
    if (s.includes("charter") || s.includes("spectrum")) return "Spectrum";
    if (s.includes("comcast") || s.includes("xfinity"))  return "Xfinity";
    if (s.includes("frontier"))                          return "Frontier";
    if (s.includes("t-mobile"))                          return "T-Mobile";
    if (s.includes("viasat"))                            return "Viasat";
    if (s.includes("hughes"))                            return "Hughesnet";
    if (s.includes("earthlink"))                         return "EarthLink";
    return null;
  };

  try {
    const query = address || `ZIP ${zip}, CA`;
    const geo = await fetch(`https://broadbandmap.fcc.gov/nbm/map/api/location/forAddress?address=${encodeURIComponent(query)}`);
    const gj = await geo.json();
    const loc = gj?.Results?.[0];
    if (!loc?.LocationId) {
      return res.status(200).json({ query, providers: [], lastUpdated: new Date().toISOString() });
    }

    const av = await fetch(`https://broadbandmap.fcc.gov/nbm/map/api/service/availability?locationId=${encodeURIComponent(loc.LocationId)}`);
    const data = await av.json();

    const seen = new Set();
    const out = [];
    for (const p of (data?.Providers || [])) {
      const key = normalize(p.ProviderName || p.BrandName || p.Name || "");
      if (!key) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      const meta = providerCatalog[key];
      if (!meta) continue;
      out.push({ name: key, ...meta });
    }

    if (out.length === 0) {
      for (const k of Object.keys(providerCatalog)) out.push({ name: k, ...providerCatalog[k] });
    }

    out.sort((a,b) => (a.minPrice ?? 9999) - (b.minPrice ?? 9999));

    res.status(200).json({
      query,
      addressResolved: loc?.DisplayAddress || loc?.FullAddress,
      providers: out,
      lastUpdated: new Date().toISOString()
    });
  } catch (e) {
    res.status(500).json({ error: "Server error", detail: e.message });
  }
}
