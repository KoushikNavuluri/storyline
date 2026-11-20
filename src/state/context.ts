import { createContext, useContext } from "react";
import type { Doc, StudioState, Version } from "./types";

export type Updater = Partial<StudioState> | ((state: StudioState) => StudioState);

export type SaveStatus = string;

export interface StudioContextValue {
  state: StudioState;
  /** Shallow-merge a patch, or apply a functional update. */
  update: (patch: Updater) => void;
  route: string;
  go: (route: string) => void;
  /** Open the shared confirm dialog. */
  ask: (title: string, description: string, action: () => void, button?: string) => void;
  updateDoc: (id: string, patch: Partial<Doc> | ((doc: Doc) => Doc)) => void;
  snap: (id: string, name?: string) => Version | null;
  exportData: () => void;
  save: SaveStatus;
  seed: () => void;
  /** Signed-in account email (Supabase Auth). */
  email: string;
  signOut: () => Promise<void>;
}

export const StudioContext = createContext<StudioContextValue | null>(null);

export function useStudio(): StudioContextValue {
  const value = useContext(StudioContext);
  if (!value) throw new Error("useStudio must be used inside <StudioProvider>");
  return value;
}
