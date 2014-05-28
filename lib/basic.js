"use strict";

var _ = require('lodash')
  , extend = require('backbone-extend-standalone')
  , glob = require('glob')
  , Promise = require('promise')
  , fs = require('fs')
  , Tema;

//TODO: Caching would be kind of nice for performance and such you know – especially for the file operations

Tema = function (options) {
  var parentTheme;

  options = _.extend({
    path : './',
    defaultToPlain : true,
    locals : {}
  }, options);

  this.options = options;
  this.theme = options.theme;
  this.themeTree = [this.theme];
  this.publicPaths = [];

  parentTheme = options.theme.parent;
  while (parentTheme) {
    this.themeTree.unshift(parentTheme);
    parentTheme = parentTheme.parent;
  }

  _.each(this.themeTree, function (theme) {
    theme.options = _.extend({}, theme.parent ? theme.parent.options : {}, theme.options || {});
    theme.locals = _.extend({}, theme.parent ? theme.parent.locals : {}, theme.locals || {});

    if (theme.publicPath) {
      this.publicPaths.unshift(theme.publicPath);
    }
  }.bind(this));
};

Tema.extend = extend;

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
        context[key] = value;
      } else {
        context[key] += value;
      }
    } else {
      return context[key];
    }
  };
};

Tema.prototype.renderTemplate = function (options) {
  options.variables.block = this.contextMethod(options.context);
  delete options.context;

  _.extend(options.variables, this.options.locals, options.theme.locals);

  if (_.isFunction(options.toRender)) {
    return Promise.denodeify(options.toRender)(options.variables);
  } else {
    return Promise.denodeify(options.theme.options.renderer || this.defaultRenderer).call(this, options.toRender, options.variables);
  }
};

Tema.prototype.preprocess = function (template, variables, context) {
  var options, promiseChain, process;

  context = _.isPlainObject(context) ? context : {};

  options = {
    template : template,
    //TODO: We should make sure that we are consistently shielding input variables from manipulation leaks
    variables : Object.create(_.isPlainObject(variables) ? variables : {})
  };

  options.block = this.contextMethod(context);

  promiseChain = Promise.resolve(options);

  process = function (processor) {
    promiseChain = promiseChain.then(Promise.denodeify(processor));
  };

  _.each(this.themeTree, function (theme) {
    if (theme.preprocessor) {
      process(theme.preprocessor);
    }
  });
  _.each(this.themeTree, function (theme) {
    if (theme.preprocessors && theme.preprocessors[template]) {
      process(theme.preprocessors[template]);
    }
  });
  _.each(this.themeTree, function (theme) {
    if (theme.processor) {
      process(theme.processor);
    }
  });
  _.each(this.themeTree, function (theme) {
    if (theme.processors && theme.processors[template]) {
      process(theme.processors[template]);
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
    this.options[key] = value;
    return this;
  }
  return this.options[key];
};

Tema.prototype.getPublicPaths = function () {
  return this.publicPaths;
};

module.exports = Tema;
