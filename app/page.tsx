"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ArcgisInvestigationMap } from "./components/ArcgisInvestigationMap.tsx";
import { AirQualityCard } from "./components/AirQualityCard.tsx";
import { AssistantChat, type AssistantActionResult } from "./components/AssistantChat.tsx";
import type { AssistantAction, ChatWorkspace } from "./chat/contract.ts";
import { describeUsAqi, getUsAqiTone } from "./domain/air-quality.ts";
import { filterEvidenceForArea } from "./domain/evidence.ts";
import { analyzeCoverage } from "./domain/review/coverage.ts";
import { createSituationLensDraft, reviewSituationLensDraft, type SituationLensDraft, type SituationLensReview } from "./domain/review/lens.ts";
import { stepTimeWindow as getSteppedTimeWindow } from "./domain/time-window.ts";
import type { EvidenceRecord, InvestigationArea, SourceState, TimeWindow } from "./domain/types.ts";
import { fetchAirQuality } from "./sources/air-quality.ts";
import { fetchEonetEvidence } from "./sources/eonet.ts";
import { resolvePlace } from "./sources/geocoding.ts";
import { fetchUsgsEvidence } from "./sources/usgs.ts";
import { registerWebMcpTools } from "./webmcp/register.ts";
import { createEarthLensTools } from "./webmcp/tools.ts";
import type { LayerId, ModelContextTool } from "./webmcp/types.ts";

type Activity = { id: number; text: string; kind: "agent" | "human"; time: string };

declare global {
  interface Document {
    modelContext?: {
      registerTool: (tool: ModelContextTool, options?: { signal?: AbortSignal }) => Promise<void>;
    };
  }
}

const layerInfo: Record<LayerId, { label: string; source: string; color: string; limitation: string }> = {
  earthquakes: {
    label: "Earthquakes",
    source: "USGS",
    color: "amber",
    limitation: "Magnitude and location may be revised after review.",
  },
  "air-quality": {
    label: "Air quality",
    source: "Open-Meteo + CAMS",
    color: "mint",
    limitation: "Modelled CAMS forecasts are spatial estimates, not local sensor measurements.",
  },
  "natural-events": {
    label: "Natural events",
    source: "NASA EONET",
    color: "coral",
    limitation: "EONET spatial and temporal extents may be approximate and are not official alerts.",
  },
};

