"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ArcgisInvestigationMap } from "./components/ArcgisInvestigationMap.tsx";
import { filterEvidenceForArea } from "./domain/evidence.ts";
import type { EvidenceRecord, InvestigationArea, SourceState } from "./domain/types.ts";
import { fetchUsgsEvidence } from "./sources/usgs.ts";

type LayerId = "earthquakes" | "air-quality" | "thermal";
type TimeWindow = "24h" | "7d" | "30d";
type Activity = { id: number; text: string; kind: "agent" | "human"; time: string };
type ModelContextTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<{ content: { type: "text"; text: string }[] }>;
};

declare global {
  interface Document {
    modelContext?: {
      registerTool: (tool: ModelContextTool, options?: { signal?: AbortSignal }) => Promise<void>;
    };
  }
}

const layerInfo: Record<LayerId, { label: string; source: string; color: string; freshness: string; limitation: string }> = {
  earthquakes: {
    label: "Earthquakes",
    source: "USGS",
    color: "amber",
    freshness: "42 min ago",
    limitation: "Magnitude and location may be revised after review.",
  },
  "air-quality": {
    label: "Air quality",
    source: "OpenAQ",
    color: "mint",
    freshness: "18 min ago",
    limitation: "Station readings do not represent every nearby neighborhood.",
  },
  thermal: {
    label: "Thermal detections",
    source: "NASA FIRMS",
    color: "coral",
    freshness: "2 hr ago",
    limitation: "Satellite heat detections are not confirmed wildfire perimeters.",
  },
};

const observations = [
  { id: "eq-42", layer: "earthquakes" as LayerId, title: "M4.2 · 68 km SW", detail: "Depth 10 km · preliminary", x: 46, y: 58, value: "4.2", confidence: "reviewed" },
  { id: "aq-pm", layer: "air-quality" as LayerId, title: "PM₂.₅ · Moderate", detail: "27 µg/m³ · station reading", x: 54, y: 50, value: "PM", confidence: "measured" },
  { id: "fire-1", layer: "thermal" as LayerId, title: "2 thermal detections", detail: "VIIRS · nominal confidence", x: 63, y: 38, value: "2", confidence: "provisional" },
];

