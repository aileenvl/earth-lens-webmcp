"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ArcgisInvestigationMap } from "./components/ArcgisInvestigationMap.tsx";
import { AirQualityCard } from "./components/AirQualityCard.tsx";
import { AssistantChat, type AssistantActionResult } from "./components/AssistantChat.tsx";
import { OutdoorConditionsCard } from "./components/OutdoorConditionsCard.tsx";
import type { AssistantAction, ChatWorkspace } from "./chat/contract.ts";
import { describeUsAqi, getAqiActivityGuidance, getUsAqiTone } from "./domain/air-quality.ts";
import { filterEvidenceForArea } from "./domain/evidence.ts";
import { describeEventWindowStatus } from "./domain/event-window-summary.ts";
import { deriveOutdoorConditions } from "./domain/outdoor-conditions.ts";
import { analyzeCoverage } from "./domain/review/coverage.ts";
import { createSituationLensDraft, reviewSituationLensDraft, type SituationLensDraft, type SituationLensReview } from "./domain/review/lens.ts";
import { stepTimeWindow as getSteppedTimeWindow } from "./domain/time-window.ts";
import type { EvidenceRecord, InvestigationArea, SourceState, TimeWindow } from "./domain/types.ts";
import { fetchAirQuality } from "./sources/air-quality.ts";
import { fetchEonetEvidence } from "./sources/eonet.ts";
import { resolvePlace } from "./sources/geocoding.ts";
import { fetchNasaFirmsEvidence } from "./sources/nasa-firms.ts";
import { fetchSmnForecast } from "./sources/smn.ts";
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

const layerInfo: Record<LayerId, { label: string; source: string; provider: "usgs" | "eonet" | "open-meteo" | "nasa-firms" | "smn"; color: string; limitation: string }> = {
  earthquakes: {
    label: "Earthquakes",
    source: "USGS",
    provider: "usgs",
    color: "amber",
    limitation: "Magnitude and location may be revised after review.",
  },
  "air-quality": {
    label: "Air quality",
    source: "Open-Meteo + CAMS",
    provider: "open-meteo",
    color: "mint",
    limitation: "Modelled CAMS forecasts are spatial estimates, not local sensor measurements.",
  },
  "natural-events": {
    label: "Natural events",
    source: "NASA EONET",
    provider: "eonet",
    color: "coral",
    limitation: "EONET spatial and temporal extents may be approximate and are not official alerts.",
  },
  "thermal-hotspots": {
    label: "Thermal hotspots",
    source: "NASA FIRMS · VIIRS",
    provider: "nasa-firms",
    color: "hotspot",
    limitation: "Satellite heat detections are not confirmed wildfires, perimeters, causes, or safety verdicts and may include false positives.",
  },
  "weather-forecast": {
    label: "Outdoor weather",
    source: "SMN · CONAGUA",
    provider: "smn",
    color: "weather",
    limitation: "Official municipal forecast, not a station observation, emergency alert, or guarantee.",
  },
};

