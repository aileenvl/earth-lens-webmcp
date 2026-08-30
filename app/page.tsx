"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type LayerId = "earthquakes" | "air-quality" | "thermal";
type TimeWindow = "12h" | "24h" | "7d";
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
  const [selection, setSelection] = useState({ x: 52, y: 51, radius: 17, label: "Monterrey region" });
  const [selectedObservation, setSelectedObservation] = useState<string | null>(null);
  const [panel, setPanel] = useState<"uncertainty" | "activity" | "about" | "lens" | null>("uncertainty");
  const [activity, setActivity] = useState<Activity[]>([
    { id: 1, kind: "agent", text: "Workspace inspected: 3 sources and 1 human selection are available.", time: stamp() },
  ]);
  const [toolsReady, setToolsReady] = useState(false);
  const stateRef = useRef({ activeLayers, timeWindow, selection });

  useEffect(() => {
    stateRef.current = { activeLayers, timeWindow, selection };
  }, [activeLayers, timeWindow, selection]);

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
        execute: async () => json({ ...stateRef.current, observations: observations.filter((o) => stateRef.current.activeLayers.includes(o.layer)) }),
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
        inputSchema: { type: "object", properties: { window: { type: "string", enum: ["12h", "24h", "7d"] } }, required: ["window"], additionalProperties: false },
        execute: async ({ window }) => {
          setTimeWindow(window as TimeWindow);
          log(`Agent changed the evidence window to ${window}.`);
          return json({ timeWindow: window });
        },
      },
      {
        name: "set_geographic_area",
        description: "Move the investigation circle on the current map using percentage coordinates, preserving a visible region the human can adjust.",
        inputSchema: { type: "object", properties: { x: { type: "number", minimum: 15, maximum: 85 }, y: { type: "number", minimum: 15, maximum: 80 }, radius: { type: "number", minimum: 8, maximum: 28 }, label: { type: "string" } }, required: ["x", "y"], additionalProperties: false },
        execute: async ({ x, y, radius, label }) => {
          const next = { x: Number(x), y: Number(y), radius: Number(radius ?? 17), label: String(label ?? "Agent-selected region") };
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
          const hits = observations.filter((o) => s.activeLayers.includes(o.layer) && Math.hypot(o.x - s.selection.x, o.y - s.selection.y) <= s.selection.radius);
          setPanel("activity");
          log(`Agent queried your region and found ${hits.length} visible observations.`);
          return json({ selection: s.selection, count: hits.length, observations: hits, caution: "Proximity does not establish causation or impact." });
        },
      },
      {
        name: "inspect_observation",
        description: "Inspect one observation by ID, highlight it on the map, and return its source, freshness, and limitation.",
        inputSchema: { type: "object", properties: { observationId: { type: "string", enum: observations.map((o) => o.id) } }, required: ["observationId"], additionalProperties: false },
        execute: async ({ observationId }) => {
          const item = observations.find((o) => o.id === observationId);
          if (!item) return json({ error: "Observation not found" });
          setSelectedObservation(item.id);
          setPanel("uncertainty");
          log(`Agent inspected ${item.title} and surfaced its limitation.`);
          return json({ ...item, source: layerInfo[item.layer] });
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
  }, [log]);

  const selected = observations.find((item) => item.id === selectedObservation);

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
              const on = activeLayers.includes(id);
              return (
                <button className={`signal ${on ? "active" : ""}`} key={id} onClick={() => toggleLayer(id)}>
                  <span className={`signalDot ${info.color}`} />
                  <span><small>{info.label}</small><strong>{observation.title}</strong><em>{info.source} · {info.freshness}</em></span>
                  <b>{on ? "✓" : "+"}</b>
                </button>
              );
            })}
          </div>

          <div className="sourceNote"><span>✓</span><p><strong>Source-aware</strong><br />Every observation keeps its source, freshness, and limits.</p></div>
          <button className="activityButton" onClick={() => setPanel("activity")}><span>↗</span> Open collaboration trail <b>{activity.length}</b></button>
        </aside>

        <div
          className="map"
          aria-label="Environmental evidence map centered on Monterrey"
          role="region"
        >
          <div className="mapGrid" />
          <div className="terrain terrainOne" /><div className="terrain terrainTwo" /><div className="terrain terrainThree" />
          <div className="road roadOne" /><div className="road roadTwo" /><div className="road roadThree" />
          <div className="place monterrey">MONTERREY</div><div className="place saltillo">SALTILLO</div><div className="place linares">LINARES</div>
          <div className="region" style={{ left: `${selection.x}%`, top: `${selection.y}%`, width: `${selection.radius * 2}%`, height: `${selection.radius * 2}%` }}><span>{selection.label}</span></div>

          {observations.filter((item) => activeLayers.includes(item.layer)).map((item) => (
            <button
              key={item.id}
              className={`marker ${item.layer} ${selectedObservation === item.id ? "selected" : ""}`}
              style={{ left: `${item.x}%`, top: `${item.y}%` }}
              onClick={() => { setSelectedObservation(item.id); setPanel("uncertainty"); log(`You inspected ${item.title}.`, "human"); }}
              aria-label={`Inspect ${item.title}`}
            ><i>{item.value}</i></button>
          ))}

          <div className="mapHint">Select an observation to inspect its evidence</div>
          <div className="mapTools"><button aria-label="Zoom in">＋</button><button aria-label="Zoom out">−</button><button aria-label="Locate selection">⌖</button></div>
          <div className="timebar">
            <button aria-label="Previous time window">◀</button>
            <div><span style={{ width: timeWindow === "12h" ? "42%" : timeWindow === "24h" ? "72%" : "92%" }} /><i style={{ left: timeWindow === "12h" ? "42%" : timeWindow === "24h" ? "72%" : "92%" }} /></div>
            <button aria-label="Next time window">▶</button>
            <select aria-label="Evidence time window" value={timeWindow} onChange={(event) => { setTimeWindow(event.target.value as TimeWindow); log(`You changed the evidence window to ${event.target.value}.`, "human"); }}>
              <option value="12h">Last 12 hours</option><option value="24h">Last 24 hours</option><option value="7d">Last 7 days</option>
            </select>
          </div>
          <div className="legend">{(Object.keys(layerInfo) as LayerId[]).filter((id) => activeLayers.includes(id)).map((id) => <span key={id}><i className={layerInfo[id].color} /> {layerInfo[id].label}</span>)}</div>

          {panel === "uncertainty" && (
            <div className="evidenceCard">
              <button className="close" onClick={() => setPanel(null)} aria-label="Close">×</button>
              <p className="eyebrow">EVIDENCE, NOT A VERDICT</p>
              <strong>{selected ? selected.title : "2 observations need context"}</strong>
              <p>{selected ? layerInfo[selected.layer].limitation : "Satellite detections and station readings describe different kinds of evidence. Proximity does not prove impact."}</p>
              <div className="sourceStrip"><span>{selected ? layerInfo[selected.layer].source : "3 sources"}</span><span>{selected ? layerInfo[selected.layer].freshness : "mixed freshness"}</span></div>
              <button className="textAction" onClick={() => { setPanel("activity"); log("You asked the agent to inspect uncertainty.", "human"); }}>Ask the agent to investigate →</button>
            </div>
          )}
          {panel === "activity" && <SidePanel title="Collaboration trail" eyebrow="HUMAN + AGENT" onClose={() => setPanel(null)}><div className="activityList">{activity.map((item) => <div className={`activity ${item.kind}`} key={item.id}><span>{item.kind === "agent" ? "✦" : "You"}</span><p>{item.text}</p><time>{item.time}</time></div>)}</div></SidePanel>}
          {panel === "about" && <SidePanel title="A map you can question" eyebrow="ABOUT EARTH LENS" onClose={() => setPanel(null)}><p>Earth Lens is a shared spatial evidence workspace. Your agent operates semantic WebMCP tools—not map buttons—while every action remains visible and reversible.</p><p className="fineprint">Prototype data is illustrative and must not be used as an official emergency alert.</p></SidePanel>}
          {panel === "lens" && <SidePanel title="Situation lens ready for review" eyebrow="DRAFT · NOT PUBLISHED" onClose={() => setPanel(null)}><div className="lensSummary"><b>{selection.label}</b><span>Last {timeWindow}</span><span>{activeLayers.length} active sources</span><span>{observations.filter((o) => activeLayers.includes(o.layer)).length} visible observations</span></div><p className="fineprint">The agent prepared this state. Only you can decide whether to share or publish it.</p><button className="primaryButton" onClick={() => log("You reviewed the draft situation lens.", "human")}>Mark as reviewed</button></SidePanel>}
        </div>
      </section>
    </main>
  );
}

function SidePanel({ title, eyebrow, onClose, children }: { title: string; eyebrow: string; onClose: () => void; children: React.ReactNode }) {
  return <aside className="sidePanel"><button className="close" onClick={onClose} aria-label="Close">×</button><p className="eyebrow">{eyebrow}</p><h2>{title}</h2>{children}</aside>;
}
