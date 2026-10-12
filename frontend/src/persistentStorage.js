import { useState, useEffect, useRef } from 'react'

// Bump the version if the shape of stored messages ever changes,
// so old saved data is ignored instead of breaking the UI.
const PREFIX = 'campbuddy:v1:'

function read(key, fallback) {
    const getFallback = () =>
        typeof fallback === "function" ? fallback() : fallback;

    try {
        const raw = window.localStorage.getItem(PREFIX + key);

        if (raw === null) return getFallback();

        return JSON.parse(raw);
    } catch {
        return getFallback();
    }
}

function write(key, value) {
    try {
        window.localStorage.setItem(PREFIX + key, JSON.stringify(value))
        return true
    } catch {
        // Quota exceeded or storage unavailable
        return false
    }
}

/**
 * Drop-in replacement for useState that persists to localStorage.
 *
 * usePersistentState('messages', [], {
 *   maxItems: 100,                                   // keep only the newest N items (arrays)
 *   serialize: (msgs) => msgs.filter(m => !m.pending) // transform before saving
 * })
 */
export default function usePersistentState(key, initialValue, options = {}) {
    const { maxItems, serialize } = options
    // Keep the latest serialize fn in a ref so an inline arrow function
    // doesn't re-trigger the save effect on every render.
    const serializeRef = useRef(serialize)
    serializeRef.current = serialize

    const [value, setValue] = useState(() => {
        const stored = read(key, initialValue)
        // If we expect an array but stored data is something else, ignore it
        if (Array.isArray(initialValue) && !Array.isArray(stored)) return initialValue
        return stored
    })

    useEffect(() => {
        const fn = serializeRef.current
        let toSave = fn ? fn(value) : value

        if (maxItems && Array.isArray(toSave) && toSave.length > maxItems) {
            toSave = toSave.slice(-maxItems)
        }

        const ok = write(key, toSave)

        // If the browser refused the write (quota), retry with the newest half
        if (!ok && Array.isArray(toSave) && toSave.length > 1) {
            write(key, toSave.slice(-Math.ceil(toSave.length / 2)))
        }
    }, [key, value, maxItems])

    return [value, setValue]
}

// Optional: lets the UI show a small notice if history can't be saved
export function storageAvailable() {
    try {
        const probe = PREFIX + '__probe__'
        window.localStorage.setItem(probe, '1')
        window.localStorage.removeItem(probe)
        return true
    } catch {
        return false
    }
}