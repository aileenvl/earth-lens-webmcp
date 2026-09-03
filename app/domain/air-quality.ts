export type AqiDescription = { label: string; guidance: string };
export type AqiTone = "good" | "moderate" | "sensitive" | "unhealthy" | "very-unhealthy" | "hazardous";
export type AqiActivityGuidance = { headline: string; general: string; sensitive: string };

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

export function getAqiActivityGuidance(aqi: number): AqiActivityGuidance {
  if (aqi <= 50) return {
    headline: "A good time for outdoor activity",
    general: "Most people can continue their usual outdoor activities.",
    sensitive: "Keep checking conditions if you are unusually sensitive to air pollution.",
  };
  if (aqi <= 100) return {
    headline: "Generally acceptable for outdoor activity",
    general: "Most people can continue their usual outdoor activities.",
    sensitive: "If you are unusually sensitive, consider reducing long or intense outdoor activity if you notice symptoms.",
  };
  if (aqi <= 150) return {
    headline: "Sensitive groups should take extra care",
    general: "Most people can continue outdoor activities while watching for symptoms.",
    sensitive: "Consider shorter or less intense outdoor activity and take more breaks.",
  };
  if (aqi <= 200) return {
    headline: "Reduce prolonged outdoor exertion",
    general: "Consider reducing long or intense outdoor activity.",
    sensitive: "Avoid long or intense outdoor activity and move activities indoors when practical.",
  };
  if (aqi <= 300) return {
    headline: "Avoid prolonged outdoor exertion",
    general: "Avoid long or intense outdoor activity and consider moving activities indoors.",
    sensitive: "Avoid outdoor physical activity and follow official local health guidance.",
  };
  return {
    headline: "Check official guidance before going outside",
    general: "Avoid outdoor physical activity and follow official local guidance.",
    sensitive: "Remain indoors when possible and follow official local health guidance.",
  };
}
