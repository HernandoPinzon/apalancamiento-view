import { useEffect, useReducer } from 'react'
import { demoData } from '@/data/demoData'
import { parseStoredInput } from '@/lib/schema'
import { createInitialState, riskDataReducer, type RiskDataState } from '@/lib/riskStore'

const storageKey = 'radar-riesgo-input-v2'
const legacyStorageKey = 'radar-riesgo-input-v1'

function clearStoredData() {
  try {
    window.localStorage.removeItem(storageKey)
    window.localStorage.removeItem(legacyStorageKey)
  } catch {
    // El almacenamiento local puede estar bloqueado.
  }
}

function loadInitialState(): RiskDataState {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(storageKey) ?? window.localStorage.getItem(legacyStorageKey)
  } catch {
    return createInitialState(demoData, 'Ejemplo precargado', false, false)
  }
  if (!raw) return createInitialState(demoData, 'Ejemplo precargado', false, false)

  try {
    const data = parseStoredInput(JSON.parse(raw))
    if (!data) {
      clearStoredData()
      return createInitialState(demoData, 'Ejemplo precargado', false, true)
    }
    return createInitialState(data, 'Copia local del navegador', true, false)
  } catch {
    clearStoredData()
    return createInitialState(demoData, 'Ejemplo precargado', false, true)
  }
}

export function useRiskData() {
  const [state, dispatch] = useReducer(riskDataReducer, undefined, loadInitialState)

  useEffect(() => {
    if (!state.persist) return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state.data))
      window.localStorage.removeItem(legacyStorageKey)
    } catch {
      // El almacenamiento local puede estar lleno o bloqueado; la app sigue funcionando con datos en memoria.
    }
  }, [state.data, state.persist])

  return { state, dispatch, clearStoredData }
}
