'use strict';

const util = require('util');

const _ = require('lodash');
const extend = require('backbone-extend-standalone');
const LRU = require('lru-cache');
const recursiveReaddir = require('recursive-readdir');
const readFile = util.promisify(require('fs').readFile);

// TODO: Caching would be kind of nice for performance and such you know – especially for the file operations

const Tema = function (options) {
  this.options = {
    path: './',
    defaultToPlain: true,
    locals: {},
    cache: false
  };

  this.option(options || {});
};

Tema.extend = extend;

Tema.prototype.rebuildTheme = function () {
  if (!this.theme) { return; }
  this.setTheme(Object.getPrototypeOf(this.theme));
};

Tema.prototype.setTheme = function (theme) {
  let parentTheme;

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

  if (this.options.defaultTheme) {
    parentTheme = Object.create(this.options.defaultTheme);

    this.themeTree[0].parent = parentTheme;
    this.themeTree.unshift(parentTheme);
  }

  this.themeTree.forEach(theme => {
    theme.options = Object.assign({}, theme.parent ? theme.parent.options : {}, theme.options || {});
    theme.locals = Object.assign({}, theme.parent ? theme.parent.locals : {}, theme.locals || {});

    if (theme.publicPath) {
      this.publicPaths.unshift(theme.publicPath + (theme.publicPath.substr(-1) !== '/' ? '/' : ''));
    }

    if (theme.initializeTheme) {
      theme.initializeTheme(this);
    }
  });
};

Tema.prototype.templateFileExists = function (theme, template) {
  let templatePath = theme.templatePath;
  let result;

  template = template.replace('_', '-') + '.' + (theme.options.templateExtension || 'html');

  result = this.getCache(['template', theme.templatePath, template]);

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

    result = recursiveReaddir(templatePath).then(files => {
      files.sort((fileA, fileB) => {
        const fileADepth = fileA.split('/').length;
        const fileBDepth = fileB.split('/').length;

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

      this.setCache(['templateFiles', theme.templatePath], files);

      return files;
    });
  }

  return result.then(files => {
    const length = template.length;

    let file;

    file = files.find(file => {
      const i = file.lastIndexOf(template);
      return i !== -1 && file.length === i + length && file.substr(i - 1, 1) === '/';
    });

    this.setCache(['template', theme.templatePath, template], file === undefined ? false : file);

    return file;
  });
};

Tema.prototype.findTemplate = function (options) {
  const templateSuggestions = [options.template];
  const variables = options.variables || {};

  let suggestionsLeft;
  let themesLeft = 0;

  (variables.templateSuggestions || []).forEach(suggestion => {
    templateSuggestions.push(suggestion);
  });

  suggestionsLeft = templateSuggestions.length;

  return new Promise((resolve, reject) => {
    const checkNextSuggestion = () => {
      let template, theme;

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
        this.templateFileExists(theme, template).then(templatePath => {
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
    };

    checkNextSuggestion();
  });
};

Tema.prototype.defaultRenderer = function (file, variables) {
  return readFile(file, 'utf-8')
    .then(data => {
      if (this.options.defaultToPlain) {
        return data;
      }
      return _.template(data)(variables);
    });
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
      return (Array.isArray(context[key]) && !_.isObject(context[key][0])) ? context[key].join('') : context[key];
    }
  };
};

Tema.prototype.renderTemplate = function (options) {
  const variables = Object.assign(
    {},
    options.variables,
    this.options.locals,
    options.theme.locals
  );

  variables.block = this.contextMethod(options.context);
  delete options.context;

  if (_.isFunction(options.toRender)) {
    return (options.toRender.bind(this))(variables);
  } else {
    return (options.theme.options.renderer || this.defaultRenderer).call(this, options.toRender, variables);
  }
};

Tema.prototype.preprocess = function (template, variables, context) {
  context = _.isPlainObject(context) ? context : {};
  variables = _.isPlainObject(variables) ? _.cloneDeep(variables) : {};

  let promiseChain = Promise.resolve({
    template: template,
    variables: Object.assign({}, variables, variables.variables || {}, {
      block: this.contextMethod(context)
    })
  });

  this.themeTree.forEach(theme => {
    if (theme.preprocessor) {
      promiseChain = promiseChain.then(util.promisify(theme.preprocessor.bind(this)));
    }
  });
  this.themeTree.forEach(theme => {
    if (theme.preprocessors && theme.preprocessors[template]) {
      promiseChain = promiseChain.then(data => data.variables)
        .then(util.promisify(theme.preprocessors[template].bind(this)))
        .then(variables => ({ template: template, variables: variables }));
    }
  });
  this.themeTree.forEach(theme => {
    if (theme.processor) {
      promiseChain = promiseChain.then(util.promisify(theme.processor.bind(this)));
    }
  });
  this.themeTree.forEach(theme => {
    if (theme.processors && theme.processors[template]) {
      promiseChain = promiseChain.then(data => data.variables)
        .then(util.promisify(theme.processors[template].bind(this)))
        .then(variables => ({ template, variables }));
    }
  });

  promiseChain = promiseChain.then(options => {
    options.context = context;
    return options;
  });

  return promiseChain;
};

Tema.prototype.render = function (template, variables, context) {
  return this.preprocess(template, variables, context)
    .then(result => this.findTemplate(result))
    .then(result => this.renderTemplate(result));
};

Tema.prototype.option = function (key, value) {
  if (_.isPlainObject(key)) {
    _.each(_.omit(key, 'theme'), (value, key) => {
      this.option(key, value);
    });

    // Themes might need to look at the other options that are set – such as cache – so it needs to be set last
    if (key.theme) { this.option('theme', key.theme); }

    return this;
  } else if (value === undefined) {
    return key === 'theme' ? this.theme : this.options[key];
  }

  if (key === 'theme') {
    this.setTheme(value);
  } else {
    this.options[key] = value;
    this.initOption(key, value);
  }

  return this;
};

Tema.prototype.initOption = function (key, value) {
  if (key === 'defaultTheme') {
    this.rebuildTheme();
  } else if (key === 'cache') {
    if (value) {
      this.cache = new LRU(Object.assign({
        max: 500,
        length: item => Array.isArray(item) ? item.length : 1
      },
      _.isPlainObject(value)
        ? value
        : (_.isNumber(value) ? { max: value } : {})
      ));
    } else {
      this.cache = false;
    }
  }
};

Tema.prototype.formatCacheKey = function (key) {
  if (Array.isArray(key)) {
    key = key.join('::');
  }
  return key;
};

Tema.prototype.getCache = function (key) {
  return this.cache ? this.cache.get(this.formatCacheKey(key)) : undefined;
};

Tema.prototype.setCache = function (key, value) {
  if (this.cache) {
    this.cache.set(this.formatCacheKey(key), value);
  }
};

Tema.prototype.getPublicPaths = function () {
  return this.publicPaths;
};

Tema.prototype.getThemeInstance = function (theme) {
  let result = false;

  for (let i = 0, length = this.themeTree.length; i < length; i += 1) {
    if (theme.isPrototypeOf(this.themeTree[i])) {
      result = this.themeTree[i];
      break;
    }
  }

  return result;
};

Tema.prototype.getLocals = function (theme) {
  theme = theme ? this.getThemeInstance(theme) : false;

  return Object.assign(
    {},
    this.options.locals,
    theme ? theme.locals : {}
  );
};

module.exports = Tema;
