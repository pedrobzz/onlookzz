import { z } from "zod";

export const PROJECT_ID_SCHEMA = z
    .string()
    .trim()
    .min(1)
    .describe('Project ID to run the command in. Only use the project ID, not the project name.');
