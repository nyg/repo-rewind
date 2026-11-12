import { useCallback, useEffect, useState } from "react"

import { readSettings, writeSettings, type Settings } from "@/lib/storage"

function initialSettings(): Settings {
  const stored = readSettings()
  const requested = new URLSearchParams(window.location.search).get("user")
  return requested ? { ...stored, login: requested.trim() } : stored
}

export function useSettings() {
  const [settings, setSettings] = useState(initialSettings)

  useEffect(() => {
    writeSettings(settings)
  }, [settings])

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => ({ ...current, ...patch }))
  }, [])

  return [settings, update] as const
}