const stamp = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const sourceStateLabel = (state: SourceState) => state.status === "ready"
  ? `Updated ${new Date(state.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
  : state.status === "loading" ? "Loading"
    : state.status === "unavailable" ? "Unavailable"
      : state.status === "empty" ? "No records reported"
        : "Not requested";

export default function Home() {
  const [activeLayers, setActiveLayers] = useState<LayerId[]>(["earthquakes", "air-quality", "natural-events"]);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("24h");
  const [selection, setSelection] = useState<InvestigationArea>({
    latitude: 25.6866,
    longitude: -100.3161,
    radiusKm: 100,
    label: "Monterrey",
    updatedBy: "human",
  });
  const [selectedObservation, setSelectedObservation] = useState<string | null>(null);
  const [earthquakes, setEarthquakes] = useState<EvidenceRecord[]>([]);
  const [earthquakeState, setEarthquakeState] = useState<SourceState>({ status: "loading", requestedAt: new Date().toISOString() });
  const [naturalEvents, setNaturalEvents] = useState<EvidenceRecord[]>([]);
  const [naturalEventState, setNaturalEventState] = useState<SourceState>({ status: "loading", requestedAt: new Date().toISOString() });
  const [airQuality, setAirQuality] = useState<EvidenceRecord | null>(null);
  const [airQualityState, setAirQualityState] = useState<SourceState>({ status: "loading", requestedAt: new Date().toISOString() });
  const [panel, setPanel] = useState<"uncertainty" | "activity" | "about" | "lens" | null>("uncertainty");
  const [activity, setActivity] = useState<Activity[]>([]);
  const [lensDraft, setLensDraft] = useState<SituationLensDraft | null>(null);
  const [lensReview, setLensReview] = useState<SituationLensReview | null>(null);
  const [toolsReady, setToolsReady] = useState(false);
  const revisionRef = useRef(0);
  const agentUndoRef = useRef<Array<{ activeLayers: LayerId[]; timeWindow: TimeWindow; selection: InvestigationArea; revision: number }>>([]);
  const earthLensToolsRef = useRef<ModelContextTool[]>([]);
  const selectionLatitude = selection.latitude;
  const selectionLongitude = selection.longitude;
  const areaEarthquakes = filterEvidenceForArea(earthquakes, selection);
  const evidenceResults = areaEarthquakes.length > 0 ? areaEarthquakes : earthquakes.slice(0, 5);
  const selectedEarthquake = earthquakes.find((record) => record.id === selectedObservation);
  const areaNaturalEvents = filterEvidenceForArea(naturalEvents, selection);
  const selectedNaturalEvent = naturalEvents.find((record) => record.id === selectedObservation);
  const mapEarthquakes = selectedEarthquake && !areaEarthquakes.some((record) => record.id === selectedEarthquake.id)
    ? [...areaEarthquakes, selectedEarthquake]
    : areaEarthquakes;
  const mapNaturalEvents = selectedNaturalEvent && !areaNaturalEvents.some((record) => record.id === selectedNaturalEvent.id) ? [...areaNaturalEvents, selectedNaturalEvent] : areaNaturalEvents;
  const stateRef = useRef({ activeLayers, timeWindow, selection, earthquakes, areaEarthquakes, earthquakeState, naturalEvents, areaNaturalEvents, naturalEventState, airQuality, airQualityState });

  useEffect(() => {
    stateRef.current = { activeLayers, timeWindow, selection, earthquakes, areaEarthquakes, earthquakeState, naturalEvents, areaNaturalEvents, naturalEventState, airQuality, airQualityState };
  }, [activeLayers, timeWindow, selection, earthquakes, areaEarthquakes, earthquakeState, naturalEvents, areaNaturalEvents, naturalEventState, airQuality, airQualityState]);

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

  useEffect(() => {
    const controller = new AbortController();
    void fetchAirQuality({ latitude: selectionLatitude, longitude: selectionLongitude }, { signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      if (result.status === "ready") { setAirQuality(result.data); setAirQualityState({ status: "ready", fetchedAt: result.fetchedAt, count: 1 }); }
      else if (result.status === "empty") { setAirQuality(null); setAirQualityState({ status: "empty", fetchedAt: result.fetchedAt, reason: result.reason }); }
      else if (result.code !== "ABORTED") { setAirQuality(null); setAirQualityState({ status: "unavailable", fetchedAt: result.fetchedAt, reason: result.message }); }
    });
    return () => controller.abort();
  }, [selectionLatitude, selectionLongitude]);

  useEffect(() => {
    const controller = new AbortController();
    const days = timeWindow === "24h" ? 1 : timeWindow === "7d" ? 7 : 30;
    void fetchEonetEvidence({ status: "open", days, limit: 200 }, { signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      if (result.status === "ready") {
        setNaturalEvents(result.data);
        setNaturalEventState({ status: "ready", fetchedAt: result.fetchedAt, count: result.data.length });
      } else if (result.status === "empty") {
        setNaturalEvents([]); setNaturalEventState({ status: "empty", fetchedAt: result.fetchedAt, reason: result.reason });
      } else if (result.code !== "ABORTED") {
        setNaturalEvents([]); setNaturalEventState({ status: "unavailable", fetchedAt: result.fetchedAt, reason: result.message });
      }
    });
    return () => controller.abort();
  }, [timeWindow]);

  const changeTimeWindow = useCallback((window: TimeWindow) => {
    setEarthquakeState({ status: "loading", requestedAt: new Date().toISOString() });
    setNaturalEventState({ status: "loading", requestedAt: new Date().toISOString() });
    setTimeWindow(window);
  }, []);

  const log = useCallback((text: string, kind: Activity["kind"] = "agent") => {
    setActivity((items) => [{ id: Date.now() + Math.random(), text, kind, time: stamp() }, ...items].slice(0, 12));
  }, []);

  const chooseTimeWindow = useCallback((window: TimeWindow) => {
    agentUndoRef.current = [];
    revisionRef.current += 1;
    changeTimeWindow(window);
    log(`You changed the evidence window to ${window}.`, "human");
  }, [changeTimeWindow, log]);

  const stepTimeWindow = useCallback((direction: "previous" | "next") => {
    const nextWindow = getSteppedTimeWindow(timeWindow, direction);
    if (nextWindow !== timeWindow) chooseTimeWindow(nextWindow);
  }, [chooseTimeWindow, timeWindow]);

  const toggleLayer = useCallback((layer: LayerId, fromAgent = false) => {
    if (!fromAgent) { agentUndoRef.current = []; revisionRef.current += 1; }
    setActiveLayers((current) => {
      const on = current.includes(layer);
      const next = on ? current.filter((item) => item !== layer) : [...current, layer];
      log(`${fromAgent ? "Agent" : "You"} ${on ? "removed" : "added"} the ${layerInfo[layer].label.toLowerCase()} layer.`, fromAgent ? "agent" : "human");
      return next;
    });
  }, [log]);

  useEffect(() => {
    const rememberAgentChange = () => {
      const current = stateRef.current;
      agentUndoRef.current.push({ activeLayers: [...current.activeLayers], timeWindow: current.timeWindow, selection: structuredClone(current.selection), revision: revisionRef.current });
      revisionRef.current += 1;
    };
    const allEvidence = () => [...stateRef.current.earthquakes, ...stateRef.current.naturalEvents, ...(stateRef.current.airQuality ? [stateRef.current.airQuality] : [])];
    const scopedEvidence = () => [...stateRef.current.areaEarthquakes, ...stateRef.current.areaNaturalEvents, ...(stateRef.current.airQuality ? [stateRef.current.airQuality] : [])];
    const sourceStates = () => ({ usgs: stateRef.current.earthquakeState, eonet: stateRef.current.naturalEventState, "open-meteo": stateRef.current.airQualityState });
    const tools = createEarthLensTools({
      getState: () => ({ activeLayers: stateRef.current.activeLayers, timeWindow: stateRef.current.timeWindow, selection: stateRef.current.selection, evidence: scopedEvidence(), areaEvidence: scopedEvidence(), sourceStates: sourceStates(), revision: revisionRef.current }),
      listSources: () => Object.entries(layerInfo).map(([id, source]) => ({ id, ...source, sourceState: sourceStates()[id === "earthquakes" ? "usgs" : id === "natural-events" ? "eonet" : "open-meteo"] })),
      setLayerVisibility: (layerId, visible) => { rememberAgentChange(); setActiveLayers((current) => visible ? [...new Set([...current, layerId])] : current.filter((item) => item !== layerId)); log(`Agent ${visible ? "showed" : "hid"} the ${layerInfo[layerId].label.toLowerCase()} layer.`); return { layerId, visible, revision: revisionRef.current, reversible: true }; },
      setTimeWindow: (window) => { rememberAgentChange(); changeTimeWindow(window); log(`Agent changed the evidence window to ${window}.`); return { window, revision: revisionRef.current, reversible: true }; },
      setArea: (area) => { rememberAgentChange(); setAirQualityState({ status: "loading", requestedAt: new Date().toISOString() }); setSelection(area); log(`Agent focused the map on “${area.label}”.`); return { area, revision: revisionRef.current, reversible: true }; },
      inspectEvidence: (id) => { const item = allEvidence().find((record) => record.id === id) ?? null; if (item) { setSelectedObservation(item.id); setPanel("uncertainty"); log(`Agent inspected ${item.title} and surfaced its limitation.`); } return item; },
      analyzeCoverage: () => { setPanel("uncertainty"); log("Agent surfaced evidence gaps and modelled coverage."); return { revision: revisionRef.current, coverage: analyzeCoverage(sourceStates(), scopedEvidence()), limitations: stateRef.current.activeLayers.map((id) => ({ layer: id, limitation: layerInfo[id].limitation })), warning: "No displayed observation is an official emergency alert." }; },
      createLensDraft: (title) => { const draft = createSituationLensDraft({ title, area: stateRef.current.selection, timeWindow: stateRef.current.timeWindow, evidence: scopedEvidence(), coverage: analyzeCoverage(sourceStates(), scopedEvidence()), createdAt: new Date().toISOString(), revision: revisionRef.current }); setLensDraft(draft); setLensReview(null); setPanel("lens"); log("Agent prepared a situation lens draft for your review."); return draft; },
      undoLastAgentChange: () => { const snapshot = agentUndoRef.current.pop(); if (!snapshot) return { undone: false, reason: "No reversible agent change is available." }; setActiveLayers(snapshot.activeLayers); changeTimeWindow(snapshot.timeWindow); setSelection(snapshot.selection); revisionRef.current += 1; log("Agent undid its last workspace change."); return { undone: true, revision: revisionRef.current, restoredFromRevision: snapshot.revision }; },
      focusPlace: async (query, radiusKm) => {
        const resolution = await resolvePlace(query, { near: stateRef.current.selection });
        if (resolution.status === "ambiguous") return { ok: false as const, code: "AMBIGUOUS_PLACE", message: "That place name has multiple strong matches. Add a country, state, or neighborhood.", details: { candidates: resolution.candidates } };
        if (resolution.status !== "resolved") return { ok: false as const, code: resolution.status === "not-found" ? "PLACE_NOT_FOUND" : "PLACE_SEARCH_UNAVAILABLE", message: resolution.reason };
        rememberAgentChange();
        const area: InvestigationArea = { latitude: resolution.candidate.latitude, longitude: resolution.candidate.longitude, radiusKm, label: resolution.candidate.label, updatedBy: "agent" };
        setSelectedObservation(null);
        setPanel(null);
        setAirQualityState({ status: "loading", requestedAt: new Date().toISOString() });
        setSelection(area);
        log(`Agent resolved “${query}” with ArcGIS and focused the map on ${area.label}.`);
        const currentAir = await fetchAirQuality({ latitude: area.latitude, longitude: area.longitude });
        if (currentAir.status === "ready") {
          setAirQuality(currentAir.data);
          setAirQualityState({ status: "ready", fetchedAt: currentAir.fetchedAt, count: 1 });
          setSelectedObservation(currentAir.data.id);
          setPanel("uncertainty");
        } else if (currentAir.status === "empty") {
          setAirQuality(null);
          setAirQualityState({ status: "empty", fetchedAt: currentAir.fetchedAt, reason: currentAir.reason });
        } else if (currentAir.code !== "ABORTED") {
          setAirQuality(null);
          setAirQualityState({ status: "unavailable", fetchedAt: currentAir.fetchedAt, reason: currentAir.message });
        }
        return { ok: true as const, data: { area, match: resolution.candidate, airQuality: currentAir.status === "ready" ? currentAir.data : null, airQualityStatus: currentAir.status, revision: revisionRef.current, reversible: true } };
      },
    });
    earthLensToolsRef.current = tools;
    const registration = registerWebMcpTools(document.modelContext, tools);
    void registration.ready.then(setToolsReady).catch(() => setToolsReady(false));
    return registration.cleanup;
  }, [changeTimeWindow, log]);

  const executeAssistantAction = useCallback(async (action: AssistantAction): Promise<AssistantActionResult> => {
    const tool = earthLensToolsRef.current.find((candidate) => candidate.name === action.name);
    if (!tool) return { summary: `Could not run ${action.name}.` };
    const input: Record<string, unknown> = action.name === "set_time_window" ? { window: action.window }
      : action.name === "set_layer_visibility" ? { layerId: action.layerId, visible: action.visible }
      : action.name === "set_geographic_area" ? { latitude: action.latitude, longitude: action.longitude, radiusKm: action.radiusKm, ...(action.label ? { label: action.label } : {}) }
      : action.name === "focus_place" ? { query: action.query, ...(action.radiusKm ? { radiusKm: action.radiusKm } : {}) }
      : action.name === "inspect_observation" ? { observationId: action.observationId }
      : action.name === "create_situation_lens_draft" ? (action.title ? { title: action.title } : {})
      : {};
    const result = await tool.execute(input);
    const envelope = JSON.parse(result.content[0]?.text ?? "{}") as { ok?: boolean; data?: { area?: InvestigationArea; airQuality?: EvidenceRecord | null; airQualityStatus?: string }; error?: { message?: string } };
    if (!envelope.ok) return { summary: envelope.error?.message ?? `Could not run ${action.name}.` };
    if (action.name === "focus_place" && envelope.data?.airQuality) {
      const evidence = envelope.data.airQuality;
      const category = describeUsAqi(Number(evidence.attributes.usAqi));
      return {
        summary: `Focused the map on ${envelope.data.area?.label ?? action.query ?? "the requested place"}, refreshed its evidence, and opened the air-quality record`,
        detail: `${envelope.data.area?.label ?? action.query}: US AQI ${evidence.attributes.usAqi} — ${category.label}. PM2.5 ${evidence.attributes.pm2_5} µg/m³; PM10 ${evidence.attributes.pm10} µg/m³. This is a modelled CAMS estimate, observed ${new Date(evidence.observedAt).toLocaleString()}.`,
      };
    }
    if (action.name === "focus_place" && envelope.data?.airQualityStatus) {
      return { summary: `Focused the map on ${envelope.data.area?.label ?? action.query ?? "the requested place"}`, detail: "The air-quality source could not return a current estimate for this location. The map moved, but Earth Lens will not invent a value." };
    }
    const summaries: Record<AssistantAction["name"], string> = {
      get_workspace_state: "Read the current workspace",
      list_authoritative_sources: "Checked source provenance",
      set_layer_visibility: `Updated the ${action.layerId ?? "requested"} layer`,
      set_time_window: `Changed the time range to ${action.window ?? "the requested window"}`,
      set_geographic_area: `Updated the investigation area${action.label ? ` to ${action.label}` : ""}`,
      query_selected_area: "Queried the selected area",
      inspect_observation: "Opened the evidence record and its source details",
      analyze_evidence_coverage: "Opened evidence coverage and limitations",
      create_situation_lens_draft: "Created a situation lens draft for review",
      undo_last_agent_change: "Undid the latest safe agent change",
      focus_place: `Focused the map on ${action.query ?? "the requested place"} and refreshed its evidence`,
    };
    return { summary: summaries[action.name] };
  }, []);

  const selected = [...earthquakes, ...naturalEvents, ...(airQuality ? [airQuality] : [])].find((item) => item.id === selectedObservation);
  const selectedAqi = selected?.evidenceType === "air-quality" ? Number(selected.attributes.usAqi) : null;
  const selectedAqiDescription = selectedAqi === null ? null : describeUsAqi(selectedAqi);
  const airQualityDescription = airQuality ? describeUsAqi(Number(airQuality.attributes.usAqi)) : null;

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><span className="brandMark">E</span><span>Earth Lens</span></div>
        <button className="status" title={toolsReady ? undefined : "Waiting for WebMCP browser compatibility"} onClick={() => setPanel("activity")}><span className={`pulse ${toolsReady ? "" : "waiting"}`} /> {toolsReady ? "Agent-ready · 11 tools exposed" : "WebMCP tools require a supported browser"}</button>
        <button className="quietButton" onClick={() => setPanel("about")}>About this map</button>
      </header>

      <section className="workspace">
        <aside className="rail">
          <p className="eyebrow">INVESTIGATION 01</p>
          <h1>What’s happening around {selection.label}?</h1>
          <p className="lede">A shared evidence workspace for you and your agent.</p>

          <AssistantChat
            workspace={{
              activeLayers,
              timeWindow,
              selection: { latitude: selection.latitude, longitude: selection.longitude, radiusKm: selection.radiusKm, label: selection.label },
              sourceStates: { usgs: { status: earthquakeState.status }, eonet: { status: naturalEventState.status }, "open-meteo": { status: airQualityState.status } },
              evidence: [...areaEarthquakes, ...areaNaturalEvents, ...(airQuality ? [airQuality] : [])].map((item) => ({
                id: item.id, title: item.title, provider: item.provider, observedAt: item.observedAt, limitation: item.limitation,
                facts: item.evidenceType === "air-quality" ? [
                  `US AQI ${item.attributes.usAqi} (${describeUsAqi(Number(item.attributes.usAqi)).label})`,
                  `PM2.5 ${item.attributes.pm2_5} ${item.attributes.pm2_5Unit}`,
                  `PM10 ${item.attributes.pm10} ${item.attributes.pm10Unit}`,
                  "Current CAMS model estimate at the selected map center; the event history window does not apply.",
                ] : [],
              })),
            } satisfies ChatWorkspace}
            onAction={executeAssistantAction}
          />

          <div className="sectionHead"><span>LIVE SIGNALS</span><span>{activeLayers.length}/3</span></div>
          <div className="signalList">
            {(Object.keys(layerInfo) as LayerId[]).map((id) => {
              const info = layerInfo[id];
              const sourceState = id === "earthquakes" ? earthquakeState : id === "natural-events" ? naturalEventState : airQualityState;
              const earthquakeSummary = earthquakeState.status === "ready"
                ? `${areaEarthquakes.length} in selected area`
                : earthquakeState.status === "loading" ? "Loading live feed…" : earthquakeState.status === "unavailable" ? "Source unavailable" : "No events reported";
              const naturalEventSummary = naturalEventState.status === "ready"
                ? `${areaNaturalEvents.length} in selected area`
                : naturalEventState.status === "loading" ? "Loading live feed…" : naturalEventState.status === "unavailable" ? "Source unavailable" : "No events reported";
              const airQualitySummary = airQualityState.status === "ready" && airQuality
                ? `AQI ${airQuality.attributes.usAqi} · ${airQualityDescription?.label}`
                : airQualityState.status === "loading" ? "Loading model…" : "Model unavailable";
              const on = activeLayers.includes(id);
              return (
                <button className={`signal ${on ? "active" : ""}`} key={id} onClick={() => toggleLayer(id)}>
                  <span className={`signalDot ${info.color}`} />
                  <span><small>{info.label}</small><strong>{id === "earthquakes" ? earthquakeSummary : id === "natural-events" ? naturalEventSummary : airQualitySummary}</strong><em>{info.source} · {sourceStateLabel(sourceState)}</em></span>
                  <b>{on ? "✓" : "+"}</b>
                </button>
              );
            })}
          </div>

          <div className="earthquakeResults airQualityResult" aria-live="polite">
            <div className="sectionHead"><span>CURRENT AIR QUALITY</span><span>OPEN-METEO · CAMS</span></div>
            {airQualityState.status === "loading" && <p>Loading modelled conditions…</p>}
            {airQualityState.status === "unavailable" && <p role="alert">Air quality unavailable: {airQualityState.reason}</p>}
            {airQuality && <AirQualityCard evidence={airQuality} selected={selectedObservation === airQuality.id} onInspect={() => { setSelectedObservation(airQuality.id); setPanel("uncertainty"); }} />}
          </div>

          <div className="earthquakeResults naturalEventResults" aria-live="polite">
            <div className="sectionHead"><span>NASA EONET IN AREA</span><span>{areaNaturalEvents.length}</span></div>
            {naturalEventState.status === "loading" && <p>Loading NASA EONET events…</p>}
            {naturalEventState.status === "unavailable" && <p role="alert">NASA EONET is temporarily unavailable: {naturalEventState.reason}</p>}
            {naturalEventState.status === "ready" && areaNaturalEvents.length === 0 && <p>No supported point events intersect this area.</p>}
            {(areaNaturalEvents.length > 0 ? areaNaturalEvents : naturalEvents.slice(0, 3)).slice(0, 3).map((record) => (
              <button key={record.id} className={`evidenceResult ${selectedObservation === record.id ? "selected" : ""}`} onClick={() => { setSelectedObservation(record.id); setPanel("uncertainty"); }}>
                <strong>{record.title}</strong><span>{String(record.attributes.category)} · {new Date(record.observedAt).toLocaleDateString()}</span>
              </button>
            ))}
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
            evidence={[
              ...(activeLayers.includes("earthquakes") ? mapEarthquakes : []),
              ...(activeLayers.includes("natural-events") ? mapNaturalEvents : []),
              ...(activeLayers.includes("air-quality") && airQuality ? [airQuality] : []),
            ]}
            selectedEvidenceId={selectedObservation}
            onEvidenceSelect={(id) => { setSelectedObservation(id); setPanel("uncertainty"); }}
            onAreaChange={(nextArea) => { agentUndoRef.current = []; revisionRef.current += 1; setAirQualityState({ status: "loading", requestedAt: new Date().toISOString() }); setSelection(nextArea); log("You revised the investigation area.", "human"); }}
          />
          <p className="timeWindowFeedback" role="status" aria-live="polite">
            {earthquakeState.status === "loading" || naturalEventState.status === "loading"
              ? `Updating earthquakes and natural events for ${timeWindow === "24h" ? "the last 24 hours" : timeWindow === "7d" ? "the last 7 days" : "the last 30 days"}. Air quality stays current.`
              : `${timeWindow === "24h" ? "Last 24 hours" : timeWindow === "7d" ? "Last 7 days" : "Last 30 days"} applied · ${areaEarthquakes.length + areaNaturalEvents.length} mapped events. Air quality stays current.`}
          </p>
          <div className="timebar" role="group" aria-label="Choose evidence time window" title="Choose event history window; air quality remains current.">
            <button aria-label="Previous time window" disabled={timeWindow === "24h"} onClick={() => stepTimeWindow("previous")}>◀</button>
            <label htmlFor="evidence-time-window" title="Applies to earthquake and natural-event feeds; air quality remains current.">Event history</label>
            <select id="evidence-time-window" value={timeWindow} onChange={(event) => chooseTimeWindow(event.target.value as TimeWindow)}>
              <option value="24h">Last 24 hours</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option>
            </select>
            <button aria-label="Next time window" disabled={timeWindow === "30d"} onClick={() => stepTimeWindow("next")}>▶</button>
          </div>
          <div className="legend">{(Object.keys(layerInfo) as LayerId[]).filter((id) => activeLayers.includes(id)).map((id) => <span key={id}><i className={layerInfo[id].color} /> {layerInfo[id].label}</span>)}</div>

          {panel === "uncertainty" && (
            <div className="evidenceCard">
              <button className="close" onClick={() => setPanel(null)} aria-label="Close">×</button>
              <p className="eyebrow">EVIDENCE, NOT A VERDICT</p>
              <strong>{selected ? selected.title : "Evidence needs context"}</strong>
              <p>{selected ? selected.limitation : "Select a live USGS event from the map or evidence list to inspect its provenance and limitations."}</p>
              {selected?.evidenceType === "air-quality" && selectedAqi !== null && selectedAqiDescription && <><div className={`selectedAqiSummary aqi-${getUsAqiTone(selectedAqi)}`} aria-label={`US AQI ${selectedAqi}, ${selectedAqiDescription.label}`}><strong>{selectedAqi}</strong><span><b>{selectedAqiDescription.label}</b><small>US AQI</small></span></div><dl className="selectedAirFacts"><div><dt>PM₂.₅</dt><dd>{String(selected.attributes.pm2_5)} {String(selected.attributes.pm2_5Unit)}</dd></div><div><dt>PM₁₀</dt><dd>{String(selected.attributes.pm10)} {String(selected.attributes.pm10Unit)}</dd></div><div><dt>Coverage</dt><dd>Current model estimate at map center</dd></div></dl></>}
              <div className="sourceStrip"><span>{selected ? selected.provider === "usgs" ? "USGS" : selected.provider === "eonet" ? "NASA EONET + origin" : "Open-Meteo + CAMS" : "Public sources"}</span><span>{selected ? new Date(selected.observedAt).toLocaleString() : "live when available"}</span></div>
              {selected && <a className="sourceLink" href={selected.sourceUrl} target="_blank" rel="noreferrer">Open originating source record ↗</a>}
              <button className="textAction" onClick={() => { setPanel("activity"); log("You asked the agent to inspect uncertainty.", "human"); }}>Ask the agent to investigate →</button>
            </div>
          )}
          {panel === "activity" && <SidePanel title="Collaboration trail" eyebrow="HUMAN + AGENT" onClose={() => setPanel(null)}>{activity.length === 0 ? <p className="fineprint">No collaboration actions yet. Human and agent changes will appear here when they happen.</p> : <div className="activityList">{activity.map((item) => <div className={`activity ${item.kind}`} key={item.id}><span>{item.kind === "agent" ? "✦" : "You"}</span><p>{item.text}</p><time>{item.time}</time></div>)}</div>}</SidePanel>}
          {panel === "about" && <SidePanel title="A map you can question" eyebrow="ABOUT EARTH LENS" onClose={() => setPanel(null)}><p>Earth Lens is a shared spatial evidence workspace. Your agent operates semantic WebMCP tools—not map buttons—while every action remains visible and reversible.</p><p className="fineprint">All three signals use live public data from USGS, NASA EONET, and Open-Meteo/CAMS. Earth Lens is not an official emergency alert.</p></SidePanel>}
          {panel === "lens" && lensDraft && <SidePanel title="Situation lens ready for review" eyebrow="DRAFT · NOT PUBLISHED" onClose={() => setPanel(null)}><div className="lensSummary"><b>{lensDraft.area.label}</b><span>Last {lensDraft.timeWindow}</span><span>{lensDraft.citations.length} cited sources</span><span>{lensDraft.summary}</span></div><p className="fineprint">Review acknowledges this draft revision; it does not publish, send, or change its draft status.</p>{lensReview ? <p role="status"><strong>Reviewed by you</strong><br /><span className="fineprint">{new Date(lensReview.reviewedAt).toLocaleString()} · draft revision {lensReview.draftRevision}</span></p> : <button className="primaryButton" onClick={() => { const review = reviewSituationLensDraft(lensDraft, new Date().toISOString()); setLensReview(review); log(`You reviewed draft revision ${review.draftRevision}.`, "human"); }}>Mark as reviewed</button>}</SidePanel>}
        </div>
      </section>
    </main>
  );
}

function SidePanel({ title, eyebrow, onClose, children }: { title: string; eyebrow: string; onClose: () => void; children: React.ReactNode }) {
  return <aside className="sidePanel"><button className="close" onClick={onClose} aria-label="Close">×</button><p className="eyebrow">{eyebrow}</p><h2>{title}</h2>{children}</aside>;
}
