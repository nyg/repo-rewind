export function Logo({ className }: { className?: string }) {
   return (
      <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
         <rect width="24" height="24" rx="6" className="fill-foreground" />
         <rect
            x="5"
            y="12"
            width="3"
            height="7"
            rx="1"
            className="fill-background"
         />
         <rect
            x="10.5"
            y="5"
            width="3"
            height="14"
            rx="1"
            className="fill-background"
         />
         <rect
            x="16"
            y="9"
            width="3"
            height="10"
            rx="1"
            className="fill-background"
         />
      </svg>
   )
}
