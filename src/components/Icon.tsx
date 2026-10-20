export type IconName =
  | 'restroom' | 'cup' | 'bell' | 'plane' | 'seat' | 'badge'
  | 'home' | 'cart' | 'arrow' | 'back' | 'exit' | 'delete' | 'compass'

// Hand-drawn 24px line icons. Stroke follows currentColor.
const PATHS: Record<IconName, string> = {
  restroom: 'M7 4.5a1.5 1.5 0 1 0 0 .01M17 4.5a1.5 1.5 0 1 0 0 .01M5 9h4l.5 6H8v5H6v-5H4.5zM15 9h4l1.5 7H19v4h-4v-4h-1.5zM12 3v18',
  cup: 'M6 8h12l-1.5 12h-9zM5 8h14M9 8l1-5h4M9.5 13h5',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0M12 3v2',
  plane: 'M21 12c0-.8-.7-1.3-1.5-1.3H15L10.5 3h-2l2.2 7.7H6L4.5 8.5H3l1 3.5-1 3.5h1.5L6 13.3h4.7L8.5 21h2l4.5-7.7h4.5c.8 0 1.5-.5 1.5-1.3z',
  seat: 'M8 3h5a2 2 0 0 1 2 2v8H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM6 13h12v3H6zM8 16v5M16 16v5',
  badge: 'M6 5h12v16H6zM10 3h4v3h-4zM12 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM8.5 18c.6-2 2-3 3.5-3s2.9 1 3.5 3',
  home: 'M4 11 12 4l8 7M6 9.5V20h12V9.5M10 20v-5h4v5',
  cart: 'M5 4h14v13H5zM5 10.5h14M8 7h2M8 13.5h2M7 17v3M17 17v3',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  back: 'M19 12H5M11 6l-6 6 6 6',
  exit: 'M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10',
  delete: 'M9 6h11v12H9l-6-6zM12.5 9.5l5 5M17.5 9.5l-5 5',
  compass: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15.5 8.5l-2 5-5 2 2-5z',
}

// Solid silhouettes that read better filled than outlined.
const FILLED: IconName[] = ['plane']

interface Props {
  name: IconName
  size?: number
  className?: string
}

export default function Icon({ name, size = 24, className }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={FILLED.includes(name) ? 'currentColor' : 'none'}
      stroke={FILLED.includes(name) ? 'none' : 'currentColor'}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
