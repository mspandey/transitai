import { useState, useEffect } from 'react'

type GeoState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; lat: number; lng: number }
  | { status: 'denied' }
  | { status: 'unsupported' }
  | { status: 'error'; message: string }

export function useGeolocation() {
  const [state, setState] = useState<GeoState>({ status: 'idle' })

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState({ status: 'unsupported' })
      return
    }

    setState({ status: 'loading' })

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          status: 'success',
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          // Don't re-prompt — fall back silently to manual search
          setState({ status: 'denied' })
        } else {
          setState({ status: 'error', message: err.message })
        }
      },
      { timeout: 8000, maximumAge: 60000 },
    )
  }, [])

  return state
}
