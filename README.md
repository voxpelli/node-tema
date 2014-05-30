# Tema

An asynchronous node.js theme layer that adds the notion of themes and sub-themes on top of your template rendering engine.
Inspired by Drupal and brings eg. the preprocess methods from there.

## Usage

Simple:

```javascript
var Tema = require('tema')
  , coolTheme = {
    templatePath : 'coolTheme/'
  }
  , temaInstance;

temaInstance = new Tema({
  theme : coolTheme,
  defaultToPlain : false // Makes it so that templates by default render using the simple template engine in lodash
});

temaInstance.render('foo', { title : 'Bar' }, function (err, result) {
  // The rendered result of ./coolTheme/foo.html is now ready to act on
});
```

Advanced:

```javascript
var Tema = require('tema')
  , parentTheme = {
    templatePath : 'parentTheme/',
    processors : {
      foo: function (options, callback) {
        options.variables.subtitle = 'Yet Another';
        callback(null, options);
      }
    }
  }
  , childTheme = {
    parent : parentTheme,
    templatePath : 'childTheme/',
    defaultToPlain : false,
    processors : {
      foo: function (options, callback) {
        options.variables.subtitle += 'Cool Subtitle';
        callback(null, options);
      }
    }
  }
  , temaInstance;

temaInstance = new Tema({
  theme : childTheme
});

temaInstance.render('foo', { title : 'Bar' }, function (err, result) {
  // The rendered result of ./coolTheme/foo.html is now ready to act on
  // If the file contained just '<%= title %>: <%= subtitle %>', the result would be:
  // 'Bar: Yeat Another Cool Subtitle '
});
```

## Methods of Tema instances

* **render(template[, variables], callback)** – renders a simple template – preprocessing and processing the data and then discovering the template file or method and if a file, rendering that file with the theme's rendering engine or the default one
* **recursiveRenderer(element, callback)** – is sent a collection of element and child elements, which it processes asynchronously to form a final rendered result. This is a lot like `drupal_render()` and enables eg. a full HTML-page to be constructed without the templates themselves or their preprocessors/processors needing to know what subtemplates to render. Types can also be set up with defaults to make certain repeatable elements on a page easier to add, like eg. form elements.

### Promises

* **renderPromise** – promises are used internally so you can hook directly in to that if you want and skip the callback
* **recursiveRendererPromise** – same as previous one but for **recursiveRenderer**

## Advanced Tema options

* **theme** - the object of the active theme.
* **path** - the path to which all theme paths are relative.
* **defaultToPlain** – defaults to true. If it is instead set to false the defeault renderer will be the lodash template engine rather than just one returning the content of a file template without any processing.
* **locals** – object of variables/methods that will be made available to the templates. Will override any template variables with the same name. Used to extend the templates with more methods.
* **elementTypes** – an object with a collection of predefined types. Used for the recursiveRendering()-feature.

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

## Recursive rendering

Inspired by `drupal_render()` this enables a full HTML-page (or just a part of it) to be constructed from a set of components, each which can be rendered asyncronously and then assembled together and wrapped within each other. Child templates (and their preprocessors/processors) can also set values in "blocks" through a `block()` variable that is merged with their parents contexts so that a parents template wrapper can eg. include CSS and JS tags added from child templates.

### Excerpt from 'examples/recursive.js'

```javascript
temaInstance.recursiveRenderer({
  templateWrappers : ['page'],
  children : [
    { type: 'title', value: 'Hi' },
    { type: 'subtitle', value: 'Welcome!' }
  ]
}, function (err, result) {
});
```

### Element attributes

Apart from these predefined attributes any attributes can be added and will be treated as normal variables. Predefined attributes can also be defined in the **elementTypes** option of the Thema engine and themes and these will be merged into the element overriding any of its attributes.

* **type** – the predefined type to inherit attributes from
* **theme** – a template to render as the content of the element, using Tema's `render()`
* **children** – an array of children element to render as the content of the element. If **theme** is defined then it is up to that template to render these children element instead.
* **preRenders** – an array of functions that is called before the content is rendered
* **templateWrappers** – an array of templates which will be rendered with the element content as its variable. Will have access to data that any child has added using `block()`
* **postRenders** – an array of functions that is called after the content is rendered and wrapped and which is sent the content
* **prefix** – a string that is prepended to the final content before it is returned
* **suffix** – a string that is appended to the final content before it is returned

## Changelog

### 0.1.0

* Initial version!
