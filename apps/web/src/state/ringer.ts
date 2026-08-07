import { createRingerEnvironmentAtoms } from "@t3tools/client-runtime/state/ringer";

import { connectionAtomRuntime } from "../connection/runtime";

export const ringerEnvironment = createRingerEnvironmentAtoms(connectionAtomRuntime);
