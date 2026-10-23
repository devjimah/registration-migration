import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');
const production = process.env.NODE_ENV === 'production';

/** @type {esbuild.BuildOptions[]} */
const targets = [
  {
    // Browser bundle
    entryPoints: ['src/main.ts'],
    outfile: 'public/dist/app.js',
    bundle: true,
    format: 'iife',
    target: ['es2019'],
    sourcemap: true,
    minify: production
  },
  {
    // Express API. node_modules stay external and are resolved at runtime.
    entryPoints: ['server/index.ts'],
    outfile: 'dist/server.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: ['node20'],
    packages: 'external',
    sourcemap: true
  }
];

if (watch) {
  // Server changes are picked up by `npm run dev:server` (tsx watch).
  const ctx = await esbuild.context({ ...targets[0], logLevel: 'info' });
  await ctx.watch();
} else {
  await Promise.all(targets.map((t) => esbuild.build({ ...t, logLevel: 'info' })));
}
