"use strict";

var _ = require('lodash')
  , Promise = require('promise')
  , Tema = require('./basic')
  , Extended
  , recursiveRendererPromise;

recursiveRendererPromise = function (element) {
  var result = Promise.resolve(element);

  element.renderContext = _.isPlainObject(element.renderContext) ? element.renderContext : {};

  //TODO: Clone the element initialy to avoid changes to leak?
  //TODO: Stop the element from being printed twice?
  //TODO: Add awesome caching capabilities?

  if (element.type) {
    // Element types can be defined from the outside, by eg. modules, registering it to the theme
    if (this.options.elementTypes[element.type]) {
      element = _.extend(element, this.options.elementTypes[element.type]);
    }
    // And also be assigned or overriden from within a theme
    if (this.theme.options.elementTypes && this.theme.options.elementTypes[element.type]) {
      element = _.extend(element, this.theme.options.elementTypes[element.type]);
    }
  }

  _.each(element.preRenders || [], function (preRender) {
    result = result.then(Promise.denodeify(preRender));
  });

  result = result.then(function (elementArg) {
      element = elementArg;

      var renderables = [];

      if (element.template) {
        renderables.push(this.renderPromise(element.template, element, element.renderContext));
      } else {
        //TODO: Sort children by weight before you iterate!
        _.each(element.children || [], function (child) {
          renderables.push(this.recursiveRenderer(child));
        }.bind(this));
      }

      return Promise.all(renderables);
    }.bind(this))
  .then(function (content) {
      _.each(element.children, function (child) {
        _.merge(element.renderContext, child.renderContext || {});
      });
      return content.join('');
    }, function () {
      return '';
    })
  .then(function (content) {
      var contentPromise = Promise.resolve(content);

      _.each(element.templateWrappers || [], function (templateWrapper) {
        var input;

        contentPromise = contentPromise.then(function (content) {
          input = content;
          return this.renderPromise(templateWrapper, {
            element : element,
            content : content
          }, element.renderContext)
          // Below ensures that a missing template amongst the wrappers will fail silently
          .then(function (content) { return content; }, function () { return input; });
        }.bind(this));
      }.bind(this));

      _.each(element.postRenders || [], function (postRender) {
        contentPromise = contentPromise.then(Promise.denodeify(postRender.bind(element)));
      });

      return contentPromise;
    }.bind(this))
  .then(function (content) {
    return (element.prefix || '') + content + (element.suffix || '');
  });

  return result;
};

Extended = Tema.extend({
  constructor : function () {
    Tema.apply(this, arguments);

    this.options.elementTypes = this.options.elementTypes || [];
  },
  elementType : function (type, options) {
    if (options) {
      this.options.elementTypes[type] = options;
      return this;
    }
    return this.options.elementTypes[type];
  },
  recursiveRendererPromise : recursiveRendererPromise,
  recursiveRenderer : Promise.nodeify(recursiveRendererPromise)
});

module.exports = Extended;
