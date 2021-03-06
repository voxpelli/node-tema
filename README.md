# Tema

An asynchronous node.js theme layer that adds the notion of themes and sub-themes on top of your template rendering engine.
Inspired by Drupal and brings eg. the preprocess methods from there.

[![Build Status](https://travis-ci.org/voxpelli/node-tema.svg?branch=master)](https://travis-ci.org/voxpelli/node-tema)
[![Coverage Status](https://img.shields.io/coveralls/voxpelli/node-tema.svg)](https://coveralls.io/r/voxpelli/node-tema?branch=master)
[![dependencies Status](https://david-dm.org/voxpelli/node-tema/status.svg)](https://david-dm.org/voxpelli/node-tema)
[![Known Vulnerabilities](https://snyk.io/test/github/voxpelli/node-tema/badge.svg?targetFile=package.json)](https://snyk.io/test/github/voxpelli/node-tema?targetFile=package.json)
[![js-semistandard-style](https://img.shields.io/badge/code%20style-semistandard-brightgreen.svg?style=flat)](https://github.com/Flet/semistandard)


## Installation

```bash
npm install tema --save
```

## Usage

Simple:

```javascript
const Tema = require('tema');
const coolTheme = {
  templatePath : 'coolTheme/'
};

const temaInstance = new Tema({
  theme : coolTheme,
  defaultToPlain : false // Makes it so that templates by default render using the simple template engine in lodash
});

temaInstance.render('foo', { title : 'Bar' }).then(result => {
  // The rendered result of ./coolTheme/foo.html is now ready to act on
});
```

Advanced:

```javascript
const Tema = require('tema');

const parentTheme = {
  templatePath : 'parentTheme/',
  processors : {
    foo: (data, callback) => {
      data.subtitle = 'Yet Another';
      callback(null, data);
    }
  }
};

const childTheme = {
  parent : parentTheme,
  templatePath : 'childTheme/',
  defaultToPlain : false,
  processors : {
    foo: (data, callback) => {
      data.subtitle += 'Cool Subtitle';
      callback(null, data);
    }
  }
};

const temaInstance = new Tema({
  theme : childTheme
});

temaInstance.render('foo', { title : 'Bar' }).then(result => {
  // The rendered result of ./coolTheme/foo.html is now ready to act on
  // If the file contained just '<%= title %>: <%= subtitle %>', the result would be:
  // 'Bar: Yeat Another Cool Subtitle '
});
```

## Methods of Tema instances

* **render(template[, variables][, context])** – renders a simple template – first preprocessing and processing the data and then discovering the template file or method and if a file, rendering that file with the theme's rendering engine or the default one. If a *context* object is supplied then any context data added from within the template, using the `block()` template method will get added to that object. Returns a `Promise`.
* **recursiveRenderer(element)** – is sent a collection of element and child elements, which it processes asynchronously to form a final rendered result. This is a lot like `drupal_render()` and enables eg. a full HTML-page to be constructed without the templates themselves or their preprocessors/processors needing to know what subtemplates to render. Types can also be set up with defaults to make certain repeatable elements on a page easier to add, like eg. form elements. Returns a `Promise`.
* **getPublicPaths()** – returns an array of paths to public assets – starting with the current theme and then continuing with the public paths of the parents. This array can then be used to eg. set up the static Express middleware to have Express find these assets.
* **option(key[, value])** – if you eg. want to set the *locals* option after you have initialized the Tema instance, then you can do so with this method. If `value` is undefined then the value of the option will be returned instead.
* **getThemeInstance(theme)** – when given a theme it returns the instance of that object within Tema, with inherited properties resolved etc. Useful to act on the theme instance from within a theme preprocess (used internally by eg. `getLocals()`)
* **getLocals([theme])** - returns the locals that are exposed to the themes templates, or if no theme just the locals defined in the Tema instance. Useful to make use of locals in theme preprocesses.

## Advanced Tema options

* **theme** - the object of the active theme.
* **path** - the path to which all theme paths are relative.
* **defaultToPlain** – defaults to true. If it is instead set to false the defeault renderer will be the lodash template engine rather than just one returning the content of a file template without any processing.
* **locals** – object of variables/methods that will be made available to the templates. Will override any template variables with the same name. Used to extend the templates with more methods.
* **elementTypes** – an object with a collection of predefined types. Used for the recursiveRendering()-feature.
* **cache** – either a _truthy_ value, a number representing the maximum size of the cache or a full LRU cache [option object](https://github.com/isaacs/node-lru-cache#options) (the latter only meant for very advanced use cases)

## Advanced theme options (optional)

* **parent** – the theme object of the parent theme if there is one. Preprocessors, processors, templates and options will all be inherited from the parent (and the parent in turn can inherit it from its parent and so on).
* **templatePath** – if there are file templates for this theme – where they can be found. Not inherited as templates will be looked for in the parents template directories as well if not found in the child theme.
* **preprocessor** – a method following the classic callback pattern of node.js. It will be called before any other preprocessor methods are looked for and will be called for all templates. Tema will begin with the one from the parent highest up in the hierarchy and then go down until it finally calls the one defined for the child theme.
* **preprocessors** – an object containing preprocessor methods – keyed by the name of the templates. Will be called before the template is rendered. Like **preprocessor** the parents' methods will be called first.
* **processor** – like the **preprocessor**, but will be called after the last of the template specific methods in **preprocessors**.
* **processors** – an object like the **preprocessors** one, will be called after **processor**.
* **templates** – an object containing templates – keyed by the name of those templates. Will always be checked prior to a theme's **templatePath**. The value can either be a function or a string. If a function then the function should send the rendered result back in the callback sent to it, otherwise it should be a string relative to the path set in Tema (_not_ relative to the **templatePath**) and that template file will be sent to the renderer.
* **locals** – object of variables/methods that will be made available to the templates. Will override any template variables or theme engine locals with the same name. Primarily there for extending the available methods for templates.
* **options.renderer** – an Express compatible renderer, eg. from consolidate.js
* **options.templateExtension** – eg "ejs", used for template discovery
* **options.elementTypes** – like the **elementTypes** on Tema. If set it overrides any **elementTypes** from the parent, but the one from the Tema object will still always be applied before these ones are applied.

Both preprocessors and processors can add template suggestions to a "templateSuggestions" variable that should be an array. It's a first in last out concept so the last template suggestion is the template that Tema will try to find first. Template suggestions are prioritized over theme overrides so if a later template suggestion exist in a parent, but an earlier template suggestion exists in the child, then the parent template will still be the one that is selected. Sounds hard? Well, it is a bit complicated – but only use it if you need it. Drupal has shown this to be a powerful concept at a scale.

## Default template methods / locals

* **block(key[, value])** – will set a value within the current rendering context that will be shared with any rendering contexts above it (though not with any of the siblings, in the case of recursive rendering, if the template is rendered as one of many children templates in a recursive rendering). If *value* is a javascript boolean or object – array or plain object – then it will replace any existing value of the key. Otherwise the value will get appended to the existing key value. If *value* is undefined, then the value of the key will be returned. If the *value* to return is an array, then its values will be joined together. This method is useful in eg the recursive rendering scenario as it enables child templates and template wrappers to send info about eg. CSS and JS files or page titles upwards to template wrappers higher in the hierarchy.

## Recursive rendering

Inspired by `drupal_render()` this enables a full HTML-page (or just a part of it) to be constructed from a set of components, each which can be rendered asyncronously and then assembled together and wrapped within each other. Child templates (and their preprocessors/processors) can also set values in "blocks" through the `block()` method that is merged with their parents contexts so that a parents template wrapper can eg. include CSS and JS tags added from child templates.

### Excerpt from 'examples/recursive.js'

```javascript
temaInstance.recursiveRenderer({
  templateWrappers : ['page'],
  children : [
    { type: 'title', value: 'Hi' },
    { type: 'subtitle', value: 'Welcome!' }
  ]
})
  .then(result => {
    // Do something
  });
```

### Element attributes

Apart from these predefined attributes any attributes can be added and will be treated as normal variables. Predefined attributes can also be defined in the **elementTypes** option of the Thema engine and themes and these will be merged into the element overriding any of its attributes.

* **type** – the predefined type to inherit attributes from
* **template** – a template to render as the content of the element, using Tema's `render()`
* **children** – an array of children element to render as the content of the element. If **template** is defined then it is up to that template to render these children element instead.
* **preRenders** – an array of functions that is called before the content is rendered
* **templateWrappers** – an array of templates which will be rendered with the element content as its variable. Will have access to data that any child has added using `block()`
* **postRenders** – an array of functions that is called after the content is rendered and wrapped and which is sent the content
* **prefix** – a string that is prepended to the final content before it is returned
* **suffix** – a string that is appended to the final content before it is returned
