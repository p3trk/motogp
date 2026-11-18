# Vendored libraries

`three.min.js`: three.js r187 (MIT licence, https://github.com/mrdoob/three.js), bundled with esbuild into one
script that exposes the global `THREE`, with only the classes the game uses: WebGLRenderer, Scene, Camera, Mesh,
BufferGeometry, BufferAttribute, MeshLambertMaterial, MeshPhongMaterial, AmbientLight, DirectionalLight, DoubleSide, Color. Not edited by hand.

Rebuild: `npm i three@0.187.0 esbuild@0.25`, then bundle an entry file that re-exports those classes with
`esbuild entry.js --bundle --minify --format=iife --global-name=THREE --outfile=three.min.js`.
