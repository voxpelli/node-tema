"use strict";

var Tema = require('../')
  , coolTheme = {
    templates : {
      title : function (variables, callback) {
        variables.block('css', 'original.css');
        callback(null, 'Title: ' + variables.value + ' ');
      },
      subtitle : function (variables, callback) {
        callback(null, variables.value);
      },
      page : function (variables, callback) {
        var result = variables.content;
        result += ' CSS: ' + variables.block('css');
        callback(null, result);
      }
    },
    options : {
      elementTypes : {
        subtitle : {
          prefix : '---',
          suffix : '---'
        }
      }
    }
  }
  , temaInstance;

temaInstance = new Tema({
  theme : coolTheme,
  defaultToPlain : false,
  elementTypes : {
    title : {
      template : 'title'
    },
    subtitle : {
      template : 'subtitle',
      prefix : '***',
      suffix : '***'
    }
  }
});

temaInstance.recursiveRenderer({
  templateWrappers : ['page'],
  children : [
    { type: 'title', value: 'Hi' },
    { type: 'subtitle', value: 'Welcome!' }
  ]
}, function (err, result) {
  // The rendered result of this will be:
  // 'Title: Hi ---Welcome!--- CSS: original.css'
  // (Which of course isn't very fancy, but can be made much fancier with more code than this example)
  console.log(result);
});