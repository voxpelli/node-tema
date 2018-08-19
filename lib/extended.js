'use strict';

const _ = require('lodash');
const Tema = require('./basic');

const recursiveRenderer = function (element) {
  let result = Promise.resolve(element);

  element.renderContext = _.isPlainObject(element.renderContext) ? element.renderContext : {};

  // TODO: Clone the element initialy to avoid changes to leak?
  // TODO: Stop the element from being printed twice?
  // TODO: Add awesome caching capabilities?

  if (element.type) {
    // Element types can be defined from the outside, by eg. modules, registering it to the theme
    if (this.options.elementTypes[element.type]) {
      element = Object.assign(element, this.options.elementTypes[element.type]);
    }
    // And also be assigned or overriden from within a theme
    if (this.theme.options.elementTypes && this.theme.options.elementTypes[element.type]) {
      element = Object.assign(element, this.theme.options.elementTypes[element.type]);
    }
  }

  // Ensure that all properties that should be arrays, are arrays
  ['preRenders', 'templateWrappers', 'children', 'postRenders'].forEach(property => {
    if (element[property]) {
      element[property] = _.isArray(element[property]) ? element[property] : [element[property]];
    } else {
      element[property] = [];
    }
  });

  result = (element.preRenders || []).reduce((currentResult, preRender) => currentResult.then(preRender), result);

  result = result.then(elementArg => {
    element = elementArg;

    const renderables = [];

    if (element.template) {
      renderables.push(this.render(element.template, element, element.renderContext));
    } else {
      // TODO: Sort children by weight before you iterate!
      (element.children || []).forEach(child => {
        renderables.push(this.recursiveRenderer(child));
      });
    }

    return Promise.all(renderables);
  })
    .then(content => {
      (element.children || []).forEach(child => {
        _.merge(element.renderContext, child.renderContext || {}, (destination, source) => {
          if (_.isArray(destination) && _.isArray(source)) {
            return destination.concat(source);
          }
        });
      });

      return content.join('');
    }, err => {
      // TODO: Improve error message!
      console.warn(err);
      return '';
    })
    .then(content => {
      let contentPromise = Promise.resolve(content);

      (element.templateWrappers || []).forEach(templateWrapper => {
        let input;

        contentPromise = contentPromise.then(content => {
          input = content;
          return this.render(templateWrapper, Object.assign({}, element.variables || {}, {
            element: element,
            content: content
          }), element.renderContext)
            // Below ensures that a missing template amongst the wrappers will fail silently
            .catch(err => {
              // TODO Improve error!
              console.warn(err);
              return input;
            });
        });
      });

      (element.postRenders || []).forEach(postRender => {
        contentPromise = contentPromise.then(postRender.bind(element));
      });

      return contentPromise;
    })
    .then(content => (element.prefix || '') + content + (element.suffix || ''));

  return result;
};

const Extended = Tema.extend({
  constructor: function () {
    Tema.apply(this, arguments);

    this.options.elementTypes = this.options.elementTypes || [];
  },
  elementType: function (type, options) {
    if (options) {
      this.options.elementTypes[type] = options;
      return this;
    }
    return this.options.elementTypes[type];
  },
  recursiveRenderer
});

module.exports = Extended;
