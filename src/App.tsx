import { useCallback, useState } from 'react'

import type { ConnectionInput } from '@/components/connect-form'
import { Dashboard } from '@/components/dashboard'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Welcome } from '@/components/welcome'
import { useSettings } from '@/hooks/use-settings'
import { useSignIn } from '@/hooks/use-sign-in'
import { clearDatasets } from '@/lib/storage'

export function App() {
   const [settings, updateSettings] = useSettings()
   const [now] = useState(() => Date.now())
   const connected = settings.token !== '' || settings.login !== ''
   const signIn = useSignIn(settings, (access) => {
      clearDatasets()
      updateSettings(access)
   })

   const connect = useCallback(
      (connection: ConnectionInput) => updateSettings(connection),
      [updateSettings]
   )
   const disconnect = useCallback(() => {
      clearDatasets()
      updateSettings({ token: '', privateAccess: false, login: '' })
   }, [updateSettings])

   return (
      <TooltipProvider>
         {connected ? (
            <Dashboard
               key={`${settings.token}|${settings.login.toLowerCase()}`}
               settings={settings}
               now={now}
               signIn={signIn}
               onSettingsChange={updateSettings}
               onDisconnect={disconnect}
            />
         ) : (
            <Welcome signIn={signIn} onConnect={connect} />
         )}
      </TooltipProvider>
   )
}

export default App
