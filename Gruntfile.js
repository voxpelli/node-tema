"use strict";

module.exports = function (grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    jshint: {
      files: ['Gruntfile.js', 'lib/**/*.js', 'test/**/*.js', 'examples/**/*.js'],
      options: {
        jshintrc: '.jshintrc'
      }
    },
    watch: {
      jshint : {
        files: ['<%= jshint.files %>'],
        tasks: ['test']
      }
    },
    mocha_istanbul: {
      coverage: {
        src: 'test'
      },
    }
  });

  grunt.loadNpmTasks('grunt-notify');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-mocha-istanbul');

  grunt.registerTask('test', ['jshint', 'mocha_istanbul']);
  grunt.registerTask('default', 'test');
};
