import type { PlatformInput, PositionInput, RiskConfig, RiskInput } from '@/types/risk'
import { uniqueAssets } from '@/lib/risk'

export interface RiskDataState {
  data: RiskInput
  source: string
  localLoaded: boolean
  persist: boolean
  discarded: boolean
  selectedAsset: string
  selectedPlatform: string
}

export type RiskDataAction =
  | { type: 'replace'; data: RiskInput; source: string }
  | { type: 'reset'; data: RiskInput }
  | { type: 'addPosition'; position: PositionInput }
  | { type: 'updatePosition'; id: string; patch: Partial<PositionInput> }
  | { type: 'removePosition'; id: string }
  | { type: 'addPlatform'; platform: PlatformInput }
  | { type: 'updatePlatform'; id: string; patch: Partial<PlatformInput> }
  | { type: 'removePlatform'; id: string }
  | { type: 'updateConfig'; patch: Partial<RiskConfig> }
  | { type: 'selectAsset'; asset: string }
  | { type: 'selectPlatform'; platform: string }

function reconcileSelection(state: RiskDataState): RiskDataState {
  const assets = uniqueAssets(state.data)
  let selectedAsset = state.selectedAsset
  if (!assets.includes(selectedAsset)) selectedAsset = assets[0] ?? ''

  const platformNames = state.data.positions
    .filter((position) => position.asset.trim().toUpperCase() === selectedAsset)
    .map((position) => position.platform)
  let selectedPlatform = state.selectedPlatform
  if (!platformNames.includes(selectedPlatform)) selectedPlatform = platformNames[0] ?? ''

  return { ...state, selectedAsset, selectedPlatform }
}

function withData(state: RiskDataState, data: RiskInput): RiskDataState {
  return reconcileSelection({ ...state, data, persist: true })
}

export function createInitialState(
  data: RiskInput,
  source: string,
  localLoaded: boolean,
  discarded: boolean,
): RiskDataState {
  return reconcileSelection({
    data,
    source,
    localLoaded,
    persist: localLoaded,
    discarded,
    selectedAsset: data.config.keyAsset.trim().toUpperCase(),
    selectedPlatform: '',
  })
}

export function riskDataReducer(state: RiskDataState, action: RiskDataAction): RiskDataState {
  switch (action.type) {
    case 'replace':
      return reconcileSelection({
        ...state,
        data: action.data,
        source: action.source,
        localLoaded: true,
        persist: true,
        discarded: false,
        selectedAsset: action.data.config.keyAsset.trim().toUpperCase(),
        selectedPlatform: '',
      })

    case 'reset':
      return reconcileSelection({
        ...state,
        data: action.data,
        source: 'Ejemplo precargado',
        localLoaded: false,
        persist: false,
        discarded: false,
        selectedAsset: action.data.config.keyAsset.trim().toUpperCase(),
        selectedPlatform: '',
      })

    case 'addPosition':
      return withData(state, { ...state.data, positions: [...state.data.positions, action.position] })

    case 'updatePosition':
      return withData(state, {
        ...state.data,
        positions: state.data.positions.map((position) =>
          position.id === action.id ? { ...position, ...action.patch } : position,
        ),
      })

    case 'removePosition':
      return withData(state, {
        ...state.data,
        positions: state.data.positions.filter((position) => position.id !== action.id),
      })

    case 'addPlatform':
      return withData(state, { ...state.data, platforms: [...state.data.platforms, action.platform] })

    case 'updatePlatform': {
      const current = state.data.platforms.find((platform) => platform.id === action.id)
      const renamed = current && action.patch.name != null && action.patch.name !== current.name
      const platforms = state.data.platforms.map((platform) =>
        platform.id === action.id ? { ...platform, ...action.patch } : platform,
      )
      const positions = renamed
        ? state.data.positions.map((position) =>
            position.platform === current.name ? { ...position, platform: action.patch.name as string } : position,
          )
        : state.data.positions
      return withData(state, { ...state.data, platforms, positions })
    }

    case 'removePlatform': {
      const platform = state.data.platforms.find((item) => item.id === action.id)
      const platforms = state.data.platforms.filter((item) => item.id !== action.id)
      const positions = platform
        ? state.data.positions.filter((position) => position.platform !== platform.name)
        : state.data.positions
      return withData(state, { ...state.data, platforms, positions })
    }

    case 'updateConfig': {
      const config = { ...state.data.config, ...action.patch }
      const selectedAsset = action.patch.keyAsset
        ? action.patch.keyAsset.trim().toUpperCase()
        : state.selectedAsset
      return withData({ ...state, selectedAsset }, { ...state.data, config })
    }

    case 'selectAsset':
      return reconcileSelection({
        ...state,
        selectedAsset: action.asset.trim().toUpperCase(),
        data: { ...state.data, config: { ...state.data.config, keyAsset: action.asset.trim().toUpperCase() } },
      })

    case 'selectPlatform':
      return { ...state, selectedPlatform: action.platform }

    default:
      return state
  }
}
