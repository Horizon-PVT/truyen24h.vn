type FirestoreValue = {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  timestampValue?: string;
  arrayValue?: { values?: FirestoreValue[] };
  mapValue?: { fields?: Record<string, FirestoreValue> };
  nullValue?: null;
};

type FirestoreDocument = {
  name: string;
  fields?: Record<string, FirestoreValue>;
};

function envConfig() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!projectId || !apiKey) return null;
  return { projectId, apiKey };
}

function decodeValue(value: FirestoreValue): unknown {
  if ('stringValue' in value) return value.stringValue || '';
  if ('integerValue' in value) return Number(value.integerValue || 0);
  if ('doubleValue' in value) return value.doubleValue || 0;
  if ('booleanValue' in value) return !!value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue || '';
  if ('arrayValue' in value) return (value.arrayValue?.values || []).map(decodeValue);
  if ('mapValue' in value) return decodeFields(value.mapValue?.fields || {});
  return null;
}

function decodeFields(fields: Record<string, FirestoreValue>) {
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    data[key] = decodeValue(value);
  }
  return data;
}

function decodeDocument(doc: FirestoreDocument) {
  const id = doc.name.split('/').pop() || '';
  return { id, ...decodeFields(doc.fields || {}) };
}

async function fetchFirestoreJson(url: string) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) return null;
  return response.json();
}

export async function fetchFirestoreRestDocument(path: string) {
  const config = envConfig();
  if (!config) return null;

  const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/${path}?key=${config.apiKey}`;
  const json = await fetchFirestoreJson(url) as FirestoreDocument | null;
  return json ? decodeDocument(json) : null;
}

export async function fetchFirestoreRestCollection(path: string) {
  const config = envConfig();
  if (!config) return [];

  const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/${path}?key=${config.apiKey}`;
  const json = await fetchFirestoreJson(url) as { documents?: FirestoreDocument[] } | null;
  return (json?.documents || []).map(decodeDocument);
}
