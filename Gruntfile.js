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
        root: './lib',
        coverage: true,
        reportFormats: ['lcovonly']
      },
      basic: {
        src: 'test'
      }
    }
  });

  grunt.loadNpmTasks('grunt-notify');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-mocha-istanbul');

  grunt.registerTask('test', ['jshint', 'mocha_istanbul']);
  grunt.registerTask('default', 'test');

  grunt.event.on('coverage', function(lcov, done){
    if (!process.env.TRAVIS) { return done(); }

    require('coveralls').handleInput(lcov, function(err){
      if (err) {
        return done(err);
      }
      done();
    });
  });
};