const stamp = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const sourceStateLabel = (state: SourceState) => state.status === "ready"
  ? `Updated ${new Date(state.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
  : state.status === "loading" ? "Loading"
    : state.status === "unavailable" ? "Unavailable"
      : state.status === "empty" ? "No records reported"
        : "Not requested";

function describeThermalRefresh(status: string | undefined, records: EvidenceRecord[] | undefined, window: TimeWindow): string {
  const supportedWindow = window === "24h" ? "the last 24 hours" : "the latest 7 days";
  if (status === "ready") {
    return `NASA VIIRS returned ${records?.length ?? 0} satellite thermal ${records?.length === 1 ? "detection" : "detections"} within the area for ${supportedWindow}. These are heat anomalies, not confirmed wildfires or safety verdicts.`;
  }
  if (status === "empty") return `NASA VIIRS returned no matching thermal detections for ${supportedWindow}. This is not an all-clear.`;
  return "The NASA VIIRS thermal-detection source is currently unavailable, so Earth Lens will not infer that no hotspot exists.";
}

function describeWeatherRefresh(status: string | undefined, records: EvidenceRecord[] | undefined): string {
  const current = records?.find((record) => record.attributes.forecastDay === 0) ?? records?.[0];
  if (status === "ready" && current) {
    return `SMN forecasts ${current.attributes.minimumTemperatureC}–${current.attributes.maximumTemperatureC} °C for ${current.attributes.municipalityName}, with ${current.attributes.precipitationProbabilityPercent}% rain chance and gusts up to ${current.attributes.gustSpeedKmh} km/h. This is an official municipal forecast, not a station observation or safety verdict.`;
  }
  if (status === "empty") return "SMN municipal forecast coverage was not available for this selection; official SMN coverage is limited to Mexico.";
  return "The official SMN municipal forecast is currently unavailable.";
}

export default function Home() {
  const [activeLayers, setActiveLayers] = useState<LayerId[]>(["earthquakes", "air-quality", "natural-events", "thermal-hotspots", "weather-forecast"]);
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
  const [thermalHotspots, setThermalHotspots] = useState<EvidenceRecord[]>([]);
  const [thermalHotspotState, setThermalHotspotState] = useState<SourceState>({ status: "loading", requestedAt: new Date().toISOString() });
  const [weatherForecasts, setWeatherForecasts] = useState<EvidenceRecord[]>([]);
  const [weatherState, setWeatherState] = useState<SourceState>({ status: "loading", requestedAt: new Date().toISOString() });
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
  const areaAirQuality = airQuality && filterEvidenceForArea([airQuality], selection).length === 1 ? airQuality : null;
  const evidenceResults = areaEarthquakes.length > 0 ? areaEarthquakes : earthquakes.slice(0, 5);
  const selectedEarthquake = earthquakes.find((record) => record.id === selectedObservation);
  const areaNaturalEvents = filterEvidenceForArea(naturalEvents, selection);
  const areaThermalHotspots = filterEvidenceForArea(thermalHotspots, selection);
  const currentWeather = weatherForecasts.find((record) => record.attributes.forecastDay === 0) ?? weatherForecasts[0] ?? null;
  const selectedNaturalEvent = naturalEvents.find((record) => record.id === selectedObservation);
  const selectedThermalHotspot = thermalHotspots.find((record) => record.id === selectedObservation);
  const mapEarthquakes = selectedEarthquake && !areaEarthquakes.some((record) => record.id === selectedEarthquake.id)
    ? [...areaEarthquakes, selectedEarthquake]
    : areaEarthquakes;
  const mapNaturalEvents = selectedNaturalEvent && !areaNaturalEvents.some((record) => record.id === selectedNaturalEvent.id) ? [...areaNaturalEvents, selectedNaturalEvent] : areaNaturalEvents;
  const mapThermalHotspots = selectedThermalHotspot && !areaThermalHotspots.some((record) => record.id === selectedThermalHotspot.id) ? [...areaThermalHotspots, selectedThermalHotspot] : areaThermalHotspots;
  const stateRef = useRef({ activeLayers, timeWindow, selection, earthquakes, areaEarthquakes, earthquakeState, naturalEvents, areaNaturalEvents, naturalEventState, airQuality: areaAirQuality, airQualityState, thermalHotspots, areaThermalHotspots, thermalHotspotState, weatherForecasts, weatherState });

  useEffect(() => {
    stateRef.current = { activeLayers, timeWindow, selection, earthquakes, areaEarthquakes, earthquakeState, naturalEvents, areaNaturalEvents, naturalEventState, airQuality: areaAirQuality, airQualityState, thermalHotspots, areaThermalHotspots, thermalHotspotState, weatherForecasts, weatherState };
  }, [activeLayers, timeWindow, selection, earthquakes, areaEarthquakes, earthquakeState, naturalEvents, areaNaturalEvents, naturalEventState, areaAirQuality, airQualityState, thermalHotspots, areaThermalHotspots, thermalHotspotState, weatherForecasts, weatherState]);

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
    void fetchNasaFirmsEvidence(selection, timeWindow, { signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      if (result.status === "ready") {
        setThermalHotspots(result.data);
        setThermalHotspotState({ status: "ready", fetchedAt: result.fetchedAt, count: result.data.length });
      } else if (result.status === "empty") {
        setThermalHotspots([]);
        setThermalHotspotState({ status: "empty", fetchedAt: result.fetchedAt, reason: result.reason });
      } else if (result.code !== "ABORTED") {
        setThermalHotspots([]);
        setThermalHotspotState({ status: "unavailable", fetchedAt: result.fetchedAt, reason: result.message });
      }
    });
    return () => controller.abort();
  }, [selection, timeWindow]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchAirQuality({ latitude: selectionLatitude, longitude: selectionLongitude }, { signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      if (result.status === "ready") { setAirQuality(result.data); setAirQualityState({ status: "ready", fetchedAt: result.fetchedAt, count: 1 }); setSelectedObservation((current) => current ?? result.data.id); }
      else if (result.status === "empty") { setAirQuality(null); setAirQualityState({ status: "empty", fetchedAt: result.fetchedAt, reason: result.reason }); }
      else if (result.code !== "ABORTED") { setAirQuality(null); setAirQualityState({ status: "unavailable", fetchedAt: result.fetchedAt, reason: result.message }); }
    });
    return () => controller.abort();
  }, [selectionLatitude, selectionLongitude]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchSmnForecast({ latitude: selectionLatitude, longitude: selectionLongitude }, { signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      if (result.status === "ready") {
        setWeatherForecasts(result.data);
        setWeatherState({ status: "ready", fetchedAt: result.fetchedAt, count: result.data.length });
      } else if (result.status === "empty") {
        setWeatherForecasts([]);
        setWeatherState({ status: "empty", fetchedAt: result.fetchedAt, reason: result.reason });
      } else if (result.code !== "ABORTED") {
        setWeatherForecasts([]);
        setWeatherState({ status: "unavailable", fetchedAt: result.fetchedAt, reason: result.message });
      }
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
    setThermalHotspotState({ status: "loading", requestedAt: new Date().toISOString() });
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
    const allEvidence = () => [...stateRef.current.earthquakes, ...stateRef.current.naturalEvents, ...stateRef.current.thermalHotspots, ...stateRef.current.weatherForecasts, ...(stateRef.current.airQuality ? [stateRef.current.airQuality] : [])];
    const scopedEvidence = () => [...stateRef.current.areaEarthquakes, ...stateRef.current.areaNaturalEvents, ...stateRef.current.areaThermalHotspots, ...stateRef.current.weatherForecasts, ...(stateRef.current.airQuality ? [stateRef.current.airQuality] : [])];
    const sourceStates = () => ({ usgs: stateRef.current.earthquakeState, eonet: stateRef.current.naturalEventState, "open-meteo": stateRef.current.airQualityState, "nasa-firms": stateRef.current.thermalHotspotState, smn: stateRef.current.weatherState });
    const tools = createEarthLensTools({
      getState: () => ({ activeLayers: stateRef.current.activeLayers, timeWindow: stateRef.current.timeWindow, selection: stateRef.current.selection, evidence: scopedEvidence(), areaEvidence: scopedEvidence(), sourceStates: sourceStates(), revision: revisionRef.current }),
      listSources: () => Object.entries(layerInfo).map(([id, source]) => ({ id, ...source, sourceState: sourceStates()[source.provider] })),
      setLayerVisibility: (layerId, visible) => { rememberAgentChange(); setActiveLayers((current) => visible ? [...new Set([...current, layerId])] : current.filter((item) => item !== layerId)); log(`Agent ${visible ? "showed" : "hid"} the ${layerInfo[layerId].label.toLowerCase()} layer.`); return { layerId, visible, revision: revisionRef.current, reversible: true }; },
      setTimeWindow: (window) => { rememberAgentChange(); changeTimeWindow(window); log(`Agent changed the evidence window to ${window}.`); return { window, revision: revisionRef.current, reversible: true }; },
      setArea: (area) => { rememberAgentChange(); setSelectedObservation(null); setAirQuality(null); setAirQualityState({ status: "loading", requestedAt: new Date().toISOString() }); setThermalHotspots([]); setThermalHotspotState({ status: "loading", requestedAt: new Date().toISOString() }); setWeatherForecasts([]); setWeatherState({ status: "loading", requestedAt: new Date().toISOString() }); setSelection(area); log(`Agent focused the map on “${area.label}”.`); return { area, revision: revisionRef.current, reversible: true }; },
      inspectEvidence: (id) => { const item = allEvidence().find((record) => record.id === id) ?? null; if (item) { setSelectedObservation(item.id); setPanel("uncertainty"); log(`Agent inspected ${item.title} and surfaced its limitation.`); } return item; },
      analyzeCoverage: () => { setPanel("uncertainty"); log("Agent surfaced evidence gaps and modelled coverage."); return { revision: revisionRef.current, coverage: analyzeCoverage(sourceStates(), scopedEvidence()), limitations: stateRef.current.activeLayers.map((id) => ({ layer: id, limitation: layerInfo[id].limitation })), warning: "No displayed observation is an official emergency alert." }; },
      createLensDraft: (title) => { const draft = createSituationLensDraft({ title, area: stateRef.current.selection, timeWindow: stateRef.current.timeWindow, evidence: scopedEvidence(), coverage: analyzeCoverage(sourceStates(), scopedEvidence()), createdAt: new Date().toISOString(), revision: revisionRef.current }); setLensDraft(draft); setLensReview(null); setPanel("lens"); log("Agent prepared a situation lens draft for your review."); return draft; },
      undoLastAgentChange: () => { const snapshot = agentUndoRef.current.pop(); if (!snapshot) return { undone: false, reason: "No reversible agent change is available." }; setActiveLayers(snapshot.activeLayers); changeTimeWindow(snapshot.timeWindow); setSelectedObservation(null); setAirQuality(null); setAirQualityState({ status: "loading", requestedAt: new Date().toISOString() }); setThermalHotspots([]); setThermalHotspotState({ status: "loading", requestedAt: new Date().toISOString() }); setWeatherForecasts([]); setWeatherState({ status: "loading", requestedAt: new Date().toISOString() }); setSelection(snapshot.selection); revisionRef.current += 1; log("Agent undid its last workspace change."); return { undone: true, revision: revisionRef.current, restoredFromRevision: snapshot.revision }; },
      focusPlace: async (query, radiusKm) => {
        const resolution = await resolvePlace(query, { near: stateRef.current.selection });
        if (resolution.status === "ambiguous") return { ok: false as const, code: "AMBIGUOUS_PLACE", message: "That place name has multiple strong matches. Add a country, state, or neighborhood.", details: { candidates: resolution.candidates } };
        if (resolution.status !== "resolved") return { ok: false as const, code: resolution.status === "not-found" ? "PLACE_NOT_FOUND" : "PLACE_SEARCH_UNAVAILABLE", message: resolution.reason };
        rememberAgentChange();
        const focusRevision = revisionRef.current;
        const area: InvestigationArea = { latitude: resolution.candidate.latitude, longitude: resolution.candidate.longitude, radiusKm, label: resolution.candidate.label, updatedBy: "agent" };
        setSelectedObservation(null);
        setPanel(null);
        setAirQuality(null);
        setAirQualityState({ status: "loading", requestedAt: new Date().toISOString() });
        setThermalHotspots([]);
        setThermalHotspotState({ status: "loading", requestedAt: new Date().toISOString() });
        setWeatherForecasts([]);
        setWeatherState({ status: "loading", requestedAt: new Date().toISOString() });
        setSelection(area);
        log(`Agent resolved “${query}” with ArcGIS and focused the map on ${area.label}.`);
        const [currentAir, currentThermalHotspots, currentWeather] = await Promise.all([
          fetchAirQuality({ latitude: area.latitude, longitude: area.longitude }),
          fetchNasaFirmsEvidence(area, stateRef.current.timeWindow),
          fetchSmnForecast({ latitude: area.latitude, longitude: area.longitude }),
        ]);
        if (revisionRef.current !== focusRevision) {
          return { ok: true as const, data: { area, match: resolution.candidate, superseded: true, revision: revisionRef.current, reversible: false } };
        }
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
        if (currentThermalHotspots.status === "ready") {
          setThermalHotspots(currentThermalHotspots.data);
          setThermalHotspotState({ status: "ready", fetchedAt: currentThermalHotspots.fetchedAt, count: currentThermalHotspots.data.length });
          if (currentAir.status !== "ready" && currentThermalHotspots.data[0]) {
            setSelectedObservation(currentThermalHotspots.data[0].id);
            setPanel("uncertainty");
          }
        } else if (currentThermalHotspots.status === "empty") {
          setThermalHotspots([]);
          setThermalHotspotState({ status: "empty", fetchedAt: currentThermalHotspots.fetchedAt, reason: currentThermalHotspots.reason });
        } else if (currentThermalHotspots.code !== "ABORTED") {
          setThermalHotspots([]);
          setThermalHotspotState({ status: "unavailable", fetchedAt: currentThermalHotspots.fetchedAt, reason: currentThermalHotspots.message });
        }
        if (currentWeather.status === "ready") {
          setWeatherForecasts(currentWeather.data);
          setWeatherState({ status: "ready", fetchedAt: currentWeather.fetchedAt, count: currentWeather.data.length });
        } else if (currentWeather.status === "empty") {
          setWeatherForecasts([]);
          setWeatherState({ status: "empty", fetchedAt: currentWeather.fetchedAt, reason: currentWeather.reason });
        } else if (currentWeather.code !== "ABORTED") {
          setWeatherForecasts([]);
          setWeatherState({ status: "unavailable", fetchedAt: currentWeather.fetchedAt, reason: currentWeather.message });
        }
        return { ok: true as const, data: { area, match: resolution.candidate, airQuality: currentAir.status === "ready" ? currentAir.data : null, airQualityStatus: currentAir.status, thermalHotspots: currentThermalHotspots.status === "ready" ? currentThermalHotspots.data : [], thermalHotspotStatus: currentThermalHotspots.status, weatherForecasts: currentWeather.status === "ready" ? currentWeather.data : [], weatherStatus: currentWeather.status, revision: revisionRef.current, reversible: true } };
      },
    });
    earthLensToolsRef.current = tools;
    const registration = registerWebMcpTools(document.modelContext, tools);
    void registration.ready.then(setToolsReady).catch(() => setToolsReady(false));
    return registration.cleanup;
  }, [changeTimeWindow, log]);

  const executeAssistantAction = useCallback(async (action: AssistantAction): Promise<AssistantActionResult> => {
    const tool = earthLensToolsRef.current.find((candidate) => candidate.name === action.name);
    if (!tool) return { ok: false, summary: `Could not run ${action.name}.` };
    const input: Record<string, unknown> = action.name === "set_time_window" ? { window: action.window }
      : action.name === "set_layer_visibility" ? { layerId: action.layerId, visible: action.visible }
      : action.name === "set_geographic_area" ? { latitude: action.latitude, longitude: action.longitude, radiusKm: action.radiusKm, ...(action.label ? { label: action.label } : {}) }
      : action.name === "focus_place" ? { query: action.query, ...(action.radiusKm ? { radiusKm: action.radiusKm } : {}) }
      : action.name === "inspect_observation" ? { observationId: action.observationId }
      : action.name === "create_situation_lens_draft" ? (action.title ? { title: action.title } : {})
      : {};
    const result = await tool.execute(input);
    const envelope = JSON.parse(result.content[0]?.text ?? "{}") as { ok?: boolean; data?: { area?: InvestigationArea; airQuality?: EvidenceRecord | null; airQualityStatus?: string; thermalHotspots?: EvidenceRecord[]; thermalHotspotStatus?: string; weatherForecasts?: EvidenceRecord[]; weatherStatus?: string; superseded?: boolean }; error?: { message?: string } };
    if (!envelope.ok) return { ok: false, summary: envelope.error?.message ?? `Could not run ${action.name}.` };
    if (action.name === "focus_place" && envelope.data?.superseded) {
      return { ok: true, summary: "Skipped stale place results after a newer map change", detail: "The map changed again before those sources finished. Earth Lens kept the newer human-selected area and did not overwrite it." };
    }
    if (action.name === "focus_place" && envelope.data?.airQuality) {
      const evidence = envelope.data.airQuality;
      const category = describeUsAqi(Number(evidence.attributes.usAqi));
      const activity = getAqiActivityGuidance(Number(evidence.attributes.usAqi));
      return {
        ok: true,
        summary: `Focused the map on ${envelope.data.area?.label ?? action.query ?? "the requested place"} and refreshed air, weather, and satellite evidence`,
        detail: `${envelope.data.area?.label ?? action.query}: US AQI ${evidence.attributes.usAqi} — ${category.label}. ${activity.headline}. ${activity.general}${evidence.attributes.dominantPollutant ? ` Likely AQI driver: ${evidence.attributes.dominantPollutant}.` : ""} PM2.5 ${evidence.attributes.pm2_5} µg/m³; PM10 ${evidence.attributes.pm10} µg/m³. This is a modelled CAMS estimate, observed ${new Date(evidence.observedAt).toLocaleString()}; check official local monitoring before making health or safety decisions. ${describeWeatherRefresh(envelope.data.weatherStatus, envelope.data.weatherForecasts)} ${describeThermalRefresh(envelope.data.thermalHotspotStatus, envelope.data.thermalHotspots, stateRef.current.timeWindow)}`,
      };
    }
    if (action.name === "focus_place" && envelope.data?.weatherStatus) {
      return {
        ok: true,
        summary: `Focused the map on ${envelope.data.area?.label ?? action.query ?? "the requested place"} and refreshed official weather and satellite evidence`,
        detail: `${describeWeatherRefresh(envelope.data.weatherStatus, envelope.data.weatherForecasts)} ${describeThermalRefresh(envelope.data.thermalHotspotStatus, envelope.data.thermalHotspots, stateRef.current.timeWindow)}`,
      };
    }
    if (action.name === "focus_place" && envelope.data?.thermalHotspotStatus) {
      return { ok: true, summary: `Focused the map on ${envelope.data.area?.label ?? action.query ?? "the requested place"} and refreshed satellite evidence`, detail: describeThermalRefresh(envelope.data.thermalHotspotStatus, envelope.data.thermalHotspots, stateRef.current.timeWindow) };
    }
    if (action.name === "focus_place" && envelope.data?.airQualityStatus) {
      return { ok: true, summary: `Focused the map on ${envelope.data.area?.label ?? action.query ?? "the requested place"}`, detail: "The air-quality source could not return a current estimate for this location. The map moved, but Earth Lens will not invent a value." };
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
    return { ok: true, summary: summaries[action.name] };
  }, []);

  const selected = [...earthquakes, ...naturalEvents, ...thermalHotspots, ...weatherForecasts, ...(areaAirQuality ? [areaAirQuality] : [])].find((item) => item.id === selectedObservation);
  const selectedAqi = selected?.evidenceType === "air-quality" ? Number(selected.attributes.usAqi) : null;
  const selectedAqiDescription = selectedAqi === null ? null : describeUsAqi(selectedAqi);
  const airQualityDescription = areaAirQuality ? describeUsAqi(Number(areaAirQuality.attributes.usAqi)) : null;
  const outdoorConditions = deriveOutdoorConditions({ airQuality: areaAirQuality, weatherForecasts, airQualityState, weatherState });

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
              sourceStates: { usgs: { status: earthquakeState.status }, eonet: { status: naturalEventState.status }, "open-meteo": { status: airQualityState.status }, "nasa-firms": { status: thermalHotspotState.status }, smn: { status: weatherState.status } },
              evidence: [...areaEarthquakes, ...areaNaturalEvents, ...areaThermalHotspots, ...weatherForecasts, ...(areaAirQuality ? [areaAirQuality] : [])].map((item) => ({
                id: item.id, title: item.title, provider: item.provider, observedAt: item.observedAt, limitation: item.limitation,
                facts: item.evidenceType === "air-quality" ? [
                  `US AQI ${item.attributes.usAqi} (${describeUsAqi(Number(item.attributes.usAqi)).label})`,
                  `PM2.5 ${item.attributes.pm2_5} ${item.attributes.pm2_5Unit}`,
                  `PM10 ${item.attributes.pm10} ${item.attributes.pm10Unit}`,
                  `Outdoor planning cue: ${getAqiActivityGuidance(Number(item.attributes.usAqi)).headline}. ${getAqiActivityGuidance(Number(item.attributes.usAqi)).general}`,
                  ...(item.attributes.dominantPollutant ? [`Likely AQI driver: ${item.attributes.dominantPollutant} (component AQI ${item.attributes.dominantPollutantAqi})`] : []),
                  "Current CAMS model estimate at the selected map center; the event history window does not apply.",
                ] : item.evidenceType === "weather-forecast" ? [
                  `Official SMN forecast for ${item.attributes.municipalityName}`,
                  `Temperature ${item.attributes.minimumTemperatureC}–${item.attributes.maximumTemperatureC} °C`,
                  `Rain chance ${item.attributes.precipitationProbabilityPercent}% and ${item.attributes.precipitationMm} mm`,
                  `Wind ${item.attributes.windSpeedKmh} km/h; gusts ${item.attributes.gustSpeedKmh} km/h`,
                  `Sky: ${item.attributes.sky}`,
                  "Municipal forecast; not a station observation, official alert, or safety verdict.",
                ] : item.evidenceType === "thermal-hotspot" ? [
                  `Confidence ${item.attributes.confidence}`,
                  `Satellite ${item.attributes.satellite}`,
                  `Fire radiative power ${item.attributes.frpMw} MW`,
                  `Detected during ${item.attributes.dayNight}`,
                  `Approximate pixel ${item.attributes.pixelScanKm} × ${item.attributes.pixelTrackKm} km`,
                  `Near-real-time version ${item.attributes.version}; ${item.attributes.hoursOld} hours old at source refresh`,
                  "Satellite thermal anomaly; not a confirmed wildfire, perimeter, cause, or safety verdict.",
                ] : [],
              })),
            } satisfies ChatWorkspace}
            onAction={executeAssistantAction}
          />

          <div className="sectionHead"><span>LIVE SIGNALS</span><span>{activeLayers.length}/5</span></div>
          <div className="signalList">
            {(Object.keys(layerInfo) as LayerId[]).map((id) => {
              const info = layerInfo[id];
              const sourceState = id === "earthquakes" ? earthquakeState : id === "natural-events" ? naturalEventState : id === "thermal-hotspots" ? thermalHotspotState : id === "weather-forecast" ? weatherState : airQualityState;
              const earthquakeSummary = earthquakeState.status === "ready"
                ? `${areaEarthquakes.length} in selected area`
                : earthquakeState.status === "loading" ? "Loading live feed…" : earthquakeState.status === "unavailable" ? "Source unavailable" : "No events reported";
              const naturalEventSummary = naturalEventState.status === "ready"
                ? `${areaNaturalEvents.length} in selected area`
                : naturalEventState.status === "loading" ? "Loading live feed…" : naturalEventState.status === "unavailable" ? "Source unavailable" : "No events reported";
              const airQualitySummary = airQualityState.status === "ready" && areaAirQuality
                ? `AQI ${areaAirQuality.attributes.usAqi} · ${airQualityDescription?.label}`
                : airQualityState.status === "loading" ? "Loading model…" : "Model unavailable";
              const thermalHotspotSummary = thermalHotspotState.status === "ready"
                ? `${areaThermalHotspots.length} satellite detections`
                : thermalHotspotState.status === "loading" ? "Loading satellite feed…" : thermalHotspotState.status === "unavailable" ? "Source unavailable" : "No detections reported";
              const weatherSummary = weatherState.status === "ready" && currentWeather
                ? `${currentWeather.attributes.minimumTemperatureC}–${currentWeather.attributes.maximumTemperatureC} °C · ${currentWeather.attributes.municipalityName}`
                : weatherState.status === "loading" ? "Loading official forecast…" : weatherState.status === "empty" ? "Outside SMN coverage" : "Source unavailable";
              const on = activeLayers.includes(id);
              return (
                <button className={`signal ${on ? "active" : ""}`} key={id} onClick={() => toggleLayer(id)}>
                  <span className={`signalDot ${info.color}`} />
                  <span><small>{info.label}</small><strong>{id === "earthquakes" ? earthquakeSummary : id === "natural-events" ? naturalEventSummary : id === "thermal-hotspots" ? thermalHotspotSummary : id === "weather-forecast" ? weatherSummary : airQualitySummary}</strong><em>{info.source} · {sourceStateLabel(sourceState)}</em></span>
                  <b>{on ? "✓" : "+"}</b>
                </button>
              );
            })}
          </div>

          <div className="earthquakeResults airQualityResult" aria-live="polite">
            <div className="sectionHead"><span>OUTDOOR CONDITIONS</span><span>SMN + CAMS</span></div>
            <OutdoorConditionsCard conditions={outdoorConditions} weather={currentWeather} weatherState={weatherState} onInspectWeather={() => { if (currentWeather) { setSelectedObservation(currentWeather.id); setPanel("uncertainty"); } }} />
            {airQualityState.status === "loading" && <p>Loading modelled conditions…</p>}
            {airQualityState.status === "unavailable" && <p role="alert">Air quality unavailable: {airQualityState.reason}</p>}
            {areaAirQuality && <AirQualityCard evidence={areaAirQuality} selected={selectedObservation === areaAirQuality.id} onInspect={() => { setSelectedObservation(areaAirQuality.id); setPanel("uncertainty"); }} />}
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

          <div className="earthquakeResults thermalHotspotResults" aria-live="polite">
            <div className="sectionHead"><span>NASA VIIRS HOTSPOTS IN AREA</span><span>{areaThermalHotspots.length}</span></div>
            {thermalHotspotState.status === "loading" && <p>Checking NASA satellite thermal detections…</p>}
            {thermalHotspotState.status === "unavailable" && <p role="alert">NASA FIRMS is temporarily unavailable: {thermalHotspotState.reason}</p>}
            {thermalHotspotState.status === "empty" && <p>{thermalHotspotState.reason}</p>}
            {thermalHotspotState.status === "ready" && areaThermalHotspots.length === 0 && <p>No matching thermal detections were returned. This is not an all-clear.</p>}
            {timeWindow === "30d" && <p>VIIRS coverage is limited to the latest 7 days.</p>}
            {areaThermalHotspots.slice(0, 5).map((record) => (
              <button key={record.id} className={`evidenceResult ${selectedObservation === record.id ? "selected" : ""}`} onClick={() => { setSelectedObservation(record.id); setPanel("uncertainty"); }}>
                <strong>{record.title}</strong>
                <span>{String(record.attributes.satellite)} · {String(record.attributes.frpMw)} MW · {new Date(record.observedAt).toLocaleString()}</span>
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
          aria-label={`Environmental evidence map centered on ${selection.label}`}
          role="region"
        >
          <ArcgisInvestigationMap
            area={selection}
            evidence={[
              ...(activeLayers.includes("earthquakes") ? mapEarthquakes : []),
              ...(activeLayers.includes("natural-events") ? mapNaturalEvents : []),
              ...(activeLayers.includes("thermal-hotspots") ? mapThermalHotspots : []),
              ...(activeLayers.includes("air-quality") && areaAirQuality ? [areaAirQuality] : []),
              ...(activeLayers.includes("weather-forecast") && currentWeather ? [currentWeather] : []),
            ]}
            selectedEvidenceId={selectedObservation}
            onEvidenceSelect={(id) => { setSelectedObservation(id); setPanel("uncertainty"); }}
            onAreaChange={(nextArea) => { agentUndoRef.current = []; revisionRef.current += 1; setSelectedObservation(null); setAirQuality(null); setAirQualityState({ status: "loading", requestedAt: new Date().toISOString() }); setThermalHotspots([]); setThermalHotspotState({ status: "loading", requestedAt: new Date().toISOString() }); setWeatherForecasts([]); setWeatherState({ status: "loading", requestedAt: new Date().toISOString() }); setSelection(nextArea); log("You revised the investigation area.", "human"); }}
          />
          <p className={`timeWindowFeedback ${areaEarthquakes.length + areaNaturalEvents.length + areaThermalHotspots.length === 0 ? "empty" : ""}`} role="status" aria-live="polite" title="Updating earthquakes, natural events, and thermal hotspots changes the event history. Air quality stays current.">
            {describeEventWindowStatus({
              window: timeWindow,
              place: selection.label,
              radiusKm: selection.radiusKm,
              count: areaEarthquakes.length + areaNaturalEvents.length + areaThermalHotspots.length,
              loading: earthquakeState.status === "loading" || naturalEventState.status === "loading" || thermalHotspotState.status === "loading",
              unavailable: earthquakeState.status === "unavailable" || naturalEventState.status === "unavailable" || thermalHotspotState.status === "unavailable",
            })}
          </p>
          <div className="timebar" role="group" aria-label="Choose evidence time window" title="Choose event history window; air quality remains current.">
            <button aria-label="Previous time window" disabled={timeWindow === "24h"} onClick={() => stepTimeWindow("previous")}>◀</button>
            <label htmlFor="evidence-time-window" title="Applies to earthquake, natural-event, and thermal-hotspot feeds; VIIRS retains 7 days and air quality remains current.">Event history</label>
            <select id="evidence-time-window" aria-label="Event history time window" value={timeWindow} onChange={(event) => chooseTimeWindow(event.target.value as TimeWindow)}>
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
              <p>{selected ? selected.limitation : "Select a live evidence record from the map or list to inspect its provenance and limitations."}</p>
              {selected?.evidenceType === "air-quality" && selectedAqi !== null && selectedAqiDescription && <><div className={`selectedAqiSummary aqi-${getUsAqiTone(selectedAqi)}`} aria-label={`US AQI ${selectedAqi}, ${selectedAqiDescription.label}`}><strong>{selectedAqi}</strong><span><b>{selectedAqiDescription.label}</b><small>US AQI</small></span></div><div className={`selectedGuidance aqi-${getUsAqiTone(selectedAqi)}`}><span>What this means outside</span><strong>{getAqiActivityGuidance(selectedAqi).headline}</strong><p>{getAqiActivityGuidance(selectedAqi).general}</p><small>Sensitive people: {getAqiActivityGuidance(selectedAqi).sensitive}</small></div><dl className="selectedAirFacts"><div><dt>Likely driver</dt><dd>{String(selected.attributes.dominantPollutant ?? "Not available")}</dd></div><div><dt>PM₂.₅</dt><dd>{String(selected.attributes.pm2_5)} {String(selected.attributes.pm2_5Unit)}</dd></div><div><dt>PM₁₀</dt><dd>{String(selected.attributes.pm10)} {String(selected.attributes.pm10Unit)}</dd></div><div><dt>Ozone</dt><dd>{selected.attributes.ozone === undefined ? "Not available" : `${String(selected.attributes.ozone)} ${String(selected.attributes.ozoneUnit)}`}</dd></div><div><dt>Nitrogen dioxide</dt><dd>{selected.attributes.nitrogenDioxide === undefined ? "Not available" : `${String(selected.attributes.nitrogenDioxide)} ${String(selected.attributes.nitrogenDioxideUnit)}`}</dd></div><div><dt>Coverage</dt><dd>Current model estimate at map center</dd></div></dl><p className="modelCaution">Planning cue, not a safety verdict. Check official local monitoring before making health or safety decisions. <a href="https://www.airnow.gov/aqi/aqi-basics/" target="_blank" rel="noreferrer">How EPA AQI categories work ↗</a></p></>}
              {selected?.evidenceType === "weather-forecast" && <><div className="weatherMeaning"><span>Official municipal forecast</span><strong>{String(selected.attributes.minimumTemperatureC)}–{String(selected.attributes.maximumTemperatureC)} °C</strong><p>{String(selected.attributes.municipalityName)} · {String(selected.attributes.sky)}</p></div><dl className="selectedAirFacts"><div><dt>Rain chance</dt><dd>{String(selected.attributes.precipitationProbabilityPercent)}%</dd></div><div><dt>Rain amount</dt><dd>{String(selected.attributes.precipitationMm)} mm</dd></div><div><dt>Wind</dt><dd>{String(selected.attributes.windSpeedKmh)} km/h</dd></div><div><dt>Gusts</dt><dd>{String(selected.attributes.gustSpeedKmh)} km/h</dd></div><div><dt>Forecast day</dt><dd>{String(selected.attributes.forecastDay)}</dd></div><div><dt>Distance</dt><dd>{String(selected.attributes.distanceFromSelectionKm)} km from map center</dd></div></dl><p className="modelCaution">SMN municipal forecast, not a station observation, guarantee, or emergency alert. <a href="https://smn.conagua.gob.mx/es/web-service-api" target="_blank" rel="noreferrer">About the official SMN feed ↗</a></p></>}
              {selected?.evidenceType === "thermal-hotspot" && <><div className="thermalMeaning"><span>How to read this</span><strong>Satellite detected unusual heat</strong><p>Use this as a lead to investigate, not proof of a wildfire. Check nearby official civil-protection and fire information before acting.</p></div><dl className="selectedAirFacts"><div><dt>Confidence</dt><dd>{String(selected.attributes.confidence)}</dd></div><div><dt>Satellite</dt><dd>{String(selected.attributes.satellite)}</dd></div><div><dt>Radiative power</dt><dd>{String(selected.attributes.frpMw)} MW</dd></div><div><dt>Pass</dt><dd>{String(selected.attributes.dayNight)}</dd></div><div><dt>Approx. pixel</dt><dd>{String(selected.attributes.pixelScanKm)} × {String(selected.attributes.pixelTrackKm)} km</dd></div><div><dt>Feed age</dt><dd>{String(selected.attributes.hoursOld)} hours</dd></div></dl><p className="modelCaution">Near-real-time satellite evidence can be delayed, incomplete, or false positive. A 30-day selection still shows only the feed’s latest 7 days. <a href="https://www.earthdata.nasa.gov/data/tools/firms" target="_blank" rel="noreferrer">Learn about NASA FIRMS ↗</a></p></>}
              <div className="sourceStrip"><span>{selected ? selected.provider === "usgs" ? "USGS" : selected.provider === "eonet" ? "NASA EONET + origin" : selected.provider === "nasa-firms" ? "NASA FIRMS · VIIRS" : selected.provider === "smn" ? "SMN · CONAGUA" : "Open-Meteo + CAMS" : "Public sources"}</span><span>{selected ? new Date(selected.observedAt).toLocaleString() : "live when available"}</span></div>
              {selected && <a className="sourceLink" href={selected.sourceUrl} target="_blank" rel="noreferrer">Open originating source record ↗</a>}
              <button className="textAction" onClick={() => { setPanel("activity"); log("You asked the agent to inspect uncertainty.", "human"); }}>Ask the agent to investigate →</button>
            </div>
          )}
          {panel === "activity" && <SidePanel title="Collaboration trail" eyebrow="HUMAN + AGENT" onClose={() => setPanel(null)}>{activity.length === 0 ? <p className="fineprint">No collaboration actions yet. Human and agent changes will appear here when they happen.</p> : <div className="activityList">{activity.map((item) => <div className={`activity ${item.kind}`} key={item.id}><span>{item.kind === "agent" ? "✦" : "You"}</span><p>{item.text}</p><time>{item.time}</time></div>)}</div>}</SidePanel>}
          {panel === "about" && <SidePanel title="A map you can question" eyebrow="ABOUT EARTH LENS" onClose={() => setPanel(null)}><p>Earth Lens is a shared spatial evidence workspace. Your agent operates semantic WebMCP tools—not map buttons—while every action remains visible and reversible.</p><p className="fineprint">Five signals use live public data from USGS, NASA EONET, NASA LANCE/FIRMS VIIRS, Open-Meteo/CAMS, and Mexico’s SMN/CONAGUA forecast feed. Thermal hotspots are satellite detections, not confirmed wildfires. Earth Lens is not an official emergency alert.</p></SidePanel>}
          {panel === "lens" && lensDraft && <SidePanel title="Situation lens ready for review" eyebrow="DRAFT · NOT PUBLISHED" onClose={() => setPanel(null)}><div className="lensSummary"><b>{lensDraft.area.label}</b><span>Last {lensDraft.timeWindow}</span><span>{lensDraft.citations.length} cited sources</span><span>{lensDraft.summary}</span></div><p className="fineprint">Review acknowledges this draft revision; it does not publish, send, or change its draft status.</p>{lensReview ? <p role="status"><strong>Reviewed by you</strong><br /><span className="fineprint">{new Date(lensReview.reviewedAt).toLocaleString()} · draft revision {lensReview.draftRevision}</span></p> : <button className="primaryButton" onClick={() => { const review = reviewSituationLensDraft(lensDraft, new Date().toISOString()); setLensReview(review); log(`You reviewed draft revision ${review.draftRevision}.`, "human"); }}>Mark as reviewed</button>}</SidePanel>}
        </div>
      </section>
    </main>
  );
}

function SidePanel({ title, eyebrow, onClose, children }: { title: string; eyebrow: string; onClose: () => void; children: React.ReactNode }) {
  return <aside className="sidePanel"><button className="close" onClick={onClose} aria-label="Close">×</button><p className="eyebrow">{eyebrow}</p><h2>{title}</h2>{children}</aside>;
}
