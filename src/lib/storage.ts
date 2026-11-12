import { HALF_LIVES, type HalfLife } from "./activity"
import { DATASET_VERSION } from "./github/graphql"
import { ACTORS, type Actor, type Dataset } from "./github/types"

const SETTINGS_KEY = "repo-activity:settings"
const DATASET_PREFIX = "repo-activity:dataset:"

export interface Settings {
  token: string
  login: string
  halfLife: HalfLife
  actors: Actor[]
}

export const DEFAULT_SETTINGS: Settings = {
  token: "",
  login: "",
  halfLife: 14,
  actors: ["you", "agent"],
}

export function readSettings(): Settings {
  const stored = readJson<Partial<Settings>>(SETTINGS_KEY) ?? {}
  const actors = Array.isArray(stored.actors)
    ? stored.actors.filter((actor) => ACTORS.includes(actor))
    : []
  return {
    token: typeof stored.token === "string" ? stored.token : "",
    login: typeof stored.login === "string" ? stored.login : "",
    halfLife: HALF_LIVES.includes(stored.halfLife as HalfLife)
      ? (stored.halfLife as HalfLife)
      : DEFAULT_SETTINGS.halfLife,
    actors: actors.length > 0 ? actors : DEFAULT_SETTINGS.actors,
  }
}

export function writeSettings(settings: Settings) {
  writeJson(SETTINGS_KEY, settings)
}

export function readDataset(login: string): Dataset | null {
  const dataset = readJson<Dataset>(datasetKey(login))
  return dataset?.version === DATASET_VERSION ? dataset : null
}

export function writeDataset(dataset: Dataset) {
  writeJson(datasetKey(dataset.owner.login), dataset)
}

export function clearDatasets() {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(DATASET_PREFIX))
      .forEach((key) => localStorage.removeItem(key))
  } catch {
    return
  }
}

function datasetKey(login: string) {
  return `${DATASET_PREFIX}${login.toLowerCase()}`
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    return
  }
}
