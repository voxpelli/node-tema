/* global beforeEach, afterEach, describe, it */

"use strict";

var assert = require('assert')
  , sinon = require('sinon')
  , mockFs = require('mock-fs')
  , _ = require('lodash')
  , Tema = require('../');

describe('Tema', function () {
  var temaComplex, temaSimple, simpleCallback, advancedCallback, subTheme, parentTheme, sandbox;

  beforeEach(function () {
    simpleCallback = function (data, callback) {
      data = _.extend({}, data);
      var variables = data;
      if (data.template) {
        variables = data.variables = _.extend({}, data.variables);
      }

      variables.order = variables.order ? variables.order + 1 : 1;
      callback(null, data);
    };

    advancedCallback = function (data, callback) {
      simpleCallback(data, function (err, data) {
        data = _.extend({}, data);
        var variables = data;
        if (data.template) {
          variables = data.variables = _.extend({}, data.variables);
        }

        variables.templateSuggestions = variables.templateSuggestions || [];
        variables.templateSuggestions.push('bar_foo_' + variables.order);
        callback(err, data);
      });
    };

    parentTheme = {
      name: 'parent',
      templatePath : 'parentTheme/',
      publicPath : 'parentTheme/public/',
      preprocessor : simpleCallback,
      processor : simpleCallback,
      preprocessors : {
        'foo_bar' : advancedCallback
      },
      processors : {
        'foo_bar' : simpleCallback
      }
    };

    subTheme = {
      name: 'child',
      parent : parentTheme,
      templatePath : 'subTheme/',
      publicPath : 'subTheme/public/',
      preprocessor : simpleCallback,
      processor : simpleCallback,
      preprocessors : {
        'foo_bar' : simpleCallback
      },
      processors : {
        'foo_bar' : simpleCallback
      },
      options: {}
    };

    temaComplex = new Tema({
      theme : subTheme
    });

    temaSimple = new Tema({
      theme : {
        templatePath : 'simpleTheme/'
      }
    });

    mockFs({
      'parentTheme/foo-bar.html': 'abc123',
      'simpleTheme/foo-bar.html': 'xyz789',
    });

    sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    mockFs.restore();
    sandbox.restore();
  });

  describe('constructor', function () {
    it('should inherit renderer', function () {
      var temaNew, func = function () {};

      parentTheme.options = { renderer : func };

      temaNew = new Tema({ theme : subTheme });

      assert.equal(temaNew.theme.options.renderer, func);
    });

    it('should be able to overload renderer', function () {
      var temaNew
        , func = function () {}
        , func2 = function () { console.log('wow'); };

      parentTheme.options = { renderer : func };
      subTheme.options = { renderer : func2 };

      temaNew = new Tema({ theme : subTheme });

      assert.equal(temaNew.theme.options.renderer, func2);
    });

    it('should not accept circular parent relationships', function () {
      var stub = sandbox.stub(console, 'warn');

      parentTheme.parent = subTheme;

      var temaNew = new Tema({ theme : subTheme });

      assert(parentTheme.isPrototypeOf(temaNew.themeTree[0]));
      assert(subTheme.isPrototypeOf(temaNew.themeTree[1]));
      assert.equal(temaNew.themeTree.length, 2);

      assert(stub.calledOnce);
      stub.restore();
    });
  });

  describe('#option()', function () {
    it('should return theme', function () {
      assert(subTheme.isPrototypeOf(temaComplex.option('theme')));
    });

    it('should return option and replace option', function () {
      assert.equal(temaComplex.option('path'), './');

      assert.equal(temaComplex.option('path', 'foo/').option('path'), 'foo/');
    });
  });

  describe('#getPublicPaths()', function () {
    it('should return public paths', function () {
      assert.deepEqual(temaComplex.getPublicPaths(), [
        'subTheme/public/',
        'parentTheme/public/'
      ]);
    });
  });

  describe('cache', function () {
    it('should not cache anything by default', function () {
      temaSimple.setCache('foo', '123');
      assert.strictEqual(temaSimple.getCache('foo'), undefined);
    });

    it('should cache when cache is activated', function () {
      var temaCache = new Tema({
        cache: true,
        theme : {
          templatePath : 'simpleTheme/'
        }
      });

      temaCache.setCache('foo', '123');
      assert.strictEqual(temaCache.getCache('foo'), '123');
      assert.strictEqual(temaCache.getCache('abc'), undefined);
    });

    it('should handle arrays as cache keys', function () {
      var temaCache = new Tema({
        cache: true,
        theme : {
          templatePath : 'simpleTheme/'
        }
      });

      temaCache.setCache(['foo', 'bar'], '123');
      assert.strictEqual(temaCache.getCache(['foo', 'bar']), '123');
      assert.strictEqual(temaCache.getCache('abc'), undefined);
    });
  });

  describe('#preprocess()', function () {
    it('should process preprocessors and processors in correct order', function (done) {
      var spies = [
          sandbox.spy(parentTheme, 'preprocessor'),
          sandbox.spy(subTheme, 'preprocessor'),
          sandbox.spy(parentTheme.preprocessors, 'foo_bar'),
          sandbox.spy(subTheme.preprocessors, 'foo_bar'),
          sandbox.spy(parentTheme, 'processor'),
          sandbox.spy(subTheme, 'processor'),
          sandbox.spy(parentTheme.processors, 'foo_bar'),
          sandbox.spy(subTheme.processors, 'foo_bar')
        ];

      temaComplex.preprocess('foo_bar', {});

      process.nextTick(function () {
        var order;

        _.each(spies, function (spy) {
          assert(spy.calledOnce);

          var data;

          if (order) {
            data = order++;
          } else {
            order = 1;
          }

          assert.equal(data, spy.firstCall.args[0].template ? spy.firstCall.args[0].variables.order : spy.firstCall.args[0].order);
        });

        done();
      });
    });

    it("should work when there's no preprocessors and processors", function () {
      temaSimple.preprocess('foo_bar', {});
    });

    it('should not call processors right away', function () {
      var spy = sandbox.spy(parentTheme, 'preprocessor');

      temaComplex.preprocess('foo_bar', {});

      assert(!spy.called);
    });
  });

  describe('#templateFileExists()', function () {
    it('should find the parent template', function (done) {
      temaComplex.templateFileExists(temaComplex.getThemeInstance(parentTheme), 'foo_bar').done(function () {
        done();
      }, function () {
        assert(false, "Couldn't find template");
        done();
      });
    });

    it('should not find non-existing template', function (done) {
      temaComplex.templateFileExists(temaComplex.getThemeInstance(subTheme), 'foo_bar').done(function () {
        assert(false, 'Could find template');
        done();
      }, function () {
        done();
      });
    });

    it('should find the template in subfolder', function (done) {
      mockFs({
        'parentTheme/bar/foo-foo.html': 'abc123',
      });

      temaComplex.templateFileExists(temaComplex.getThemeInstance(parentTheme), 'foo_foo').done(function () {
        done();
      }, function () {
        assert(false, "Couldn't find template");
        done();
      });
    });

    it('should find the template in subfolder', function (done) {
      mockFs({
        '/bar/parentTheme/foo-foo.html': 'abc123',
        './foo/subtheme/foo-bar.html': '123abc',
      });

      parentTheme.templatePath = '/bar/parentTheme/';
      subTheme.templatePath = 'subtheme/';
      temaComplex.option('path', './foo/');

      temaComplex.templateFileExists(temaComplex.getThemeInstance(parentTheme), 'foo_foo').done(function () {
        temaComplex.templateFileExists(temaComplex.getThemeInstance(subTheme), 'foo_bar').done(function () {
          done();
        }, function () {
          assert(false, "Couldn't find template");
          done();
        });
      }, function () {
        assert(false, "Couldn't find template");
        done();
      });
    });

    it('should use custom file extension', function (done) {
      subTheme.options = { templateExtension : 'ejs' };

      var temaNew = new Tema({ theme : subTheme });

      mockFs({
        'subTheme/foo-bar.ejs': 'abc345',
      });

      temaNew.templateFileExists(temaComplex.getThemeInstance(subTheme), 'foo_bar').done(function () {
        done();
      }, function () {
        assert(false, "Couldn't find template");
        done();
      });
    });

    it('should inherit custom file extension', function (done) {
      parentTheme.options = { templateExtension : 'ejs' };

      var temaNew = new Tema({ theme : subTheme });

      mockFs({
        'subTheme/foo-bar.ejs': 'abc345',
      });

      temaNew.templateFileExists(temaComplex.getThemeInstance(subTheme), 'foo_bar').done(function () {
        done();
      }, function () {
        assert(false, "Couldn't find template");
        done();
      });
    });

    it('should use cache', function () {
      var cacheSpySet = sandbox.spy(Tema.prototype, 'setCache');
      var cacheSpyGet = sandbox.spy(Tema.prototype, 'getCache');

      var temaNew = new Tema({
        cache : true,
        theme : subTheme,
      });

      var themeInstance = temaComplex.getThemeInstance(parentTheme);

      return temaNew.templateFileExists(themeInstance, 'foo_bar')
        .then(function () {
          assert(cacheSpySet.calledWithExactly(['templateFiles', 'parentTheme/'], ['parentTheme/foo-bar.html']));
          assert(cacheSpySet.calledWithExactly(['template', 'parentTheme/', 'foo-bar.html'], 'parentTheme/foo-bar.html'));

          return temaNew.templateFileExists(themeInstance, 'foo_bar');
        })
        .then(function () {
          assert(cacheSpyGet.calledWithExactly(['template', 'parentTheme/', 'foo-bar.html']));
          assert(cacheSpyGet.calledWithExactly(['templateFiles', 'parentTheme/']));
          assert.equal(cacheSpyGet.callCount, 3);
        });
    });
  });

  describe('#findTemplate()', function () {
    it('should check complex variants in right order', function (done) {
      var spy = sandbox.spy(temaComplex, 'templateFileExists');

      temaComplex.findTemplate({
        template: 'foo_bar',
        variables: {
          templateSuggestions: [ 'bar_foo' ]
        }
      }).done(function (options) {
        assert.equal(spy.callCount, 4);
        assert(parentTheme.isPrototypeOf(options.theme));
        assert.equal(options.toRender, 'parentTheme/foo-bar.html');
        done();
      }, done);
    });

    it('should skip checking files for themes with no templatePath', function (done) {
      delete subTheme.templatePath;

      var spy = sandbox.spy(temaComplex, 'templateFileExists');

      temaComplex.findTemplate({
        template: 'foo_bar',
        variables: {
          templateSuggestions: [ 'bar_foo' ]
        }
      }).done(function (options) {
        assert.equal(spy.callCount, 2);
        assert(parentTheme.isPrototypeOf(options.theme));
        assert.equal(options.toRender, 'parentTheme/foo-bar.html');
        done();
      }, done);
    });

    it('should reject the promise if no templates are found', function (done) {
      delete parentTheme.templatePath;
      delete subTheme.templatePath;

      var spy = sandbox.spy(temaComplex, 'templateFileExists');

      temaComplex.findTemplate({
        template: 'foo_bar',
        variables: {
          templateSuggestions: [ 'bar_foo' ]
        }
      }).done(function () { done(); }, function (err) {
        assert.equal(spy.callCount, 0);
        assert(err);
        done();
      });
    });

    it('should stop looking when it have found a template file', function (done) {
      var spy = sandbox.spy(temaComplex, 'templateFileExists');

      mockFs({
        'subTheme/bar-foo.html': 'barfoo123',
      });

      temaComplex.findTemplate({
        template: 'foo_bar',
        variables: {
          templateSuggestions: [ 'bar_foo' ]
        }
      }).done(function (options) {
        assert.equal(spy.callCount, 1);
        assert(subTheme.isPrototypeOf(options.theme));
        assert.equal(options.toRender, 'subTheme/bar-foo.html');
        done();
      }, done);
    });

    it('should find template methods', function (done) {
      parentTheme.templates = { bar_foo : function () {} };

      var spy = sandbox.spy(temaComplex, 'templateFileExists');

      temaComplex.findTemplate({
        template: 'foo_bar',
        variables: {
          templateSuggestions: [ 'bar_foo' ]
        }
      }).done(function (options) {
        assert.equal(spy.callCount, 1);
        assert(parentTheme.isPrototypeOf(options.theme));
        assert.equal(options.toRender, parentTheme.templates.bar_foo);
        done();
      }, done);
    });

    it('should find specified template files', function (done) {
      subTheme.templates = { foo_bar : 'alternatePath/foo.bar' };

      var spy = sandbox.spy(temaComplex, 'templateFileExists');

      temaComplex.findTemplate({
        template: 'foo_bar',
        variables: {
          templateSuggestions: [ 'bar_foo' ]
        }
      }).done(function (options) {
        assert.equal(spy.callCount, 2);
        assert(subTheme.isPrototypeOf(options.theme));
        assert.equal(options.toRender, 'alternatePath/foo.bar');
        done();
      }, done);
    });
  });

  describe('#render()', function () {
    it('should render template', function (done) {
      var spy1 = sandbox.spy(temaComplex, 'preprocess')
        , spy2 = sandbox.spy(temaComplex, 'findTemplate');

      temaComplex.render('foo_bar', {}, function (err, result) {
        assert(spy1.calledOnce, 'Preprocess done');
        assert(spy2.calledOnce, 'Templated looked for');
        assert.equal(result, 'abc123');
        done(err);
      });
    });

    it('should work without specified variables', function (done) {
      temaSimple.render('foo_bar', function (err, result) {
        assert.equal(result, 'xyz789');
        done(err);
      });
    });

    it('should be possible to add theme later', function (done) {
      (new Tema())
        .option('theme', subTheme)
        .render('foo_bar', {}, function (err, result) {
          assert.equal(result, 'abc123');
          done(err);
        });
    });

    it('should be possible to change theme', function (done) {
      temaSimple
        .option('theme', subTheme)
        .render('foo_bar', {}, function (err, result) {
          assert.equal(result, 'abc123');
          done(err);
        });
    });

    it('should render template method', function (done) {
      parentTheme.templates = {
        bar_foo_3 : function (options, callback) {
          callback(null, 'sommarglass');
        }
      };

      var spy = sandbox.spy(parentTheme.templates, 'bar_foo_3');

      temaComplex.render('foo_bar', function (err, result) {
        assert(spy.calledOnce);
        assert.equal(result, 'sommarglass');
        done(err);
      });
    });

    it('should use custom renderer', function (done) {
      var temaNew, spy
        , func = function (file, variables, callback) {
          callback(null, 'foo123');
        };

      parentTheme.options = { renderer : func };

      spy = sandbox.spy(parentTheme.options, 'renderer');

      temaNew = new Tema({ theme : subTheme });

      temaNew.render('foo_bar', function (err, result) {
        assert(spy.calledOnce);
        assert.equal(result, 'foo123');
        done(err);
      });
    });

    it('should render lodash template', function (done) {
      var temaNew = new Tema({
        theme : subTheme,
        defaultToPlain : false
      });

      mockFs({
        'parentTheme/foo-bar.html': '<%- name %> Anka'
      });

      temaNew.render('foo_bar', { name : 'Kalle' }, function (err, result) {
        assert.equal('Kalle Anka', result);
        done(err);
      });
    });

    it('should support block helper in templates', function (done) {
      var temaNew = new Tema({
        theme : subTheme,
        defaultToPlain : false
      });

      mockFs({
        'parentTheme/foo-bar.html': "<% block('foo', 'bar') %><%= block('foo') %>"
      });

      temaNew.render('foo_bar', function (err, result) {
        assert.equal('bar', result);
        done(err);
      });
    });
  });

  describe('#recursiveRenderer()', function () {
    it('should iterate over all children', function (done) {
      mockFs({
        'parentTheme/123.html': '987 ',
        'parentTheme/234.html': '876 ',
        'parentTheme/345.html': '765 ',
        'parentTheme/456.html': '654 '
      });

      temaComplex.recursiveRenderer({
        children : [
          { template : '123' },
          { template : '345' },
          {
            children : [
              { template : '234' },
              { template : '456' },
              { empty : 'This does nothing, but that is okay' }
            ]
          }
        ]
      }, function (err, result) {
        assert.equal('987 765 876 654 ', result);
        done(err);
      });
    });

    it('theme override children iteration', function (done) {
      mockFs({
        'parentTheme/123.html': '987 ',
        'parentTheme/345.html': '765 ',
        'parentTheme/567.html': '543 '
      });

      temaComplex.recursiveRenderer({
        children : [
          { template : '123' },
          { template : '345' },
          {
            template : '567',
            children : [
              { template : '234' },
              { template : '456' }
            ]
          }
        ]
      }, function (err, result) {
        assert.equal('987 765 543 ', result);
        done(err);
      });
    });

    it('a single missing theme shouldnt break it all', function (done) {
      var stub = sandbox.stub(console, 'warn');

      mockFs({
        'parentTheme/123.html': '987 ',
        'parentTheme/567.html': '543 '
      });

      temaComplex.recursiveRenderer({
        children : [
          { template : '123' },
          { template : '345' },
          { template : '567' }
        ]
      }, function (err, result) {
        assert.equal('987 543 ', result);

        assert(stub.calledOnce);
        stub.restore();

        done(err);
      });
    });

    it('a prerender should be able to add a postrender', function (done) {
      var preRender = sandbox.spy(function (element, callback) {
          element.postRenders = [postRender];
          callback(null, element);
        })
        , postRender = sandbox.spy(function (content, callback) {
          callback(null, content + '6');
        });

      mockFs({
        'parentTheme/123.html': '987',
      });

      temaComplex.recursiveRenderer({
        preRenders : [preRender],
        template : '123'
      }, function (err, result) {
        assert(preRender.calledOnce);
        assert(postRender.calledOnce);
        assert.equal('9876', result);
        done(err);
      });
    });

    it('a template wrapper should be able to wrap the response', function (done) {
      mockFs({
        'parentTheme/123.html': '987',
      });

      subTheme.templates = {
        musse : function (variables, callback) {
          callback(null, 'musse ' + variables.content + ' pigg');
        }
      };

      var spy = sandbox.spy(subTheme.templates, 'musse')
        , stub = sandbox.stub(console, 'warn');

      temaComplex.recursiveRenderer({
        templateWrappers : ['musse', 'missing-wrapper'],
        template : '123'
      }, function (err, result) {
        assert.equal('musse 987 pigg', result);
        assert(spy.calledOnce);

        assert(stub.calledOnce);
        stub.restore();

        done(err);
      });
    });

    it('should render types', function (done) {
      var temaNew, personType;

      subTheme.options.elementTypes = {
        car : {
          brand : 'Volvo'
        }
      };

      temaNew = new Tema({
        theme : subTheme,
        defaultToPlain : false,
        elementTypes : {
          name : {
            template : 'name'
          },
          car : {
            template : 'car',
            brand : 'Saab'
          }
        }
      });

      personType = { template : 'person' };
      temaNew.elementType('person', personType);

      mockFs({
        'parentTheme/name.html': '<%= name %> ',
        'parentTheme/person.html': '<%= occupation %> ',
        'parentTheme/car.html': '<%= brand %> <%= model %> '
      });

      temaNew.recursiveRenderer({
        children : [
          { type : 'name', name : 'Oskar' },
          { type : 'name', name : 'Sixten' },
          { type : 'missing', name : 'Kalle', template : 'name' },
          { type : 'person', occupation : 'Coder' },
          { type : 'car', model : 'P1800' }
        ]
      }, function (err, result) {
        assert.equal('Oskar Sixten Kalle Coder Volvo P1800 ', result);
        assert.equal(temaNew.elementType('person'), personType);
        done(err);
      });
    });

    it('should support block helper the hierarchy', function (done) {
      var temaNew = new Tema({
        theme : subTheme,
        defaultToPlain : false
      });

      mockFs({
        'parentTheme/123.html': "<% block('foo', 'bar') %>",
        'parentTheme/456.html': "Sibling:<%= block('foo') %>",
        'parentTheme/789.html': "<%= block('foo') %><%- content %><%= block('foo') %>"
      });

      temaNew.recursiveRenderer({
        templateWrappers : ['789'],
        children : [
          { template : '123' },
          { template : '456' }
        ]
      }, function (err, result) {
        assert.equal('barSibling:bar', result);
        done(err);
      });
    });

    //TODO: Add a test to ensure that a change to variables.variables in a preprocess doesn't travel up to templateWrappers
  });
});
