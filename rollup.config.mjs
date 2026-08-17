import terser from '@rollup/plugin-terser';
import copy from 'rollup-plugin-copy';
import postcss from 'rollup-plugin-postcss';

const isDev = process.env.BUILD === 'development';

export default {
  input: 'travel-pace.mjs',
  output: {
    file: 'dist/travel-pace.mjs',
    format: 'es',
    sourcemap: true,
    inlineDynamicImports: true
  },
  plugins: [
    postcss({
      extract: 'styles/travel-pace.css',
      minimize: false
    }),
    !isDev &&
      terser({
        format: { comments: false }
      }),
    copy({
      copyOnce: false,
      targets: [
        { src: 'templates', dest: 'dist' },
        { src: 'module.json', dest: 'dist' },
        { src: 'release_notes.txt', dest: 'dist' },
        { src: 'LICENSE', dest: 'dist' },
        { src: 'README.md', dest: 'dist' }
      ]
    })
  ]
};
