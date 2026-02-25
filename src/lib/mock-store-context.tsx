"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  consumePersistSkipSignal,
  mockActions,
  readPersistedMockState,
  type MockState,
  useMockStore,
  writePersistedMockState
} from "@/lib/mockStore";
import { readPersistedSettings, writePersistedSettings } from "@/lib/settings-store";

interface MockStoreContextValue {
  state: MockState;
  actions: typeof mockActions;
}

const MockStoreContext = createContext<MockStoreContextValue | null>(null);

export function MockStoreProvider({ children }: { children: ReactNode }) {
  const state = useMockStore((current) => current);
  const [readyForPersist, setReadyForPersist] = useState(false);

  useEffect(() => {
    const persisted = readPersistedMockState();
    if (persisted) {
      mockActions.hydrateFromStorage(persisted);
    } else {
      const persistedSettings = readPersistedSettings();
      if (persistedSettings) {
        mockActions.hydrateSettings(persistedSettings);
      }
    }

    setReadyForPersist(true);
  }, []);

  useEffect(() => {
    if (!readyForPersist) {
      return;
    }

    if (consumePersistSkipSignal()) {
      return;
    }

    writePersistedMockState(state);
    writePersistedSettings(state.settings);
  }, [readyForPersist, state]);

  return (
    <MockStoreContext.Provider
      value={{
        state,
        actions: mockActions
      }}
    >
      {children}
    </MockStoreContext.Provider>
  );
}

export function useMockStoreContext(): MockStoreContextValue {
  const context = useContext(MockStoreContext);
  if (!context) {
    throw new Error("useMockStoreContext must be used within MockStoreProvider");
  }

  return context;
}