const stamp = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function Home() {
  const [activeLayers, setActiveLayers] = useState<LayerId[]>(["earthquakes", "air-quality", "thermal"]);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("24h");
  const [selection, setSelection] = useState<InvestigationArea>({
    latitude: 25.6866,
    longitude: -100.3161,
    radiusKm: 100,
    label: "Monterrey region",
    updatedBy: "human",
  });
  const [selectedObservation, setSelectedObservation] = useState<string | null>(null);
  const [earthquakes, setEarthquakes] = useState<EvidenceRecord[]>([]);
  const [earthquakeState, setEarthquakeState] = useState<SourceState>({ status: "loading", requestedAt: new Date().toISOString() });
  const [panel, setPanel] = useState<"uncertainty" | "activity" | "about" | "lens" | null>("uncertainty");
  const [activity, setActivity] = useState<Activity[]>([
    { id: 1, kind: "agent", text: "Workspace inspected: 3 sources and 1 human selection are available.", time: stamp() },
  ]);
  const [toolsReady, setToolsReady] = useState(false);
  const areaEarthquakes = filterEvidenceForArea(earthquakes, selection);
  const evidenceResults = areaEarthquakes.length > 0 ? areaEarthquakes : earthquakes.slice(0, 5);
  const selectedEarthquake = earthquakes.find((record) => record.id === selectedObservation);
  const mapEarthquakes = selectedEarthquake && !areaEarthquakes.some((record) => record.id === selectedEarthquake.id)
    ? [...areaEarthquakes, selectedEarthquake]
    : areaEarthquakes;
  const stateRef = useRef({ activeLayers, timeWindow, selection, earthquakes, areaEarthquakes, earthquakeState });

  useEffect(() => {
    stateRef.current = { activeLayers, timeWindow, selection, earthquakes, areaEarthquakes, earthquakeState };
  }, [activeLayers, timeWindow, selection, earthquakes, areaEarthquakes, earthquakeState]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchUsgsEvidence(timeWindow, { signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      if (result.status === "ready") {
        setEarthquakes(result.data);
        setEarthquakeState({ status: "ready", fetchedAt: result.fetchedAt, count: result.data.length });
      } else if (result.status === "empty") {
        setEarthquakes([]);
        setEarthquakeState({ status: "empty", fetchedAt: result.fetchedAt, reason: result.reason });
      } else if (result.code !== "ABORTED") {
        setEarthquakes([]);
        setEarthquakeState({ status: "unavailable", fetchedAt: result.fetchedAt, reason: result.message });
      }
    });
    return () => controller.abort();
  }, [timeWindow]);

  const changeTimeWindow = useCallback((window: TimeWindow) => {
    setEarthquakeState({ status: "loading", requestedAt: new Date().toISOString() });
    setTimeWindow(window);
  }, []);

  const log = useCallback((text: string, kind: Activity["kind"] = "agent") => {
    setActivity((items) => [{ id: Date.now() + Math.random(), text, kind, time: stamp() }, ...items].slice(0, 12));
  }, []);

  const toggleLayer = useCallback((layer: LayerId, fromAgent = false) => {
    setActiveLayers((current) => {
      const on = current.includes(layer);
      const next = on ? current.filter((item) => item !== layer) : [...current, layer];
      log(`${fromAgent ? "Agent" : "You"} ${on ? "removed" : "added"} the ${layerInfo[layer].label.toLowerCase()} layer.`, fromAgent ? "agent" : "human");
      return next;
    });
  }, [log]);

  useEffect(() => {
    if (!document.modelContext) return;
    const controller = new AbortController();
    const json = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });
    const register = (tool: ModelContextTool) => document.modelContext!.registerTool(tool, { signal: controller.signal });
    const tools: ModelContextTool[] = [
      {
        name: "get_workspace_state",
        description: "Inspect the shared Earth Lens map, including the human-selected region, visible layers, time window, and observations.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        execute: async () => json(stateRef.current),
      },
      {
        name: "list_authoritative_sources",
        description: "List environmental sources Earth Lens can visualize, with freshness and known limitations.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        execute: async () => json(Object.entries(layerInfo).map(([id, source]) => ({ id, ...source }))),
      },
      {
        name: "add_environmental_layer",
        description: "Add an authoritative environmental evidence layer to the shared visible map.",
        inputSchema: { type: "object", properties: { layerId: { type: "string", enum: ["earthquakes", "air-quality", "thermal"] } }, required: ["layerId"], additionalProperties: false },
        execute: async ({ layerId }) => {
          const id = layerId as LayerId;
          if (!stateRef.current.activeLayers.includes(id)) {
            setActiveLayers((current) => [...current, id]);
            log(`Agent added the ${layerInfo[id].label.toLowerCase()} layer.`);
          }
          return json({ added: id, source: layerInfo[id] });
        },
      },
      {
        name: "remove_environmental_layer",
        description: "Remove a layer from the shared visible map without deleting its source data.",
        inputSchema: { type: "object", properties: { layerId: { type: "string", enum: ["earthquakes", "air-quality", "thermal"] } }, required: ["layerId"], additionalProperties: false },
        execute: async ({ layerId }) => {
          const id = layerId as LayerId;
          setActiveLayers((current) => current.filter((item) => item !== id));
          log(`Agent removed the ${layerInfo[id].label.toLowerCase()} layer.`);
          return json({ removed: id });
        },
      },
      {
        name: "set_time_window",
        description: "Change the shared investigation time window. This visibly updates the map timeline.",
        inputSchema: { type: "object", properties: { window: { type: "string", enum: ["24h", "7d", "30d"] } }, required: ["window"], additionalProperties: false },
        execute: async ({ window }) => {
          changeTimeWindow(window as TimeWindow);
          log(`Agent changed the evidence window to ${window}.`);
          return json({ timeWindow: window });
        },
      },
      {
        name: "set_geographic_area",
        description: "Set the shared WGS84 investigation center and radius. The map and non-map controls visibly update together.",
        inputSchema: { type: "object", properties: { latitude: { type: "number", minimum: -90, maximum: 90 }, longitude: { type: "number", minimum: -180, maximum: 180 }, radiusKm: { type: "number", exclusiveMinimum: 0, maximum: 2000 }, label: { type: "string" } }, required: ["latitude", "longitude", "radiusKm"], additionalProperties: false },
        execute: async ({ latitude, longitude, radiusKm, label }) => {
          const next: InvestigationArea = { latitude: Number(latitude), longitude: Number(longitude), radiusKm: Number(radiusKm), label: String(label ?? "Agent-selected region"), updatedBy: "agent" };
          setSelection(next);
          log(`Agent focused the map on “${next.label}”.`);
          return json(next);
        },
      },
      {
        name: "query_selected_area",
        description: "Find visible observations that intersect the current human-selected area and return their source context.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        execute: async () => {
          const s = stateRef.current;
          setPanel("activity");
          log(`Agent found ${s.areaEarthquakes.length} USGS earthquake records in your region.`);
          return json({ selection: s.selection, sourceState: s.earthquakeState, evidence: s.areaEarthquakes, caution: "USGS records may change; this is not an emergency alert." });
        },
      },
      {
        name: "inspect_observation",
        description: "Inspect one observation by ID, highlight it on the map, and return its source, freshness, and limitation.",
        inputSchema: { type: "object", properties: { observationId: { type: "string", description: "An evidence ID returned by query_selected_area, for example usgs:..." } }, required: ["observationId"], additionalProperties: false },
        execute: async ({ observationId }) => {
          const item = stateRef.current.earthquakes.find((o) => o.id === observationId);
          if (!item) return json({ error: "Observation not found" });
          setSelectedObservation(item.id);
          setPanel("uncertainty");
          log(`Agent inspected ${item.title} and surfaced its limitation.`);
          return json(item);
        },
      },
      {
        name: "analyze_evidence_coverage",
        description: "Analyze uncertainty, sparse coverage, provisional observations, and source limitations for the current map.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        execute: async () => {
          setPanel("uncertainty");
          log("Agent surfaced evidence gaps and provisional observations.");
          return json({
            assessment: "mixed",
            limitations: stateRef.current.activeLayers.map((id) => ({ layer: id, limitation: layerInfo[id].limitation })),
            warning: "No displayed observation should be treated as an official emergency alert.",
          });
        },
      },
      {
        name: "create_situation_lens",
        description: "Prepare a reproducible, human-reviewable situation lens from the current map state. This does not publish or send anything.",
        inputSchema: { type: "object", properties: { title: { type: "string" } }, additionalProperties: false },
        execute: async ({ title }) => {
          setPanel("lens");
          log("Agent prepared a situation lens for your review.");
          return json({ status: "draft", title: title ?? "Monterrey environmental activity", ...stateRef.current, sources: stateRef.current.activeLayers.map((id) => layerInfo[id]) });
        },
      },
    ];
    Promise.all(tools.map(register)).then(() => setToolsReady(true)).catch(() => setToolsReady(false));
    return () => controller.abort();
  }, [changeTimeWindow, log]);

  const selected = earthquakes.find((item) => item.id === selectedObservation);

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><span className="brandMark">E</span><span>Earth Lens</span></div>
        <button className="status" onClick={() => setPanel("activity")}><span className={`pulse ${toolsReady ? "" : "waiting"}`} /> {toolsReady ? "Agent-ready · 10 tools exposed" : "Waiting for WebMCP browser"}</button>
        <button className="quietButton" onClick={() => setPanel("about")}>About this map</button>
      </header>

      <section className="workspace">
        <aside className="rail">
          <p className="eyebrow">INVESTIGATION 01</p>
          <h1>What’s happening around Monterrey?</h1>
          <p className="lede">A shared evidence workspace for you and your agent.</p>

          <button className="promptCard" onClick={() => setPanel("activity")}>
            <div className="agentRow"><span className="agentIcon">✦</span><strong>Ask your agent</strong><span className="liveTag">WEBMCP</span></div>
            <p>“Show environmental activity that may affect this area today.”</p>
            <div className="chips"><span>Current selection</span><span>Last {timeWindow}</span></div>
          </button>

          <div className="sectionHead"><span>LIVE SIGNALS</span><span>{activeLayers.length}/3</span></div>
          <div className="signalList">
            {(Object.keys(layerInfo) as LayerId[]).map((id) => {
              const info = layerInfo[id];
              const observation = observations.find((item) => item.layer === id)!;
              const earthquakeSummary = earthquakeState.status === "ready"
                ? `${areaEarthquakes.length} in selected area`
                : earthquakeState.status === "loading" ? "Loading live feed…" : earthquakeState.status === "unavailable" ? "Source unavailable" : "No events reported";
              const on = activeLayers.includes(id);
              return (
                <button className={`signal ${on ? "active" : ""}`} key={id} onClick={() => toggleLayer(id)}>
                  <span className={`signalDot ${info.color}`} />
                  <span><small>{info.label}</small><strong>{id === "earthquakes" ? earthquakeSummary : observation.title}</strong><em>{info.source} · {id === "earthquakes" && earthquakeState.status === "ready" ? new Date(earthquakeState.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : info.freshness}</em></span>
                  <b>{on ? "✓" : "+"}</b>
                </button>
              );
            })}
          </div>

          <div className="earthquakeResults" aria-live="polite">
            <div className="sectionHead"><span>{areaEarthquakes.length > 0 ? "USGS EVIDENCE IN AREA" : "RECENT USGS FEED"}</span><span>{areaEarthquakes.length}</span></div>
            {earthquakeState.status === "loading" && <p>Loading the authoritative USGS feed…</p>}
            {earthquakeState.status === "unavailable" && <p role="alert">USGS is temporarily unavailable: {earthquakeState.reason}</p>}
            {earthquakeState.status === "empty" && <p>{earthquakeState.reason}</p>}
            {earthquakeState.status === "ready" && areaEarthquakes.length === 0 && <p>No earthquakes intersect the selected area. These recent feed examples are outside it and are provided for source inspection.</p>}
            {evidenceResults.slice(0, 5).map((record) => (
              <button key={record.id} className={`evidenceResult ${selectedObservation === record.id ? "selected" : ""}`} onClick={() => { setSelectedObservation(record.id); setPanel("uncertainty"); }}>
                <strong>{record.title}</strong>
                <span>{new Date(record.observedAt).toLocaleString()} · {String(record.attributes.status)}</span>
              </button>
            ))}
          </div>

          <div className="sourceNote"><span>✓</span><p><strong>Source-aware</strong><br />Every observation keeps its source, freshness, and limits.</p></div>
          <button className="activityButton" onClick={() => setPanel("activity")}><span>↗</span> Open collaboration trail <b>{activity.length}</b></button>
        </aside>

        <div
          className="map"
          aria-label="Environmental evidence map centered on Monterrey"
          role="region"
        >
          <ArcgisInvestigationMap
            area={selection}
            evidence={activeLayers.includes("earthquakes") ? mapEarthquakes : []}
            selectedEvidenceId={selectedObservation}
            onEvidenceSelect={(id) => { setSelectedObservation(id); setPanel("uncertainty"); }}
            onAreaChange={(nextArea) => { setSelection(nextArea); log("You revised the investigation area.", "human"); }}
          />
          <div className="timebar">
            <button aria-label="Previous time window">◀</button>
            <div><span style={{ width: timeWindow === "24h" ? "42%" : timeWindow === "7d" ? "72%" : "92%" }} /><i style={{ left: timeWindow === "24h" ? "42%" : timeWindow === "7d" ? "72%" : "92%" }} /></div>
            <button aria-label="Next time window">▶</button>
            <select aria-label="Evidence time window" value={timeWindow} onChange={(event) => { changeTimeWindow(event.target.value as TimeWindow); log(`You changed the evidence window to ${event.target.value}.`, "human"); }}>
              <option value="24h">Last 24 hours</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option>
            </select>
          </div>
          <div className="legend">{(Object.keys(layerInfo) as LayerId[]).filter((id) => activeLayers.includes(id)).map((id) => <span key={id}><i className={layerInfo[id].color} /> {layerInfo[id].label}</span>)}</div>

          {panel === "uncertainty" && (
            <div className="evidenceCard">
              <button className="close" onClick={() => setPanel(null)} aria-label="Close">×</button>
              <p className="eyebrow">EVIDENCE, NOT A VERDICT</p>
              <strong>{selected ? selected.title : "Evidence needs context"}</strong>
              <p>{selected ? selected.limitation : "Select a live USGS event from the map or evidence list to inspect its provenance and limitations."}</p>
              <div className="sourceStrip"><span>{selected ? "USGS" : "Public sources"}</span><span>{selected ? new Date(selected.observedAt).toLocaleString() : "live when available"}</span></div>
              {selected && <a className="sourceLink" href={selected.sourceUrl} target="_blank" rel="noreferrer">Open authoritative USGS record ↗</a>}
              <button className="textAction" onClick={() => { setPanel("activity"); log("You asked the agent to inspect uncertainty.", "human"); }}>Ask the agent to investigate →</button>
            </div>
          )}
          {panel === "activity" && <SidePanel title="Collaboration trail" eyebrow="HUMAN + AGENT" onClose={() => setPanel(null)}><div className="activityList">{activity.map((item) => <div className={`activity ${item.kind}`} key={item.id}><span>{item.kind === "agent" ? "✦" : "You"}</span><p>{item.text}</p><time>{item.time}</time></div>)}</div></SidePanel>}
          {panel === "about" && <SidePanel title="A map you can question" eyebrow="ABOUT EARTH LENS" onClose={() => setPanel(null)}><p>Earth Lens is a shared spatial evidence workspace. Your agent operates semantic WebMCP tools—not map buttons—while every action remains visible and reversible.</p><p className="fineprint">Earthquake evidence is retrieved live from USGS. Air-quality and thermal layers remain illustrative and clearly secondary. Earth Lens is not an official emergency alert.</p></SidePanel>}
          {panel === "lens" && <SidePanel title="Situation lens ready for review" eyebrow="DRAFT · NOT PUBLISHED" onClose={() => setPanel(null)}><div className="lensSummary"><b>{selection.label}</b><span>Last {timeWindow}</span><span>{activeLayers.length} active sources</span><span>{observations.filter((o) => activeLayers.includes(o.layer)).length} visible observations</span></div><p className="fineprint">The agent prepared this state. Only you can decide whether to share or publish it.</p><button className="primaryButton" onClick={() => log("You reviewed the draft situation lens.", "human")}>Mark as reviewed</button></SidePanel>}
        </div>
      </section>
    </main>
  );
}

function SidePanel({ title, eyebrow, onClose, children }: { title: string; eyebrow: string; onClose: () => void; children: React.ReactNode }) {
  return <aside className="sidePanel"><button className="close" onClick={onClose} aria-label="Close">×</button><p className="eyebrow">{eyebrow}</p><h2>{title}</h2>{children}</aside>;
}
