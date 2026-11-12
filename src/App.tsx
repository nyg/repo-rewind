import { useCallback, useState } from "react"

import type { ConnectionInput } from "@/components/connect-form"
import { Dashboard } from "@/components/dashboard"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Welcome } from "@/components/welcome"
import { useSettings } from "@/hooks/use-settings"
import { clearDatasets } from "@/lib/storage"

export function App() {
  const [settings, updateSettings] = useSettings()
  const [now] = useState(() => Date.now())
  const connected = settings.token !== "" || settings.login !== ""

  const connect = useCallback(
    (connection: ConnectionInput) => updateSettings(connection),
    [updateSettings]
  )
  const disconnect = useCallback(() => {
    clearDatasets()
    updateSettings({ token: "", login: "" })
  }, [updateSettings])

  return (
    <TooltipProvider>
      {connected ? (
        <Dashboard
          key={`${settings.token}|${settings.login.toLowerCase()}`}
          settings={settings}
          now={now}
          onSettingsChange={updateSettings}
          onDisconnect={disconnect}
        />
      ) : (
        <Welcome onConnect={connect} />
      )}
    </TooltipProvider>
  )
}

export default App
