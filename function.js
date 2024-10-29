export function extractData(eventString) {
  const dataMatch = eventString.match(/data:\s*(.*)/);
  if (dataMatch && dataMatch[1]) {
    try {
      return JSON.parse(dataMatch[1]);
    } catch (error) {
      console.error("Invalid JSON format", error);
      return null;
    }
  }
  return null;
}
