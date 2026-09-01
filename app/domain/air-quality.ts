export type AqiDescription = { label: string; guidance: string };
export type AqiTone = "good" | "moderate" | "sensitive" | "unhealthy" | "very-unhealthy" | "hazardous";

export function describeUsAqi(aqi: number): AqiDescription {
  if (aqi <= 50) return { label: "Good", guidance: "Air pollution is low for most people." };
  if (aqi <= 100) return { label: "Moderate", guidance: "Some unusually sensitive people may be affected." };
  if (aqi <= 150) return { label: "Unhealthy for sensitive groups", guidance: "Sensitive groups may experience health effects." };
  if (aqi <= 200) return { label: "Unhealthy", guidance: "Some members of the general public may experience health effects." };
  if (aqi <= 300) return { label: "Very unhealthy", guidance: "The risk of health effects is increased for everyone." };
  return { label: "Hazardous", guidance: "Health effects may affect everyone; check official local guidance." };
}

export function getUsAqiTone(aqi: number): AqiTone {
  if (aqi <= 50) return "good";
  if (aqi <= 100) return "moderate";
  if (aqi <= 150) return "sensitive";
  if (aqi <= 200) return "unhealthy";
  if (aqi <= 300) return "very-unhealthy";
  return "hazardous";
}
