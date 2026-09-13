/* eslint-disable react-refresh/only-export-components -- hook and provider share one band context */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { apiBaseUrl } from '../auth/authConfig.js';
import { loadActiveBandId, saveActiveBandId } from './bandStorage.js';

const BandContext = createContext({
    bands: [],
    activeBand: null,
    loading: false,
    isAuthenticated: false,
    createBand: async () => {
        throw new Error('Band context is not available');
    },
    selectBand: () => {},
    refreshBands: async () => {},
});

export function useBand() {
    return useContext(BandContext);
}

export function BandProvider({ children }) {
    const auth = useAuth();
    const accessToken = auth.user?.access_token;
    const isAuthenticated = Boolean(auth.isAuthenticated && accessToken);
    const currentSession = isAuthenticated ? accessToken : null;

    const [sessionToken, setSessionToken] = useState(currentSession);
    const [bands, setBands] = useState([]);
    const [activeBand, setActiveBand] = useState(null);
    const [loadedToken, setLoadedToken] = useState(null);

    if (sessionToken !== currentSession) {
        setSessionToken(currentSession);
        setBands([]);
        setActiveBand(null);
        setLoadedToken(null);
    }

    const applyBandList = useCallback((list, preferredBandId) => {
        const storedId = preferredBandId ?? loadActiveBandId();
        const restored = list.find((band) => band.id === storedId) ?? list[0] ?? null;
        setBands(list);
        setActiveBand(restored);
        saveActiveBandId(restored?.id ?? null);
    }, []);

    useEffect(() => {
        if (!isAuthenticated) {
            saveActiveBandId(null);
            return undefined;
        }

        let cancelled = false;

        fetch(`${apiBaseUrl}/api/bands`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`API error: ${response.status}`);
                }
                return response.json();
            })
            .then((data) => {
                if (cancelled) {
                    return;
                }
                applyBandList(Array.isArray(data) ? data : []);
                setLoadedToken(accessToken);
            })
            .catch(() => {
                if (!cancelled) {
                    setBands([]);
                    setActiveBand(null);
                    setLoadedToken(accessToken);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [isAuthenticated, accessToken, applyBandList]);

    const selectBand = (bandId) => {
        const next = bands.find((band) => band.id === bandId);
        if (!next) {
            return;
        }
        setActiveBand(next);
        saveActiveBandId(next.id);
    };

    const refreshBands = useCallback(async (preferredBandId) => {
        if (!accessToken) {
            return [];
        }
        const response = await fetch(`${apiBaseUrl}/api/bands`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        const data = await response.json();
        const list = Array.isArray(data) ? data : [];
        applyBandList(list, preferredBandId);
        return list;
    }, [accessToken, applyBandList]);

    const createBand = async (name) => {
        const response = await fetch(`${apiBaseUrl}/api/bands`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name }),
        });
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        const created = await response.json();
        setBands((previous) => [...previous, created]);
        setActiveBand(created);
        saveActiveBandId(created.id);
        return created;
    };

    return (
        <BandContext.Provider
            value={{
                bands: isAuthenticated ? bands : [],
                activeBand: isAuthenticated ? activeBand : null,
                loading: isAuthenticated && loadedToken !== accessToken,
                isAuthenticated,
                createBand,
                selectBand,
                refreshBands,
            }}
        >
            {children}
        </BandContext.Provider>
    );
}
