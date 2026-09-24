import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

interface Stop {
  id: string
  name: string
  lat: number
  lng: number
  similarity?: number
}

interface Props {
  label: string
  placeholder: string
  value: string
  onSelect: (stop: Stop) => void
}

export function StopSearch({ label, placeholder, value, onSelect }: Props) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<Stop[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [noResults, setNoResults] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    setQuery(value)
  }, [value])

  const search = async (term: string) => {
    if (!term || term.length < 2) {
      setResults([])
      setNoResults(false)
      return
    }
    setLoading(true)
    try {
      // Calls the pg_trgm search_stops RPC defined in the migration
      const { data, error } = await supabase.rpc('search_stops', {
        search_term: term,
        match_threshold: 0.2,
      })
      if (error) throw error
      const hits: Stop[] = data || []
      setResults(hits)
      setNoResults(hits.length === 0)
      setShowDropdown(true)
    } catch (err) {
      console.error('[StopSearch]', err)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setQuery(v)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => search(v), 280)
  }

  const handleSelect = (stop: Stop) => {
    setQuery(stop.name)
    setShowDropdown(false)
    setResults([])
    onSelect(stop)
  }

  return (
    <div className="relative mt-6">
      <h2 className="text-3xl font-semibold tracking-tight">{label}</h2>
      <input
        autoFocus
        value={query}
        onChange={handleChange}
        onFocus={() => results.length > 0 && setShowDropdown(true)}
        placeholder={placeholder}
        className="mt-6 w-full border-b border-border bg-transparent pb-3 text-lg text-foreground outline-none placeholder:text-muted-foreground focus:border-signal"
      />
      {loading && (
        <span className="absolute right-0 bottom-4 label-mono animate-pulse">Searching…</span>
      )}
      {showDropdown && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-sm border border-border bg-background shadow-xl">
          {results.map((s) => (
            <button
              key={s.id}
              onClick={() => handleSelect(s)}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-secondary transition-colors"
            >
              <span>{s.name}</span>
              {s.similarity != null && (
                <span className="label-mono text-signal ml-3">
                  {Math.round(s.similarity * 100)}% match
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {noResults && !loading && query.length >= 2 && (
        <p className="mt-3 text-sm text-muted-foreground">
          ⚠ We couldn't find that stop — try a different spelling.
        </p>
      )}
    </div>
  )
}
