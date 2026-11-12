import { describe, expect, it } from "vitest"

import { classifyActor } from "./classify"

const self = ["nyg"]

describe("classifyActor", () => {
  it.each([
    [{ login: "nyg" }, "you"],
    [{ login: "NYG" }, "you"],
    [{ login: "Copilot" }, "agent"],
    [{ login: "copilot-swe-agent", isBot: true }, "agent"],
    [{ login: "claude[bot]" }, "agent"],
    [{ login: "renovate[bot]" }, "automation"],
    [{ login: "renovate", isBot: true }, "automation"],
    [{ login: null, name: "github-actions[bot]" }, "automation"],
    [{ login: "dependabot" }, "automation"],
    [{ login: "octocat" }, "other"],
    [{ login: null, name: "nyg" }, "other"],
  ] as const)("classifies %o as %s", (input, expected) => {
    // When
    const actor = classifyActor(input, self)

    // Then
    expect(actor).toBe(expected)
  })
})
