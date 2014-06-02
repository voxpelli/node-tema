"use strict";

var _ = require('lodash')
  , extend = require('backbone-extend-standalone')
  , glob = require('glob')
  , Promise = require('promise')
  , fs = require('fs')
  , Tema;

//TODO: Caching would be kind of nice for performance and such you know – especially for the file operations

Tema = function (options) {
  this.options = {
    path : './',
    defaultToPlain : true,
    locals : {}
  };

  this.option(options || {});
};

Tema.extend = extend;

Tema.prototype.setTheme = function (theme) {
  var parentTheme;

  this.theme = theme;
  this.themeTree = [theme];
  this.publicPaths = [];

  parentTheme = theme.parent;
  while (parentTheme) {
    this.themeTree.unshift(parentTheme);
    parentTheme = parentTheme.parent;

    if (this.themeTree.indexOf(parentTheme) !== -1) {
      console.warn('Circular theme parents found, skipping parent');
      break;
    }
  }

  _.each(this.themeTree, function (theme) {
    theme.options = _.extend({}, theme.parent ? theme.parent.options : {}, theme.options || {});
    theme.locals = _.extend({}, theme.parent ? theme.parent.locals : {}, theme.locals || {});

    if (theme.publicPath) {
      this.publicPaths.unshift(theme.publicPath);
    }
  }.bind(this));
};

Tema.prototype.templateFileExists = function (theme, template) {
  var templatePath = theme.templatePath + '**/' + template.replace('_', '-') + '.' + (theme.options.templateExtension || 'html');

  if (templatePath[0] !== '/') {
    templatePath = this.options.path + templatePath;
  }

  return new Promise(function (resolve, reject) {
    glob(templatePath, function (err, files) {
      if (files[0]) {
        resolve(files[0]);
      } else {
        reject(err || true);
      }
    });
  }.bind(this));
};

Tema.prototype.findTemplate = function (options) {
  var templateSuggestions = [options.template]
    , suggestionsLeft
    , themesLeft = 0;

  _.each(options.variables.templateSuggestions || [], function (suggestion) {
    templateSuggestions.push(suggestion);
  });

  suggestionsLeft = templateSuggestions.length;

  return new Promise(function (resolve, reject) {
    var checkNextSuggestion = function () {
      var template, theme;

      themesLeft -= 1;

      if (themesLeft < 0) {
        themesLeft = this.themeTree.length - 1;
        suggestionsLeft -= 1;
        if (suggestionsLeft < 0) {
          reject(new Error('No template found'));
          return;
        }
      }

      template = templateSuggestions[suggestionsLeft];
      theme = this.themeTree[themesLeft];

      if (theme.templates && theme.templates[template]) {
        options.theme = theme;
        options.toRender = theme.templates[template];
        resolve(options);
      } else if (theme.templatePath) {
        this.templateFileExists(theme, template).then(function (templatePath) {
          options.theme = theme;
          options.toRender = templatePath;
          resolve(options);
        }, checkNextSuggestion);
      } else {
        setImmediate(checkNextSuggestion);
      }
    }.bind(this);

    checkNextSuggestion();
  }.bind(this));
};

Tema.prototype.defaultRenderer = function (file, variables, callback) {
  return Promise.denodeify(fs.readFile)(file, 'utf-8')
    .then(function (data) {
      if (this.options.defaultToPlain) {
        return data;
      }
      return _.template(data, variables);
    }.bind(this))
    .nodeify(callback);
};

Tema.prototype.contextMethod = function (context) {
  return function (key, value, override) {
    if (!_.isUndefined(value)) {
      if (override || _.isUndefined(context[key]) || _.isObject(value)) {
        context[key] = _.isObject(value) ? value : [value];
      } else {
        context[key].push(value);
      }
    } else {
      return _.isArray(context[key]) ? context[key].join('') : context[key];
    }
  };
};

Tema.prototype.renderTemplate = function (options) {
  var variables = _.extend(
    {},
    options.variables,
    this.options.locals,
    options.theme.locals
  );

  variables.block = this.contextMethod(options.context);
  delete options.context;

  if (_.isFunction(options.toRender)) {
    return Promise.denodeify(options.toRender)(variables);
  } else {
    return Promise.denodeify(options.theme.options.renderer || this.defaultRenderer).call(this, options.toRender, variables);
  }
};

Tema.prototype.preprocess = function (template, variables, context) {
  context = _.isPlainObject(context) ? context : {};
  variables = _.isPlainObject(variables) ? variables : {};

  var promiseChain = Promise.resolve({
    template : template,
    variables : _.extend({}, variables, variables.variables || {}, {
      block : this.contextMethod(context)
    })
  });

  _.each(this.themeTree, function (theme) {
    if (theme.preprocessor) {
      promiseChain = promiseChain.then(Promise.denodeify(theme.preprocessor));
    }
  });
  _.each(this.themeTree, function (theme) {
    if (theme.preprocessors && theme.preprocessors[template]) {
      promiseChain = promiseChain.then(function (data) {
        return data.variables;
      })
      .then(Promise.denodeify(theme.preprocessors[template]))
      .then(function (variables) {
        return { template : template, variables : variables };
      });
    }
  });
  _.each(this.themeTree, function (theme) {
    if (theme.processor) {
      promiseChain = promiseChain.then(Promise.denodeify(theme.processor));
    }
  });
  _.each(this.themeTree, function (theme) {
    if (theme.processors && theme.processors[template]) {
      promiseChain = promiseChain.then(function (data) {
        return data.variables;
      })
      .then(Promise.denodeify(theme.processors[template]))
      .then(function (variables) {
        return { template : template, variables : variables };
      });
    }
  });

  promiseChain = promiseChain.then(function (options) {
    options.context = context;
    return options;
  });

  return promiseChain;
};

Tema.prototype.renderPromise = function (template, variables, context) {
  return this.preprocess(template, variables, context)
    .then(this.findTemplate.bind(this))
    .then(this.renderTemplate.bind(this));
};

Tema.prototype.render = Promise.nodeify(Tema.prototype.renderPromise);

Tema.prototype.option = function (key, value) {
  if (value !== undefined) {
    if (key === 'theme') {
      this.setTheme(value);
    } else {
      this.options[key] = value;
    }
  } else if (_.isPlainObject(key)) {
    _.each(key, function (value, key) {
      this.option(key, value);
    }.bind(this));
  } else {
    return key === 'theme' ? this.theme : this.options[key];
  }
  return this;
};

Tema.prototype.getPublicPaths = function () {
  return this.publicPaths;
};

module.exports = Tema;
