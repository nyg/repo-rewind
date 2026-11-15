import type { Actor } from './types'

const AGENT_PATTERN =
   /^(copilot|claude|codex|chatgpt-codex|cursor|devin|google-labs-jules|jules|openhands|sweep|aider|gemini|amazon-q|kiro)/i

const AUTOMATION_PATTERN =
   /^(renovate|dependabot|github-actions|greenkeeper|snyk|mergify|semantic-release|release-please|allcontributors|pre-commit-ci|imgbot|depfu)/i

export interface ActorInput {
   login: string | null
   name?: string | null
   isBot?: boolean
}

export function classifyActor(input: ActorInput, selfLogins: string[]): Actor {
   const identity = input.login ?? input.name ?? ''
   const bare = identity.replace(/\[bot\]$/i, '')

   if (
      input.login &&
      selfLogins.some((self) => self.toLowerCase() === bare.toLowerCase())
   ) {
      return 'you'
   }
   if (AGENT_PATTERN.test(bare)) {
      return 'agent'
   }
   if (
      input.isBot ||
      /\[bot\]$/i.test(identity) ||
      AUTOMATION_PATTERN.test(bare)
   ) {
      return 'automation'
   }
   return 'other'
}
