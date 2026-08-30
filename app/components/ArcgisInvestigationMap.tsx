"use client";

import { createElement, useEffect, useRef, useState } from "react";

import type { InvestigationArea } from "../domain/types.ts";
import { validateInvestigationArea } from "../domain/validation.ts";

interface ArcgisMapElement extends HTMLElement {
  view?: {
    graphics: {
      add: (graphic: unknown) => void;
      remove: (graphic: unknown) => void;
    };
    goTo: (target: unknown, options?: { animate?: boolean }) => Promise<void>;
    on: (eventName: "click", listener: (event: { mapPoint?: { latitude?: number; longitude?: number } }) => void) => { remove: () => void };
  };
}

interface ArcgisInvestigationMapProps {
  area: InvestigationArea;
  onAreaChange: (area: InvestigationArea) => void;
}

type MapStatus = "loading" | "ready" | "unavailable";
type ArcgisConstructor = new (properties: Record<string, unknown>) => unknown;

declare global {
  var $arcgis: { import: (modules: string[]) => Promise<ArcgisConstructor[]> } | undefined;
}

let arcgisLoader: Promise<void> | null = null;

function loadArcgisSdk(): Promise<void> {
  if (globalThis.$arcgis && customElements.get("arcgis-map")) return Promise.resolve();
  if (arcgisLoader) return arcgisLoader;
  arcgisLoader = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-earth-lens-arcgis]");
    const script = existing ?? document.createElement("script");
    const timeout = globalThis.setTimeout(() => reject(new Error("ArcGIS SDK load timed out.")), 15_000);
    const onReady = () => {
      globalThis.clearTimeout(timeout);
      resolve();
    };
    const onError = () => {
      globalThis.clearTimeout(timeout);
      reject(new Error("ArcGIS SDK failed to load."));
    };
    script.addEventListener("load", onReady, { once: true });
    script.addEventListener("error", onError, { once: true });
    if (!existing) {
      script.type = "module";
      script.src = "https://js.arcgis.com/5.1/";
      script.dataset.earthLensArcgis = "true";
      document.head.append(script);
    }
  });
  return arcgisLoader;
}

export function ArcgisInvestigationMap({ area, onAreaChange }: ArcgisInvestigationMapProps) {
  const [status, setStatus] = useState<MapStatus>("loading");
  const [formError, setFormError] = useState<string | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const areaRef = useRef(area);
  const onAreaChangeRef = useRef(onAreaChange);
  const drawSelectionRef = useRef<((nextArea: InvestigationArea) => void) | null>(null);

  useEffect(() => {
    onAreaChangeRef.current = onAreaChange;
  }, [onAreaChange]);

  useEffect(() => {
    areaRef.current = area;
    drawSelectionRef.current?.(area);
  }, [area]);

  useEffect(() => {
    let disposed = false;
    let clickHandle: { remove: () => void } | undefined;
    let selectionGraphic: unknown;
    const mapElement = containerRef.current?.querySelector<ArcgisMapElement>("arcgis-map");
    if (!mapElement) return;

    const initialize = async () => {
      try {
        await loadArcgisSdk();
        const [Graphic, Circle] = await globalThis.$arcgis!.import([
          "@arcgis/core/Graphic.js",
          "@arcgis/core/geometry/Circle.js",
        ]);
        await customElements.whenDefined("arcgis-map");
        if (disposed) return;

        const connectView = () => {
          const view = mapElement.view;
          if (!view || disposed) return false;
          drawSelectionRef.current = (nextArea) => {
            if (selectionGraphic) view.graphics.remove(selectionGraphic);
            const geometry = new Circle({
              center: [nextArea.longitude, nextArea.latitude],
              geodesic: true,
              radius: nextArea.radiusKm,
              radiusUnit: "kilometers",
            });
            selectionGraphic = new Graphic({
              geometry,
              symbol: {
                type: "simple-fill",
                color: [36, 145, 106, 0.16],
                outline: { color: [24, 101, 76, 0.95], width: 2 },
              },
            });
            view.graphics.add(selectionGraphic);
          };
          drawSelectionRef.current(areaRef.current);
          clickHandle = view.on("click", ({ mapPoint }) => {
            if (typeof mapPoint?.latitude !== "number" || typeof mapPoint.longitude !== "number") return;
            onAreaChangeRef.current({
              ...areaRef.current,
              latitude: mapPoint.latitude,
              longitude: mapPoint.longitude,
              label: "Map-selected area",
              updatedBy: "human",
            });
          });
          setStatus("ready");
          return true;
        };

        if (!connectView()) {
          const onReady = () => connectView();
          mapElement.addEventListener("arcgisViewReadyChange", onReady, { once: true });
        }
      } catch {
        if (!disposed) setStatus("unavailable");
      }
    };

    void initialize();
    return () => {
      disposed = true;
      clickHandle?.remove();
      if (selectionGraphic && mapElement.view) mapElement.view.graphics.remove(selectionGraphic);
      drawSelectionRef.current = null;
    };
  }, []);

  const submitArea = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextArea: InvestigationArea = {
      latitude: Number(form.get("latitude")),
      longitude: Number(form.get("longitude")),
      radiusKm: Number(form.get("radiusKm")),
      label: area.label,
      updatedBy: "human",
    };
    const validated = validateInvestigationArea(nextArea);
    if (!validated.ok) {
      setFormError(validated.error.message);
      return;
    }
    setFormError(null);
    onAreaChange(validated.value);
    const mapElement = containerRef.current?.querySelector<ArcgisMapElement>("arcgis-map");
    void mapElement?.view?.goTo({
      center: [validated.value.longitude, validated.value.latitude],
      zoom: 7,
    }, { animate: true });
  };

  return (
    <section ref={containerRef} className="arcgisExperience" aria-label="Environmental evidence map">
      {createElement(
        "arcgis-map",
        {
          className: "arcgisCanvas",
          basemap: "osm",
          center: `${area.longitude},${area.latitude}`,
          zoom: "7",
        },
        createElement("arcgis-zoom", { slot: "top-left" }),
      )}

      <p className={`mapStatus ${status}`} aria-live="polite">
        {status === "ready" && "ArcGIS map ready · OpenStreetMap basemap"}
        {status === "loading" && "Loading ArcGIS map…"}
        {status === "unavailable" && "Map unavailable. The investigation controls remain usable below."}
      </p>

      <form key={`${area.latitude}:${area.longitude}:${area.radiusKm}`} className="areaEditor" aria-label="Edit investigation area" onSubmit={submitArea}>
        <strong>{area.label}</strong>
        <label>Latitude<input name="latitude" inputMode="decimal" defaultValue={area.latitude} /></label>
        <label>Longitude<input name="longitude" inputMode="decimal" defaultValue={area.longitude} /></label>
        <label>Radius (km)<input name="radiusKm" inputMode="decimal" defaultValue={area.radiusKm} /></label>
        <button type="submit">Apply area</button>
        {formError && <span className="areaError" role="alert">{formError}</span>}
      </form>
    </section>
  );
}
