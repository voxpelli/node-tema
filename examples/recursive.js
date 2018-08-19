'use strict';

const Tema = require('../');

const coolTheme = {
  templates: {
    title: variables => {
      variables.block('css', 'original.css');
      return Promise.resolve('Title: ' + variables.value + ' ');
    },
    subtitle: variables => variables.value,
    page: variables => {
      let result = variables.content;
      result += ' CSS: ' + variables.block('css');
      return result;
    }
  },
  options: {
    elementTypes: {
      subtitle: {
        prefix: '---',
        suffix: '---'
      }
    }
  }
};

const temaInstance = new Tema({
  theme: coolTheme,
  defaultToPlain: false,
  elementTypes: {
    title: {
      template: 'title'
    },
    subtitle: {
      template: 'subtitle',
      prefix: '***',
      suffix: '***'
    }
  }
});

temaInstance.recursiveRenderer({
  templateWrappers: ['page'],
  children: [
    { type: 'title', value: 'Hi' },
    { type: 'subtitle', value: 'Welcome!' }
  ]
})
  .then(result => {
    // The rendered result of this will be:
    // 'Title: Hi ---Welcome!--- CSS: original.css'
    // (Which of course isn't very fancy, but can be made much fancier with more code than this example)
    console.log(result);
  })
  .catch(err => {
    // Something bad happened
    console.error(err.stack);
  });
