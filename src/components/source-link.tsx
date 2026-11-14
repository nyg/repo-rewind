import { GitHubMark } from "@/components/github-mark"
import { Button } from "@/components/ui/button"

const SOURCE_URL = "https://github.com/nyg/repo-rewind"
const LABEL = "Source code on GitHub"

export function SourceLink() {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="rounded-full text-muted-foreground"
      asChild
    >
      <a
        href={SOURCE_URL}
        target="_blank"
        rel="noreferrer"
        aria-label={LABEL}
        title={LABEL}
      >
        <GitHubMark />
      </a>
    </Button>
  )
}
