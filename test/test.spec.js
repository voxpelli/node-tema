/* global beforeEach, afterEach, describe, it */

'use strict';

const assert = require('assert');
const sinon = require('sinon');
const mockFs = require('mock-fs');
const Tema = require('../');

describe('Tema', () => {
  let temaComplex, temaSimple, simpleCallback, advancedCallback, subTheme, parentTheme;

  beforeEach(() => {
    simpleCallback = function (data, callback) {
      data = Object.assign({}, data);
      let variables = data;
      if (data.template) {
        variables = data.variables = Object.assign({}, data.variables);
      }

      variables.order = variables.order ? variables.order + 1 : 1;
      callback(null, data);
    };

    advancedCallback = function (data, callback) {
      simpleCallback(data, (err, data) => {
        data = Object.assign({}, data);
        let variables = data;
        if (data.template) {
          variables = data.variables = Object.assign({}, data.variables);
        }

        variables.templateSuggestions = variables.templateSuggestions || [];
        variables.templateSuggestions.push('bar_foo_' + variables.order);
        callback(err, data);
      });
    };

    parentTheme = {
      name: 'parent',
      templatePath: 'parentTheme/',
      publicPath: 'parentTheme/public/',
      preprocessor: simpleCallback,
      processor: simpleCallback,
      preprocessors: {
        'foo_bar': advancedCallback
      },
      processors: {
        'foo_bar': simpleCallback
      }
    };

    subTheme = {
      name: 'child',
      parent: parentTheme,
      templatePath: 'subTheme/',
      publicPath: 'subTheme/public/',
      preprocessor: simpleCallback,
      processor: simpleCallback,
      preprocessors: {
        'foo_bar': simpleCallback
      },
      processors: {
        'foo_bar': simpleCallback
      },
      options: {}
    };

    temaComplex = new Tema({
      theme: subTheme
    });

    temaSimple = new Tema({
      theme: {
        templatePath: 'simpleTheme/'
      }
    });

    mockFs({
      'parentTheme/foo-bar.html': 'abc123',
      'simpleTheme/foo-bar.html': 'xyz789'
    });
  });

  afterEach(() => {
    mockFs.restore();
    sinon.restore();
  });

  describe('constructor', () => {
    it('should inherit renderer', () => {
      const func = () => {};

      parentTheme.options = { renderer: func };

      const temaNew = new Tema({ theme: subTheme });

      assert.strictEqual(temaNew.theme.options.renderer, func);
    });

    it('should be able to overload renderer', () => {
      const func = () => {};
      const func2 = () => { console.log('wow'); };

      parentTheme.options = { renderer: func };
      subTheme.options = { renderer: func2 };

      const temaNew = new Tema({ theme: subTheme });

      assert.strictEqual(temaNew.theme.options.renderer, func2);
    });

    it('should not accept circular parent relationships', () => {
      const stub = sinon.stub(console, 'warn');

      parentTheme.parent = subTheme;

      const temaNew = new Tema({ theme: subTheme });

      assert(parentTheme.isPrototypeOf(temaNew.themeTree[0]));
      assert(subTheme.isPrototypeOf(temaNew.themeTree[1]));
      assert.strictEqual(temaNew.themeTree.length, 2);

      assert(stub.calledOnce);
      stub.restore();
    });
  });

  describe('#setTheme()', () => {
    it('should initialize themes that needs to be initialized', () => {
      const initSpy = sinon.spy();
      const temaNew = new Tema();

      temaNew.setTheme({
        templatePath: 'simpleTheme/',
        initializeTheme: initSpy
      });

      assert.strictEqual(initSpy.callCount, 1, 'Theme should have been initialized once');
      assert(initSpy.alwaysCalledWithExactly(temaNew));
    });
  });

  describe('#option()', () => {
    it('should return theme', () => {
      assert(subTheme.isPrototypeOf(temaComplex.option('theme')));
    });

    it('should return option and replace option', () => {
      assert.strictEqual(temaComplex.option('path'), './');

      assert.strictEqual(temaComplex.option('path', 'foo/').option('path'), 'foo/');
    });
  });

  describe('#getPublicPaths()', () => {
    it('should return public paths', () => {
      assert.deepStrictEqual(temaComplex.getPublicPaths(), [
        'subTheme/public/',
        'parentTheme/public/'
      ]);
    });
  });

  describe('defaultTheme', () => {
    it('should rebuild the theme if theme is already set', () => {
      const temaNew = new Tema();
      const spy = sinon.spy(temaNew, 'setTheme');

      temaNew.option('defaultTheme', {});

      assert.strictEqual(spy.callCount, 0);

      temaNew.setTheme(subTheme);

      assert.strictEqual(spy.callCount, 1);

      temaNew.option('defaultTheme', {});

      assert.strictEqual(spy.callCount, 2);
    });

    it('should find template not overriden by active theme', () => {
      const defaultTheme = {
        templates: { default_template: 'defaultPath/default_template' }
      };

      temaComplex.option('defaultTheme', defaultTheme);

      return temaComplex.findTemplate({ template: 'default_template' }).then(options => {
        assert(defaultTheme.isPrototypeOf(options.theme));
        assert.strictEqual(options.toRender, 'defaultPath/default_template');
      });
    });

    it('should not find template overriden by active theme', () => {
      const defaultTheme = {
        templates: { foo_bar: 'defaultPath/foo.bar' }
      };

      temaComplex.option('defaultTheme', defaultTheme);

      return temaComplex.findTemplate({ template: 'foo_bar' }).then(options => {
        assert(!defaultTheme.isPrototypeOf(options.theme));
        assert.notStrictEqual(options.toRender, 'defaultPath/foo.bar');
      });
    });
  });

  describe('cache', () => {
    it('should not cache anything by default', () => {
      temaSimple.setCache('foo', '123');
      assert.strictEqual(temaSimple.getCache('foo'), undefined);
    });

    it('should cache when cache is activated', () => {
      const temaCache = new Tema({
        cache: true,
        theme: {
          templatePath: 'simpleTheme/'
        }
      });

      temaCache.setCache('foo', '123');
      assert.strictEqual(temaCache.getCache('foo'), '123');
      assert.strictEqual(temaCache.getCache('abc'), undefined);
    });

    it('should handle arrays as cache keys', () => {
      const temaCache = new Tema({
        cache: true,
        theme: {
          templatePath: 'simpleTheme/'
        }
      });

      temaCache.setCache(['foo', 'bar'], '123');
      assert.strictEqual(temaCache.getCache(['foo', 'bar']), '123');
      assert.strictEqual(temaCache.getCache('abc'), undefined);
    });
  });

  describe('#preprocess()', () => {
    it('should process preprocessors and processors in correct order', () => {
      const spies = [
        sinon.spy(parentTheme, 'preprocessor'),
        sinon.spy(subTheme, 'preprocessor'),
        sinon.spy(parentTheme.preprocessors, 'foo_bar'),
        sinon.spy(subTheme.preprocessors, 'foo_bar'),
        sinon.spy(parentTheme, 'processor'),
        sinon.spy(subTheme, 'processor'),
        sinon.spy(parentTheme.processors, 'foo_bar'),
        sinon.spy(subTheme.processors, 'foo_bar')
      ];

      return temaComplex.preprocess('foo_bar', {})
        .then(() => {
          let order;

          spies.forEach(spy => {
            assert(spy.calledOnce);

            let data;

            if (order) {
              data = order++;
            } else {
              order = 1;
            }

            assert.strictEqual(data, spy.firstCall.args[0].template ? spy.firstCall.args[0].variables.order : spy.firstCall.args[0].order);
          });
        });
    });

    it("should work when there's no preprocessors and processors", () => {
      temaSimple.preprocess('foo_bar', {});
    });

    it('should not call processors right away', () => {
      const spy = sinon.spy(parentTheme, 'preprocessor');

      temaComplex.preprocess('foo_bar', {});

      assert(!spy.called);
    });

    it('should handle promise based preprocess functions', () => {
      const preprocessStub = sinon.stub(parentTheme, 'preprocessor');

      preprocessStub.resolvesArg(0);

      return temaComplex.preprocess('foo_bar', {})
        .then(() => {
          assert(preprocessStub.calledOnce);
        });
    });
  });

  describe('#templateFileExists()', () => {
    it('should find the parent template', () => {
      return temaComplex.templateFileExists(temaComplex.getThemeInstance(parentTheme), 'foo_bar')
        .catch(() => assert(false, "Couldn't find template"));
    });

    it('should not find non-existing template', () => {
      return temaComplex.templateFileExists(temaComplex.getThemeInstance(subTheme), 'foo_bar')
        .then(
          () => assert(false, 'Could find template'),
          () => {}
        );
    });

    it('should find the template in subfolder', () => {
      mockFs({
        'parentTheme/bar/foo-foo.html': 'abc123'
      });

      return temaComplex.templateFileExists(temaComplex.getThemeInstance(parentTheme), 'foo_foo')
        .catch(() => assert(false, "Couldn't find template"));
    });

    it('should find the template in subfolder', () => {
      mockFs({
        '/bar/parentTheme/foo-foo.html': 'abc123',
        './foo/subtheme/foo-bar.html': '123abc'
      });

      parentTheme.templatePath = '/bar/parentTheme/';
      subTheme.templatePath = 'subtheme/';
      temaComplex.option('path', './foo/');

      temaComplex.templateFileExists(temaComplex.getThemeInstance(parentTheme), 'foo_foo')
        .then(() => temaComplex.templateFileExists(temaComplex.getThemeInstance(subTheme), 'foo_bar'))
        .catch(() => assert(false, "Couldn't find template"));
    });

    it('should use custom file extension', () => {
      subTheme.options = { templateExtension: 'ejs' };

      const temaNew = new Tema({ theme: subTheme });

      mockFs({
        'subTheme/foo-bar.ejs': 'abc345'
      });

      return temaNew.templateFileExists(temaComplex.getThemeInstance(subTheme), 'foo_bar')
        .catch(() => assert(false, "Couldn't find template"));
    });

    it('should inherit custom file extension', () => {
      parentTheme.options = { templateExtension: 'ejs' };

      const temaNew = new Tema({ theme: subTheme });

      mockFs({
        'subTheme/foo-bar.ejs': 'abc345'
      });

      return temaNew.templateFileExists(temaComplex.getThemeInstance(subTheme), 'foo_bar')
        .catch(() => assert(false, "Couldn't find template"));
    });

    it('should use cache', () => {
      const cacheSpySet = sinon.spy(Tema.prototype, 'setCache');
      const cacheSpyGet = sinon.spy(Tema.prototype, 'getCache');

      const temaNew = new Tema({
        cache: true,
        theme: subTheme
      });

      const themeInstance = temaComplex.getThemeInstance(parentTheme);

      return temaNew.templateFileExists(themeInstance, 'foo_bar')
        .then(() => {
          assert(cacheSpySet.calledWithExactly(['templateFiles', 'parentTheme/'], ['parentTheme/foo-bar.html']));
          assert(cacheSpySet.calledWithExactly(['template', 'parentTheme/', 'foo-bar.html'], 'parentTheme/foo-bar.html'));

          return temaNew.templateFileExists(themeInstance, 'foo_bar');
        })
        .then(() => {
          assert(cacheSpyGet.calledWithExactly(['template', 'parentTheme/', 'foo-bar.html']));
          assert(cacheSpyGet.calledWithExactly(['templateFiles', 'parentTheme/']));
          assert.strictEqual(cacheSpyGet.callCount, 3);
        });
    });
  });

  describe('#findTemplate()', () => {
    it('should check complex variants in right order', () => {
      const spy = sinon.spy(temaComplex, 'templateFileExists');

      return temaComplex.findTemplate({
        template: 'foo_bar',
        variables: {
          templateSuggestions: [ 'bar_foo' ]
        }
      })
        .then(options => {
          assert.strictEqual(spy.callCount, 4);
          assert(parentTheme.isPrototypeOf(options.theme));
          assert.strictEqual(options.toRender, 'parentTheme/foo-bar.html');
        });
    });

    it('should skip checking files for themes with no templatePath', () => {
      delete subTheme.templatePath;

      const spy = sinon.spy(temaComplex, 'templateFileExists');

      return temaComplex.findTemplate({
        template: 'foo_bar',
        variables: {
          templateSuggestions: [ 'bar_foo' ]
        }
      })
        .then(options => {
          assert.strictEqual(spy.callCount, 2);
          assert(parentTheme.isPrototypeOf(options.theme));
          assert.strictEqual(options.toRender, 'parentTheme/foo-bar.html');
        });
    });

    it('should reject the promise if no templates are found', () => {
      delete parentTheme.templatePath;
      delete subTheme.templatePath;

      const spy = sinon.spy(temaComplex, 'templateFileExists');

      return temaComplex.findTemplate({
        template: 'foo_bar',
        variables: {
          templateSuggestions: [ 'bar_foo' ]
        }
      })
        .then(
          () => {}, // TODO: Shouldn't it throw if it doesn't reject?
          err => {
            assert.strictEqual(spy.callCount, 0);
            assert(err);
          }
        );
    });

    it('should stop looking when it have found a template file', () => {
      const spy = sinon.spy(temaComplex, 'templateFileExists');

      mockFs({
        'subTheme/bar-foo.html': 'barfoo123'
      });

      return temaComplex.findTemplate({
        template: 'foo_bar',
        variables: {
          templateSuggestions: [ 'bar_foo' ]
        }
      })
        .then(options => {
          assert.strictEqual(spy.callCount, 1);
          assert(subTheme.isPrototypeOf(options.theme));
          assert.strictEqual(options.toRender, 'subTheme/bar-foo.html');
        });
    });

    it('should find template methods', () => {
      parentTheme.templates = { bar_foo: () => {} };

      const spy = sinon.spy(temaComplex, 'templateFileExists');

      return temaComplex.findTemplate({
        template: 'foo_bar',
        variables: {
          templateSuggestions: [ 'bar_foo' ]
        }
      })
        .then(options => {
          assert.strictEqual(spy.callCount, 1);
          assert(parentTheme.isPrototypeOf(options.theme));
          assert.strictEqual(options.toRender, parentTheme.templates.bar_foo);
        });
    });

    it('should find specified template files', () => {
      subTheme.templates = { foo_bar: 'alternatePath/foo.bar' };

      const spy = sinon.spy(temaComplex, 'templateFileExists');

      return temaComplex.findTemplate({
        template: 'foo_bar',
        variables: {
          templateSuggestions: [ 'bar_foo' ]
        }
      })
        .then(options => {
          assert.strictEqual(spy.callCount, 2);
          assert(subTheme.isPrototypeOf(options.theme));
          assert.strictEqual(options.toRender, 'alternatePath/foo.bar');
        });
    });
  });

  describe('#render()', () => {
    it('should render template', () => {
      const spy1 = sinon.spy(temaComplex, 'preprocess');
      const spy2 = sinon.spy(temaComplex, 'findTemplate');

      return temaComplex.render('foo_bar', {}).then(result => {
        assert(spy1.calledOnce, 'Preprocess done');
        assert(spy2.calledOnce, 'Templated looked for');
        assert.strictEqual(result, 'abc123');
      });
    });

    it('should work without specified variables', () => {
      return temaSimple.render('foo_bar', {}).then(result => {
        assert.strictEqual(result, 'xyz789');
      });
    });

    it('should be possible to add theme later', () => {
      return (new Tema())
        .option('theme', subTheme)
        .render('foo_bar', {})
        .then(result => {
          assert.strictEqual(result, 'abc123');
        });
    });

    it('should be possible to change theme', () => {
      return temaSimple
        .option('theme', subTheme)
        .render('foo_bar', {})
        .then(result => {
          assert.strictEqual(result, 'abc123');
        });
    });

    it('should render template method', () => {
      parentTheme.templates = {
        bar_foo_3: () => Promise.resolve('sommarglass')
      };

      const spy = sinon.spy(parentTheme.templates, 'bar_foo_3');

      return temaComplex.render('foo_bar')
        .then(result => {
          assert(spy.calledOnce);
          assert.strictEqual(result, 'sommarglass');
        });
    });

    it('should use custom renderer', () => {
      const func = () => Promise.resolve('foo123');

      parentTheme.options = { renderer: func };

      const spy = sinon.spy(parentTheme.options, 'renderer');
      const temaNew = new Tema({ theme: subTheme });

      return temaNew.render('foo_bar')
        .then(result => {
          assert(spy.calledOnce);
          assert.strictEqual(result, 'foo123');
        });
    });

    it('should render lodash template', () => {
      const temaNew = new Tema({
        theme: subTheme,
        defaultToPlain: false
      });

      mockFs({
        'parentTheme/foo-bar.html': '<%- name %> Anka'
      });

      return temaNew.render('foo_bar', { name: 'Kalle' })
        .then(result => {
          assert.strictEqual('Kalle Anka', result);
        });
    });

    it('should support block helper in templates', () => {
      const temaNew = new Tema({
        theme: subTheme,
        defaultToPlain: false
      });

      mockFs({
        'parentTheme/foo-bar.html': "<% block('foo', 'bar') %><%= block('foo') %>"
      });

      return temaNew.render('foo_bar')
        .then(result => {
          assert.strictEqual('bar', result);
        });
    });
  });

  describe('#recursiveRenderer()', () => {
    it('should iterate over all children', () => {
      mockFs({
        'parentTheme/123.html': '987 ',
        'parentTheme/234.html': '876 ',
        'parentTheme/345.html': '765 ',
        'parentTheme/456.html': '654 '
      });

      return temaComplex.recursiveRenderer({
        children: [
          { template: '123' },
          { template: '345' },
          {
            children: [
              { template: '234' },
              { template: '456' },
              { empty: 'This does nothing, but that is okay' }
            ]
          }
        ]
      })
        .then(result => {
          assert.strictEqual('987 765 876 654 ', result);
        });
    });

    it('theme override children iteration', () => {
      mockFs({
        'parentTheme/123.html': '987 ',
        'parentTheme/345.html': '765 ',
        'parentTheme/567.html': '543 '
      });

      return temaComplex.recursiveRenderer({
        children: [
          { template: '123' },
          { template: '345' },
          {
            template: '567',
            children: [
              { template: '234' },
              { template: '456' }
            ]
          }
        ]
      })
        .then(result => {
          assert.strictEqual('987 765 543 ', result);
        });
    });

    it('a single missing theme shouldnt break it all', () => {
      const stub = sinon.stub(console, 'warn');

      mockFs({
        'parentTheme/123.html': '987 ',
        'parentTheme/567.html': '543 '
      });

      return temaComplex.recursiveRenderer({
        children: [
          { template: '123' },
          { template: '345' },
          { template: '567' }
        ]
      })
        .then(result => {
          assert.strictEqual('987 543 ', result);

          assert(stub.calledOnce);
          stub.restore();
        });
    });

    it('a prerender should be able to add a postrender', () => {
      const preRender = sinon.spy(element => {
        element.postRenders = [postRender];
        return Promise.resolve(element);
      });
      const postRender = sinon.spy(content => Promise.resolve(content + '6'));

      mockFs({
        'parentTheme/123.html': '987'
      });

      return temaComplex.recursiveRenderer({
        preRenders: [preRender],
        template: '123'
      })
        .then(result => {
          assert(preRender.calledOnce);
          assert(postRender.calledOnce);
          assert.strictEqual('9876', result);
        });
    });

    it('a template wrapper should be able to wrap the response', () => {
      mockFs({
        'parentTheme/123.html': '987'
      });

      subTheme.templates = {
        musse: variables => 'musse ' + variables.content + ' pigg'
      };

      const spy = sinon.spy(subTheme.templates, 'musse');
      const stub = sinon.stub(console, 'warn');

      return temaComplex.recursiveRenderer({
        templateWrappers: ['musse', 'missing-wrapper'],
        template: '123'
      })
        .then(result => {
          assert.strictEqual('musse 987 pigg', result);
          assert(spy.calledOnce);

          assert(stub.calledOnce);
          stub.restore();
        });
    });

    it('should render types', () => {
      subTheme.options.elementTypes = {
        car: {
          brand: 'Volvo'
        }
      };

      const temaNew = new Tema({
        theme: subTheme,
        defaultToPlain: false,
        elementTypes: {
          name: {
            template: 'name'
          },
          car: {
            template: 'car',
            brand: 'Saab'
          }
        }
      });

      const personType = { template: 'person' };

      temaNew.elementType('person', personType);

      mockFs({
        'parentTheme/name.html': '<%= name %> ',
        'parentTheme/person.html': '<%= occupation %> ',
        'parentTheme/car.html': '<%= brand %> <%= model %> '
      });

      return temaNew.recursiveRenderer({
        children: [
          { type: 'name', name: 'Oskar' },
          { type: 'name', name: 'Sixten' },
          { type: 'missing', name: 'Kalle', template: 'name' },
          { type: 'person', occupation: 'Coder' },
          { type: 'car', model: 'P1800' }
        ]
      })
        .then(result => {
          assert.strictEqual('Oskar Sixten Kalle Coder Volvo P1800 ', result);
          assert.strictEqual(temaNew.elementType('person'), personType);
        });
    });

    it('should support block helper the hierarchy', () => {
      const temaNew = new Tema({
        theme: subTheme,
        defaultToPlain: false
      });

      mockFs({
        'parentTheme/123.html': "<% block('foo', 'bar') %>",
        'parentTheme/456.html': "Sibling:<%= block('foo') %>",
        'parentTheme/789.html': "<%= block('foo') %><%- content %><%= block('foo') %>"
      });

      return temaNew.recursiveRenderer({
        templateWrappers: ['789'],
        children: [
          { template: '123' },
          { template: '456' }
        ]
      })
        .then(result => {
          assert.strictEqual('barSibling:bar', result);
        });
    });

    // TODO: Add a test to ensure that a change to variables.variables in a preprocess doesn't travel up to templateWrappers
  });
});
