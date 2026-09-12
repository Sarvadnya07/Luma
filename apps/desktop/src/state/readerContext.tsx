import React, { createContext, useContext, useRef } from "react";
import type { StoreApi, UseBoundStore } from "zustand";
import type { ReaderStoreState } from "./readerState";
import { createReaderStoreForApi, useReaderStore as defaultReaderStore } from "./readerState";
import { LumaApi, type LumaApiClient } from "../lib/tauri";

export type ReaderStore = UseBoundStore<StoreApi<ReaderStoreState>>;

const ReaderStoreContext = createContext<ReaderStore>(defaultReaderStore);

export function ReaderStoreProvider({ api, children }: { api: LumaApiClient; children: React.ReactNode }) {
  const storeRef = useRef<ReaderStore>();
  if (!storeRef.current) {
    if (api === LumaApi) {
      storeRef.current = defaultReaderStore;
    } else {
      storeRef.current = createReaderStoreForApi(api);
    }
  }
  return <ReaderStoreContext.Provider value={storeRef.current}>{children}</ReaderStoreContext.Provider>;
}

export function useReaderStore<T>(selector: (state: ReaderStoreState) => T): T {
  return useContext(ReaderStoreContext)(selector);
}
