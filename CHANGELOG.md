### 0.2.3 (2015-12-30)


#### Bug Fixes

* **main:** a cache get was mistakenly a set ([e4e1cc3c](http://github.com/voxpelli/node-tema/commit/e4e1cc3c8afc57472f3dacf2dc2fc5c0ec1f528c))


#### Features

* **main:** enable themes to do init themselves ([a234fc4b](http://github.com/voxpelli/node-tema/commit/a234fc4bf890333d84ce8cb1c35f99424cf3f789))


### 0.2.2 (2015-12-04)


#### Bug Fixes

* **dependencies:**
  * support lodash 3.x ([c765e843](http://github.com/voxpelli/node-tema/commit/c765e843bd757c6e7af0df5e27b3a51c171a5682))
  * support lru-cache 3.x ([4e72c804](http://github.com/voxpelli/node-tema/commit/4e72c80486da3419a1c81ae503d3fb3cd29f97d8))
  * updated outdated dependencies ([acd25335](http://github.com/voxpelli/node-tema/commit/acd253351dc685911d55c6690df4f797248f407c))
* **main:** relax nodejs engine requirements ([ef444dd7](http://github.com/voxpelli/node-tema/commit/ef444dd77e7c9553cb34f8fd38c5ac68507b100a))

## 0.2.1

* Bugfix: New lookup system for template files could sometimes match against just part of the filename – now ensures that full filename matches
* Tweaked: Error message for template not found now includes name of template

## 0.2.0

* New: Added new methods `getThemeInstance()` and `getLocals()`
* Tweaked: Changed the structure of values sent to preprocess methods.
* Tweaked: Reworked the lookup system for template files and added a cache to reduce file IO (off by default)
* Tweaked: Preprocess methods are now run in the context of the Tema instance and can thus eg. access locals by calling `this.getLocals()`
* Tweaked: A deep clone of all variables are now made before they are sent into preprocess methods etc – to avoid leaks of changes reaching outside of the specific rendering.
* Tweaked: Boolean values has gained special treatment as well in the `block()` method and will not be appended to an array but replace the current value of the specified block.
* Tweaked: Instead of resolving parent theme properties to the actual source themes, a new object with the source theme as its prototype is instead created and everything resolved to that.
* Removed: `renderPromise()` and `recursiveRendererPromise()` because `render()` and `recursiveRenderer()` already returns promises when not given a node.js callback.

## 0.1.1

* The documentation has been improved
* The test coverage has been improved
* Travis CI has been added
* Bug fix: Theme can now be changed through temaInstance.option()
* Bug fix: If theme parents cause a circular relationship, avoid infinite loop
* Bug fix: Tests should silence the console.warn() calls

## 0.1.0

* Initial version!
