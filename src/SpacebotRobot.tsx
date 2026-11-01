import { useId } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import type { JSX } from 'react'

export type SpacebotRobotProps = {
  className?: string
  style?: React.CSSProperties
  waving?: boolean
  reduceMotion?: boolean | null
}

const CAPE = 'var(--spacebot-robot-cape, #6a45e4)'
const JOINT = '#24212e'
const EDGE = '#cfc9dc'
const CAPE_PATH = 'M46 64C60 58 86 56 112 52c-6 10 2 22-6 32 2 4-6 10-10 8-8 4-16-2-24 2-6-6-16-10-24-14Z'

function Limb({ d }: { d: string }): JSX.Element {
  return (
    <>
      <path d={d} stroke={EDGE} strokeWidth="8.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} stroke="#f8f7fc" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </>
  )
}

export function SpacebotRobot({ className, style, waving = false, reduceMotion }: SpacebotRobotProps): JSX.Element {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const preference = useReducedMotion()
  const animate = !(reduceMotion ?? preference)
  const shouldWave = waving && animate
  const shell = `url(#${id}-shell)`
  const glow = `url(#${id}-glow)`

  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`spacebot-robot ${className ?? ''}`}
      style={{ overflow: 'visible', ...style }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}-shell`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#efedf5" />
          <stop offset="1" stopColor="#c9c4d8" />
        </linearGradient>
        <linearGradient id={`${id}-cape-shade`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="0.45" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.32" />
        </linearGradient>
        <linearGradient id={`${id}-screen`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#2a2638" />
          <stop offset="1" stopColor="#07060c" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <ellipse cx="60" cy="116" rx="20" ry="2.6" fill="#3d2499" fillOpacity="0.14" />
      <g transform="rotate(-6 60 70)">
        <motion.g
          animate={animate ? { skewY: [0, -5, 0], scaleX: [1, 1.04, 1] } : undefined}
          transition={animate ? { duration: 2.8, repeat: Infinity, ease: 'easeInOut' } : undefined}
          style={{ transformBox: 'view-box', transformOrigin: '58px 62px' }}
        >
          <path d={CAPE_PATH} style={{ fill: CAPE }} />
          <path d={CAPE_PATH} fill={`url(#${id}-cape-shade)`} stroke="#ffffff" strokeOpacity="0.35" strokeWidth="0.8" />
          <path d="M74 64c10 6 16 16 14 28M90 60c8 8 12 18 10 28" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="1.2" strokeLinecap="round" />
        </motion.g>

        <Limb d="M53 92l-3 11 7 8" />
        <Limb d="M63 92l4 10 8 4" />
        <circle cx="50" cy="103" r="1.9" fill="#a39cb8" />
        <circle cx="67" cy="102" r="1.9" fill="#a39cb8" />
        <Limb d="M44 64H34l-10-3" />
        <circle cx="34" cy="64" r="1.9" fill="#a39cb8" />
        <rect x="15" y="56.5" width="9" height="8" rx="3.5" fill={shell} stroke={EDGE} strokeWidth="0.8" />
        <path d="M17 58.5v4M19.5 58.5v4M22 58.5v4" stroke="#bdb6cc" strokeWidth="0.8" strokeLinecap="round" />

        <ellipse cx="58" cy="76" rx="15" ry="17" fill={shell} stroke="#d6d0e3" strokeWidth="0.8" />
        <motion.rect
          x="53" y="72" width="10" height="3" rx="1.5" fill="#7fe7ff" filter={glow}
          animate={animate ? { opacity: [1, 0.55, 1] } : undefined}
          transition={animate ? { duration: 3, repeat: Infinity, ease: 'easeInOut' } : undefined}
        />
        <ellipse cx="58" cy="91.5" rx="10" ry="3.2" fill={JOINT} />
        <path d="M44 62q14 9 28 0" strokeWidth="4" strokeLinecap="round" style={{ stroke: CAPE }} />

        <motion.g
          animate={shouldWave ? { rotate: [0, 16, -10, 16, 0] } : undefined}
          transition={shouldWave ? { duration: 1.7, repeat: Infinity, repeatDelay: 1.1, ease: 'easeInOut' } : undefined}
          style={{ transformBox: 'view-box', transformOrigin: '72px 64px' }}
        >
          <Limb d="M72 64l12-4 10-10" />
          <circle cx="84" cy="60" r="1.9" fill="#a39cb8" />
          <path d="M92 45.5l-1-3.2M95 44.5v-3.6M98 45.5l1.2-3M99.5 49l2.6-1.4" stroke={EDGE} strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="95" cy="49" r="4.6" fill={shell} stroke={EDGE} strokeWidth="0.8" />
        </motion.g>
        <circle cx="44" cy="64" r="3.4" fill={JOINT} />
        <circle cx="72" cy="64" r="3.4" fill={JOINT} />
        <ellipse cx="58" cy="58" rx="6" ry="2.5" fill={JOINT} />

        <path d="M70 16l6-9" stroke="#d6d0e3" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="76.5" cy="6.5" r="2" fill="#ffffff" stroke="#d6d0e3" strokeWidth="0.8" />
        <circle cx="33.5" cy="36" r="5" fill={shell} stroke="#d6d0e3" strokeWidth="0.8" />
        <ellipse cx="58" cy="35" rx="25" ry="21" fill={shell} stroke="#d6d0e3" strokeWidth="0.8" />
        <rect x="39" y="24" width="38" height="21" rx="10.5" fill={`url(#${id}-screen)`} />
        <path d="M44 27.5c4-1.6 10-2.2 16-2" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.6" strokeLinecap="round" />
        <motion.g
          filter={glow}
          animate={animate ? { scaleY: [1, 1, 0.1, 1, 1] } : undefined}
          transition={animate ? { duration: 4.4, times: [0, 0.88, 0.92, 0.96, 1], repeat: Infinity, repeatDelay: 1.6, ease: 'easeInOut' } : undefined}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        >
          <path d="M46.5 36.5q4-5 8 0M61.5 36.5q4-5 8 0" stroke="#8fe9ff" strokeWidth="2.4" strokeLinecap="round" />
        </motion.g>
        <path d="M54.5 39.5q3.5 3 7 0" stroke="#8fe9ff" strokeWidth="1.8" strokeLinecap="round" filter={glow} />
        <circle cx="83.5" cy="36" r="7.5" fill={shell} stroke={EDGE} strokeWidth="0.8" />
        <circle cx="83.5" cy="36" r="5" stroke="#bdb6cc" strokeWidth="0.9" />
        <circle cx="83.5" cy="36" r="2.6" fill="#e3dff0" stroke="#bdb6cc" strokeWidth="0.8" />
      </g>
    </svg>
  )
}
