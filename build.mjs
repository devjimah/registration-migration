import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');
const production = process.env.NODE_ENV === 'production';

/** @type {esbuild.BuildOptions} */
const options = {
  entryPoints: ['src/main.ts'],
  outfile: 'public/dist/app.js',
  bundle: true,
  format: 'iife',
  target: ['es2019'],
  sourcemap: true,
  minify: production,
  logLevel: 'info'
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  await esbuild.build(options);
}
