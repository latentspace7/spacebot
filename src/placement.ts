import type { CSSProperties } from 'react'
import type { PositionOptions, SpacebotPlacement } from './types'

function length(value: number | string | undefined, fallback: number): string {
  return typeof value === 'number' ? `${value}px` : value ?? `${fallback}px`
}

export function placementStyle(placement: SpacebotPlacement | undefined, kind: 'launcher' | 'panel'): CSSProperties {
  const desktop = placement?.[kind]
  const mobile = placement?.mobile?.[kind]
  const values: Record<string, string> = {}
  const apply = (options: PositionOptions | undefined, prefix: string, defaultX: number, defaultY: number): void => {
    const position = options?.position ?? 'bottom-right'
    const horizontal = length(options?.offsetX, defaultX)
    const vertical = length(options?.offsetY, defaultY)
    const center = position.startsWith('center')
    values[`${prefix}-left`] = position.endsWith('left') ? horizontal : 'auto'
    values[`${prefix}-right`] = position.endsWith('right') ? horizontal : 'auto'
    values[`${prefix}-top`] = center ? `calc(50% + ${length(options?.offsetY, 0)})` : position.startsWith('top') ? vertical : 'auto'
    values[`${prefix}-bottom`] = position.startsWith('bottom') ? vertical : 'auto'
    values[`${prefix}-translate`] = center ? '-50%' : '0'
    values[`${prefix}-tip-left`] = position.endsWith('left') ? 'calc(100% + 8px)' : 'auto'
    values[`${prefix}-tip-right`] = position.endsWith('right') ? 'calc(100% + 8px)' : 'auto'
    values[`${prefix}-tip-top`] = center ? '50%' : position.startsWith('top') ? '0' : 'auto'
    values[`${prefix}-tip-bottom`] = position.startsWith('bottom') ? '0' : 'auto'
  }
  apply(desktop, '--sb-desktop', 24, kind === 'panel' ? 96 : 16)
  apply(mobile, '--sb-mobile', kind === 'panel' ? 12 : 8, kind === 'panel' ? 96 : 16)
  return values as CSSProperties
}
