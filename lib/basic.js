/* jshint node: true */
/* global -Promise */

'use strict';

var _ = require('lodash')
  , extend = require('backbone-extend-standalone')
  , LRU = require('lru-cache')
  , Promise = require('promise')
  , recursiveReaddir = Promise.denodeify(require('recursive-readdir'))
  , readFile = Promise.denodeify(require('fs').readFile)
  , Tema;

//TODO: Caching would be kind of nice for performance and such you know – especially for the file operations

Tema = function (options) {
  this.options = {
    path : './',
    defaultToPlain : true,
    locals : {},
    cache : false
  };

  this.option(options || {});
};

Tema.extend = extend;

Tema.prototype.setTheme = function (theme) {
  var parentTheme;

  this.theme = Object.create(theme);
  this.themeTree = [this.theme];
  this.publicPaths = [];

  parentTheme = theme.parent;
  while (parentTheme) {
    this.themeTree.unshift(Object.create(parentTheme));
    parentTheme = parentTheme.parent;

    if (parentTheme && this.getThemeInstance(parentTheme) !== false) {
      delete this.themeTree[0].parent;
      console.warn('Circular theme parents found, skipping parent');
      break;
    }
  }

  _.each(this.themeTree, function (theme) {
    theme.options = _.extend({}, theme.parent ? theme.parent.options : {}, theme.options || {});
    theme.locals = _.extend({}, theme.parent ? theme.parent.locals : {}, theme.locals || {});

    if (theme.publicPath) {
      this.publicPaths.unshift(theme.publicPath + (theme.publicPath.substr(-1) !== '/' ? '/' : ''));
    }

    if (theme.initializeTheme) {
      theme.initializeTheme(this);
    }
  }.bind(this));
};

Tema.prototype.templateFileExists = function (theme, template) {
  var temaInstance = this
    , templatePath = theme.templatePath
    , result;

  template = template.replace('_', '-') + '.' + (theme.options.templateExtension || 'html');

  result = temaInstance.getCache(['template', theme.templatePath, template]);

  if (result !== undefined) {
    return Promise.resolve(result);
  }

  result = this.getCache(['templateFiles', theme.templatePath]);

  if (result) {
    result = Promise.resolve(result);
  } else {
    if (templatePath[0] !== '/') {
      templatePath = this.options.path + templatePath;
    }

    result = recursiveReaddir(templatePath).then(function (files) {
      files.sort(function (fileA, fileB) {
        var fileADepth = fileA.split('/').length
          , fileBDepth = fileB.split('/').length;

        // Sort folders last
        if (fileADepth > fileBDepth) {
          return 1;
        }
        if (fileADepth < fileBDepth) {
          return -1;
        }
        if (fileA > fileB) {
          return 1;
        }
        if (fileA < fileB) {
          return -1;
        }
        return 0;
      });

      temaInstance.setCache(['templateFiles', theme.templatePath], files);

      return files;
    });
  }

  return result.then(function (files) {
    var length = template.length
      , file;

    file = _.find(files, function (file) {
      var i = file.lastIndexOf(template);
      return i !== -1 && file.length === i + length && file.substr(i - 1, 1) === '/';
    });

    temaInstance.setCache(['template', theme.templatePath, template], file === undefined ? false : file);

    return file;
  });
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
          reject(new Error('No template found for ' + options.template));
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
          if (templatePath) {
            options.theme = theme;
            options.toRender = templatePath;
            resolve(options);
          } else {
            setImmediate(checkNextSuggestion);
          }
        }, checkNextSuggestion);
      } else {
        setImmediate(checkNextSuggestion);
      }
    }.bind(this);

    checkNextSuggestion();
  }.bind(this));
};

Tema.prototype.defaultRenderer = function (file, variables, callback) {
  return readFile(file, 'utf-8')
    .then(function (data) {
      if (this.options.defaultToPlain) {
        return data;
      }
      return _.template(data)(variables);
    }.bind(this))
    .nodeify(callback);
};

