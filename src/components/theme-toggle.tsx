import { MoonIcon, SunIcon } from 'lucide-react'

import { useTheme } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
   const { setTheme } = useTheme()

   function toggle() {
      const isDark = document.documentElement.classList.contains('dark')
      setTheme(isDark ? 'light' : 'dark')
   }

   return (
      <Button
         variant="ghost"
         size="icon"
         onClick={toggle}
         aria-label="Switch between light and dark theme"
      >
         <SunIcon className="hidden dark:block" />
         <MoonIcon className="dark:hidden" />
      </Button>
   )
}
