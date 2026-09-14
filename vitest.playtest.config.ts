import { defineConfig } from 'vitest/config';
export default defineConfig({test:{include:['tests/playtest*.test.ts','tests/rewarded-ad.test.ts'],testTimeout:120000,fileParallelism:false}});
