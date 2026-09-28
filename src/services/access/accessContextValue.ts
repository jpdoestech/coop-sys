import { createContext } from "react";
import type { AccessProfile } from "./accessControl";

export const AccessContextValue = createContext<AccessProfile | null>(null);