Tema.prototype.contextMethod = function (context) {
  return function (key, value, override) {
    if (!_.isUndefined(value)) {
      if (override || _.isUndefined(context[key]) || _.isObject(value) || _.isBoolean(value)) {
        context[key] = _.isObject(value) ? value : [value];
      } else {
        context[key].push(value);
      }
    } else {
      return (_.isArray(context[key]) && !_.isObject(context[key][0])) ? context[key].join('') : context[key];
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
    return Promise.denodeify(options.toRender.bind(this))(variables);
  } else {
    return Promise.denodeify(options.theme.options.renderer || this.defaultRenderer).call(this, options.toRender, variables);
  }
};

Tema.prototype.preprocess = function (template, variables, context) {
  context = _.isPlainObject(context) ? context : {};
  variables = _.isPlainObject(variables) ? _.cloneDeep(variables) : {};

  var promiseChain = Promise.resolve({
        template : template,
        variables : _.extend({}, variables, variables.variables || {}, {
          block : this.contextMethod(context)
        })
      })
    , temaInstance = this;

  _.each(this.themeTree, function (theme) {
    if (theme.preprocessor) {
      promiseChain = promiseChain.then(Promise.denodeify(theme.preprocessor.bind(temaInstance)));
    }
  });
  _.each(this.themeTree, function (theme) {
    if (theme.preprocessors && theme.preprocessors[template]) {
      promiseChain = promiseChain.then(function (data) {
        return data.variables;
      })
      .then(Promise.denodeify(theme.preprocessors[template].bind(temaInstance)))
      .then(function (variables) {
        return { template : template, variables : variables };
      });
    }
  });
  _.each(this.themeTree, function (theme) {
    if (theme.processor) {
      promiseChain = promiseChain.then(Promise.denodeify(theme.processor.bind(temaInstance)));
    }
  });
  _.each(this.themeTree, function (theme) {
    if (theme.processors && theme.processors[template]) {
      promiseChain = promiseChain.then(function (data) {
        return data.variables;
      })
      .then(Promise.denodeify(theme.processors[template].bind(temaInstance)))
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

Tema.prototype.render = Promise.nodeify(function (template, variables, context) {
  return this.preprocess(template, variables, context)
    .then(this.findTemplate.bind(this))
    .then(this.renderTemplate.bind(this));
});

Tema.prototype.option = function (key, value) {
  if (value !== undefined) {
    if (key === 'theme') {
      this.setTheme(value);
    } else {
      this.options[key] = value;
    }

    this.initOption(key, value);
  } else if (_.isPlainObject(key)) {
    var theme = key.theme;

    _.each(_.omit(key, 'theme'), function (value, key) {
      this.option(key, value);
    }.bind(this));

    // Themes might need to look at the other options that are set – such as cache – so it needs to be set last
    if (theme) {
      this.option('theme', theme);
    }
  } else {
    return key === 'theme' ? this.theme : this.options[key];
  }
  return this;
};

Tema.prototype.initOption = function (key, value) {
  if (key === 'cache') {
    if (value) {
      this.cache = new LRU(_.extend({
          max: 500,
          length: function (item) {
            return _.isArray(item) ? item.length : 1;
          }
        },
        _.isPlainObject(value) ?
          value :
          (_.isNumber(value) ? { max : value } : {})
      ));
    } else {
      this.cache = false;
    }
  }
};

Tema.prototype.getCache = function (key) {
  return this.cache ? this.cache.get(key) : undefined;
};

Tema.prototype.setCache = function (key, value) {
  if (this.cache) {
    if (_.isArray(key)) {
      key = key.join('::');
    }
    this.cache.set(key, value);
  }
};

Tema.prototype.getPublicPaths = function () {
  return this.publicPaths;
};

Tema.prototype.getThemeInstance = function (theme) {
  var i, length = this.themeTree.length, result = false;

  for (i = 0; i < length; i += 1) {
    if (theme.isPrototypeOf(this.themeTree[i])) {
      result = this.themeTree[i];
      break;
    }
  }

  return result;
};

Tema.prototype.getLocals = function (theme) {
  theme = theme ? this.getThemeInstance(theme) : false;

  return _.extend(
    {},
    this.options.locals,
    theme ? theme.locals : {}
  );
};

module.exports = Tema;
