# Vendored libraries

`three.min.js`: three.js r187 (MIT licence, https://github.com/mrdoob/three.js), bundled with esbuild into one
script that exposes the global `THREE`, with only the classes the game uses: WebGLRenderer, Scene, Camera, Mesh,
BufferGeometry, BufferAttribute, BoxGeometry, MeshLambertMaterial, MeshPhongMaterial, MeshBasicMaterial, ShaderMaterial, AmbientLight, DirectionalLight, DoubleSide, Color,
CanvasTexture, WebGLRenderTarget, SRGBColorSpace, LinearFilter (the last six since GDD 11o, for the 3D ground), InstancedMesh, Fog, Plane (since GDD 11o phase 2, for the 3D walls), RepeatWrapping (phase 3, the crowd texture). Not edited by hand.

Rebuild: `npm i three@0.187.0 esbuild@0.25`, then bundle an entry file that re-exports those classes with
`esbuild entry.js --bundle --minify --format=iife --global-name=THREE --outfile=three.min.js`.
