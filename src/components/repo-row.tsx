import {
   ArchiveIcon,
   ArrowDownIcon,
   ArrowUpIcon,
   ExternalLinkIcon,
   GitForkIcon,
   LockIcon,
} from 'lucide-react'
import { motion } from 'motion/react'

import { RepoLanes } from '@/components/repo-lanes'
import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from '@/components/ui/tooltip'
import type { RankedRepo } from '@/lib/activity'
import {
   formatAdded,
   formatNumber,
   formatRemoved,
   formatScore,
} from '@/lib/format'
import type { Repo } from '@/lib/github/types'
import type { WeekLabel } from '@/lib/weeks'

export const ROW_GRID =
   'grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 lg:grid-cols-[2.25rem_minmax(0,15rem)_minmax(12rem,1fr)_3.5rem_5.5rem_3.5rem_5.5rem]'

interface RepoRowProps {
   item: RankedRepo
   weeks: WeekLabel[]
   hasLineStats: boolean
   onOpen: (repoId: string) => void
   onHover: (repoId: string | null) => void
}

export function RepoRow({
   item,
   weeks,
   hasLineStats,
   onOpen,
   onHover,
}: RepoRowProps) {
   const { series, recent } = item
   const { repo } = series

   return (
      <motion.li
         layout="position"
         transition={{ type: 'spring', stiffness: 520, damping: 46, mass: 0.7 }}
         className={`${ROW_GRID} group/row relative cursor-pointer border-t border-border/60 px-4 py-3.5 transition-colors first:border-t-0 hover:bg-muted/40`}
         onClick={() => onOpen(repo.id)}
         onPointerEnter={() => onHover(repo.id)}
         onPointerLeave={() => onHover(null)}
      >
         <div className="order-1 flex flex-col items-center gap-0.5 lg:order-none">
            <span className="text-lg leading-none font-semibold text-muted-foreground tabular-nums">
               {item.rank}
            </span>
            <RankChange item={item} />
         </div>

         <div className="order-2 min-w-0 lg:order-none">
            <div className="flex items-center gap-1.5">
               <button
                  type="button"
                  className="truncate rounded-sm text-left text-sm font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={(event) => {
                     event.stopPropagation()
                     onOpen(repo.id)
                  }}
               >
                  {repo.name}
               </button>
               <RepoFlags repo={repo} />
               <a
                  href={repo.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-sm p-0.5 text-muted-foreground transition-opacity outline-none hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring lg:opacity-0 lg:group-hover/row:opacity-100"
                  aria-label={`Open ${repo.nameWithOwner} on GitHub`}
                  onClick={(event) => event.stopPropagation()}
               >
                  <ExternalLinkIcon className="size-3.5" />
               </a>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
               {repo.language && (
                  <span className="flex shrink-0 items-center gap-1">
                     <span
                        className="size-2 rounded-full ring-1 ring-foreground/10"
                        style={{
                           backgroundColor: repo.language.color ?? 'transparent',
                        }}
                     />
                     {repo.language.name}
                  </span>
               )}
               {repo.language && repo.description && <span aria-hidden>·</span>}
               <span className="truncate">{repo.description}</span>
            </div>
         </div>

         <div className="order-4 col-span-full lg:order-none lg:col-span-1">
            <RepoLanes series={series} weeks={weeks} hasLineStats={hasLineStats} />
         </div>

         <div className="order-5 col-span-full flex items-baseline gap-5 text-sm lg:order-none lg:contents">
            <Figure label="commits" value={formatNumber(recent.commits)} />
            <div className="flex gap-2 lg:block lg:text-right">
               {hasLineStats ? (
                  <>
                     <LineCount
                        mark="bg-viz-additions"
                        value={formatAdded(recent.additions)}
                     />
                     <LineCount
                        mark="bg-viz-deletions"
                        value={formatRemoved(recent.deletions)}
                     />
                  </>
               ) : (
                  <span className="text-muted-foreground">–</span>
               )}
            </div>
            <Figure label="PRs merged" value={formatNumber(recent.pullsMerged)} />
         </div>

         <div className="order-3 w-20 lg:order-none lg:w-auto">
            <div className="text-right text-base leading-none font-semibold tabular-nums">
               {formatScore(item.score)}
            </div>
            <div
               className="mt-2 h-1.5 overflow-hidden rounded-full bg-viz-accent-soft"
               role="meter"
               aria-label="Activity relative to the most active repository"
               aria-valuemin={0}
               aria-valuemax={100}
               aria-valuenow={Math.round(item.share * 100)}
            >
               <div
                  className="h-full rounded-full bg-viz-accent transition-[width] duration-300"
                  style={{ width: `${Math.max(2, item.share * 100)}%` }}
               />
            </div>
         </div>
      </motion.li>
   )
}

function Figure({ label, value }: { label: string, value: string }) {
   return (
      <div className="flex items-baseline gap-1.5 lg:block lg:text-right">
         <span className="font-medium tabular-nums">{value}</span>
         <span className="text-xs whitespace-nowrap text-muted-foreground lg:hidden">
            {label}
         </span>
      </div>
   )
}

function LineCount({ mark, value }: { mark: string, value: string }) {
   return (
      <div className="flex items-center justify-end gap-1.5 text-xs leading-5 tabular-nums">
         <span className={`size-1.5 rounded-[2px] ${mark}`} />
         {value}
      </div>
   )
}

function RankChange({ item }: { item: RankedRepo }) {
   if (item.previousRank === null) {
      return (
         <span className="text-[10px] leading-none font-medium text-muted-foreground uppercase">
            new
         </span>
      )
   }
   const change = item.previousRank - item.rank
   if (change === 0) {
      return <span className="h-2.5" />
   }
   const Arrow = change > 0 ? ArrowUpIcon : ArrowDownIcon
   return (
      <span
         className="flex items-center text-[10px] leading-none font-medium text-muted-foreground tabular-nums"
         title={`${change > 0 ? 'Up' : 'Down'} ${Math.abs(change)} from a week earlier`}
      >
         <Arrow className="size-2.5" strokeWidth={2.5} />
         {Math.abs(change)}
      </span>
   )
}

export function RepoFlags({ repo }: { repo: Repo }) {
   return (
      <>
         {repo.isPrivate && <Flag icon={LockIcon} label="Private" />}
         {repo.isFork && (
            <Flag
               icon={GitForkIcon}
               label="Fork: only your own commits are counted"
            />
         )}
         {repo.isArchived && <Flag icon={ArchiveIcon} label="Archived" />}
      </>
   )
}

function Flag({ icon: Icon, label }: { icon: typeof LockIcon, label: string }) {
   return (
      <Tooltip>
         <TooltipTrigger asChild>
            <span className="shrink-0 text-muted-foreground" aria-label={label}>
               <Icon className="size-3" />
            </span>
         </TooltipTrigger>
         <TooltipContent>{label}</TooltipContent>
      </Tooltip>
   )
}
