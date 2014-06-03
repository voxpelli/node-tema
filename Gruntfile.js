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
      options: {
        root: './lib'
      },
      basic: {
        src: 'test'
      },
      coveralls: {
        src: 'test',
        options: {
          coverage: true,
          reportFormats: ['lcovonly']
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-notify');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-mocha-istanbul');

  grunt.registerTask('travis', ['jshint', 'mocha_istanbul:coveralls']);
  grunt.registerTask('test', ['jshint', 'mocha_istanbul:basic']);
  grunt.registerTask('default', 'test');

  grunt.event.on('coverage', function(lcov, done){
    require('coveralls').handleInput(lcov, function(err){
      if (err) {
        return done(err);
      }
      done();
    });
  });
};
