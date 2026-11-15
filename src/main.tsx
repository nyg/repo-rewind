import './index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { ThemeProvider } from '@/components/theme-provider.tsx'
import { countPageView } from '@/lib/hits.ts'

import App from './App.tsx'

countPageView(import.meta.env)

createRoot(document.getElementById('root')!).render(
   <StrictMode>
      <ThemeProvider>
         <App />
      </ThemeProvider>
   </StrictMode>
)
