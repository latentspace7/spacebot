import { useId } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import type { JSX } from 'react'

export type SpacebotRobotProps = {
  className?: string
  style?: React.CSSProperties
  waving?: boolean
  reduceMotion?: boolean | null
}

const WAVE_DURATION = 2.4
const WAVE_REPEAT_DELAY = 0.9

export function SpacebotRobot({ className, style, waving = false, reduceMotion }: SpacebotRobotProps): JSX.Element {
  const id = useId()
  const preference = useReducedMotion()
  const shouldWave = waving && !(reduceMotion ?? preference)
  const waveTransition = {
    duration: WAVE_DURATION,
    repeat: Infinity,
    repeatDelay: WAVE_REPEAT_DELAY,
    ease: 'easeInOut' as const,
  }

  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`spacebot-robot ${className ?? ''}`}
      style={{ overflow: 'visible', ...style }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}-shell`} x1="15" y1="12" x2="48" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e2eaff" />
          <stop offset="0.24" stopColor="#a7b9fb" />
          <stop offset="0.58" stopColor="#7384dc" />
          <stop offset="0.84" stopColor="#6661b1" />
          <stop offset="1" stopColor="#9b93de" />
        </linearGradient>
        <linearGradient id={`${id}-body`} x1="23" y1="43" x2="40" y2="61" gradientUnits="userSpaceOnUse">
          <stop stopColor="#b3c4ff" />
          <stop offset="0.35" stopColor="#7c8ddd" />
          <stop offset="0.8" stopColor="#57599e" />
          <stop offset="1" stopColor="#8583c6" />
        </linearGradient>
        <radialGradient id={`${id}-glass`} cx="0" cy="0" r="1" gradientTransform="translate(23 19) rotate(49) scale(30 35)" gradientUnits="userSpaceOnUse">
          <stop stopColor="#213856" />
          <stop offset="0.5" stopColor="#0b192d" />
          <stop offset="1" stopColor="#030b1a" />
        </radialGradient>
        <linearGradient id={`${id}-reflection`} x1="20" y1="17" x2="39" y2="33" gradientUnits="userSpaceOnUse">
          <stop stopColor="#c1e1ff" stopOpacity="0.24" />
          <stop offset="1" stopColor="#c1e1ff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-limbs`} x1="13" y1="26" x2="54" y2="54" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e0ebff" />
          <stop offset="0.5" stopColor="#a0b4f4" />
          <stop offset="1" stopColor="#716abc" />
        </linearGradient>
        <linearGradient id={`${id}-eyes`} x1="32" y1="24" x2="32" y2="31" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e8feff" />
          <stop offset="1" stopColor="#65d9f5" />
        </linearGradient>
      </defs>

      <path d="M32 13V8" stroke="#aabfff" strokeWidth="2" strokeLinecap="round" />
      <motion.circle
        cx="32"
        cy="6.5"
        r="2.4"
        fill="#b5f3ff"
        animate={shouldWave ? { opacity: [1, 0.6, 1] } : undefined}
        transition={shouldWave ? { duration: 2.8, repeat: Infinity, ease: 'easeInOut' } : undefined}
      />
      <circle cx="31.5" cy="5.8" r="0.75" fill="#f4ffff" />

      <path d="M22 46.5L16 51" stroke={`url(#${id}-limbs)`} strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="14.2" cy="52.1" rx="3.1" ry="3.8" transform="rotate(34 14.2 52.1)" fill={`url(#${id}-shell)`} />
      <path d="M26.5 41H37.5V46H26.5V41Z" fill="#343d78" />
      <path d="M21 45.5C21 44.1 22.1 43 23.5 43H40.5C41.9 43 43 44.1 43 45.5V51C43 56 39 60 34 60H30C25 60 21 56 21 51V45.5Z" fill={`url(#${id}-body)`} stroke="#b6c7f4" strokeOpacity="0.55" strokeWidth="0.7" />
      <path d="M23.5 45H40.5" stroke="#e3eaff" strokeOpacity="0.6" strokeWidth="0.8" strokeLinecap="round" />
      <rect x="27.5" y="49" width="9" height="4" rx="2" fill="#253360" />
      <rect x="29" y="50.2" width="6" height="1.4" rx="0.7" fill="#8ae9fb" />
      <path d="M27 56.5C30 57.8 34 57.8 37 56.5" stroke="#afb8f0" strokeOpacity="0.4" strokeWidth="0.7" strokeLinecap="round" />

      <rect x="8.5" y="24" width="5" height="10" rx="2.5" fill="#6472b9" />
      <rect x="50.5" y="24" width="5" height="10" rx="2.5" fill="#6472b9" />
      <rect x="9" y="26" width="1.3" height="5" rx="0.65" fill="#a1e7fb" />
      <rect x="53.7" y="26" width="1.3" height="5" rx="0.65" fill="#a1e7fb" />
      <rect x="11" y="12.5" width="42" height="31.5" rx="12" fill={`url(#${id}-shell)`} stroke="#c2d2ff" strokeOpacity="0.7" strokeWidth="0.8" />
      <path d="M15.5 21C16.5 17.3 19.3 15 23.5 15H39" stroke="#f0f6ff" strokeOpacity="0.65" strokeWidth="1" strokeLinecap="round" />
      <rect x="15" y="17.5" width="34" height="22" rx="8.5" fill="#293766" />
      <rect x="15.6" y="18.1" width="32.8" height="20.8" rx="8" fill={`url(#${id}-glass)`} stroke="#0e1c35" strokeWidth="0.8" />
      <path d="M23.6 18.8H39.5C42.5 18.8 44.8 20.2 46 22.5C35 22.5 28 25.5 16.4 29V26.5C16.4 22.1 19.2 18.8 23.6 18.8Z" fill={`url(#${id}-reflection)`} />
      <path d="M21 39.4C27 41 38 41 43 39.4" stroke="#d1dbff" strokeOpacity="0.35" strokeWidth="0.65" strokeLinecap="round" />

      <motion.g
        animate={shouldWave ? { scaleY: [1, 1, 0.15, 1, 1] } : undefined}
        transition={shouldWave ? { duration: 4.4, times: [0, 0.88, 0.92, 0.96, 1], repeat: Infinity, repeatDelay: 1.6, ease: 'easeInOut' } : undefined}
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
      >
        <rect x="23" y="24.5" width="4.2" height="5.8" rx="2.1" fill={`url(#${id}-eyes)`} />
        <rect x="36.8" y="24.5" width="4.2" height="5.8" rx="2.1" fill={`url(#${id}-eyes)`} />
      </motion.g>
      <path d="M28 32.5C30.3 34.3 33.7 34.3 36 32.5" stroke="#a0e6fb" strokeWidth="1.5" strokeLinecap="round" />

      <motion.g
        animate={shouldWave ? { rotate: [0, -6, 4, -6, 0] } : undefined}
        transition={shouldWave ? waveTransition : undefined}
        style={{ transformBox: 'view-box', transformOrigin: '43px 46px' }}
      >
        <path d="M43 46L49.5 40" stroke={`url(#${id}-limbs)`} strokeWidth="5" strokeLinecap="round" />
        <circle cx="43" cy="46" r="2.2" fill="#9cacdf" />
        <motion.g
          animate={shouldWave ? { rotate: [0, -24, 18, -24, 0] } : undefined}
          transition={shouldWave ? waveTransition : undefined}
          style={{ transformBox: 'view-box', transformOrigin: '49.5px 40px' }}
        >
          <path d="M49.5 40L53.5 33" stroke={`url(#${id}-limbs)`} strokeWidth="4.6" strokeLinecap="round" />
          <path d="M50.2 31.5L49.7 29.1C49.5 28.2 50 27.5 50.7 27.4C51.2 27.3 51.8 27.7 52 28.3L52.2 25.2C52.3 24.4 52.9 23.9 53.5 24C54.1 24 54.5 24.6 54.5 25.2L55.3 23.6C55.6 22.9 56.3 22.7 56.9 23C57.5 23.3 57.6 24 57.3 24.6L56.9 26.2L58 25.3C58.6 24.9 59.2 25 59.6 25.5C60 26 59.8 26.7 59.3 27.2L57.2 30.9C56.7 32.4 55.3 33.4 53.9 33.4C52.1 33.4 50.8 32.7 50.2 31.5Z" fill={`url(#${id}-shell)`} stroke="#c2dcff" strokeOpacity="0.65" strokeWidth="0.6" strokeLinejoin="round" />
          <path d="M53 29.5L54.3 27.7" stroke="#e1edff" strokeOpacity="0.65" strokeWidth="0.7" strokeLinecap="round" />
        </motion.g>
        <circle cx="49.5" cy="40" r="1.8" fill="#b1c3f4" />
      </motion.g>
    </svg>
  )
}
