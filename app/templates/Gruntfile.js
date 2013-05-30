module.exports = function( grunt ) {
  'use strict';
  require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);
  //
  // Grunt configuration:
  //
  // https://github.com/cowboy/grunt/blob/master/docs/getting_started.md
  //
  grunt.initConfig({

    // Project configuration
    // ---------------------

    // default watch configuration
    watch: {
      reload: {
        files: [
          'app/wp-content/themes/<%= themeName %>/**/*.php',
          'app/wp-content/themes/<%= themeName %>/theme/assets/stylesheets/**/*.scss',
          'app/wp-content/themes/<%= themeName %>/theme/assets/javascripts/**/*.js',
          'app/wp-content/themes/<%= themeName %>/assets/images/**/*'
        ],
        tasks: 'build'
      }
    },

    // compile .scss to .css 
    sass: {
      dev: {
        files: [{
          expand: true,        // Enable dynamic expansion.
          cwd: 'app/wp-content/themes/<%= themeName %>/theme/assets/stylesheets',  // Src matches are relative to this path.
          src: ['*.scss', '!_*.scss'],     // Actual pattern(s) to match.
          dest: 'app/wp-content/themes/<%= themeName %>/assets/stylesheets',  // Destination path prefix.
          ext: '.css'         // Dest filepaths will have this extension.
        }]
      }
    },

    copy: {
      js: {
        files: [
          {
            expand: true,
            cwd: 'app/wp-content/themes/<%= themeName %>/theme/assets/javascripts/',
            src: ['**'],
            dest: 'app/wp-content/themes/<%= themeName %>/assets/javascripts/'
          }
        ]
      }
    },

    // default lint configuration, change this to match your setup:
    // https://github.com/cowboy/grunt/blob/master/docs/task_lint.md#lint-built-in-task
    lint: {
      files: [
        //'Gruntfile.js',
        'app/wp-content/themes/<%= themeName %>/theme/assets/javascripts/**/*.js'
      ]
    },

    // specifying JSHint options and globals
    // https://github.com/cowboy/grunt/blob/master/docs/task_lint.md#specifying-jshint-options-and-globals
    jshint: {
      options: {
        curly: true,
        eqeqeq: true,
        immed: true,
        latedef: true,
        newcap: true,
        noarg: true,
        sub: true,
        undef: true,
        boss: true,
        eqnull: true,
        browser: true
      },
      globals: {
        jQuery: true
      }
    },

    // Build configuration
    // -------------------

    // rjs configuration. You don't necessarily need to specify the typical
    // `path` configuration, the rjs task will parse these values from your
    // main module, using http://requirejs.org/docs/optimization.html#mainConfigFile
    //
    // name / out / mainConfig file should be used. You can let it blank if
    // you're using usemin-handler to parse rjs config from markup (default
    // setup)
    rjs: {
      // no minification, is done by the min task
      mainFile: './wp-content/themes/<%= themeName %>/footer.php',
      optimize: 'none',
      baseUrl: './wp-content/themes/<%= themeName %>/js',
      wrap: true,
      name: 'main',
      out: 'wp-content/themes/<%= themeName %>/js/script.js'
    },

    shell: {
      wpInit: {
        command: [
            'mysql --port=13306 -u root -e "CREATE DATABASE IF NOT EXISTS <%= themeName %>_development;' +
            'GRANT ALL ON <%= themeName %>_development.* TO \'<%= themeName %>_dev\'@\'localhost\' IDENTIFIED BY \'<%= randomPassword %>\' WITH GRANT OPTION;' +
            'FLUSH PRIVILEGES;"',
            'chmod 0777 app/wp-content/themes/<%= themeName %>/tmp',
            'cd app && wp core install --url=<%= themeName %>.dev --title=<%= themeName %> --admin_name=admin --admin_email=greg@good-twin.com --admin_password=goodtwin',
            'wp plugin activate wordless',
            'wp theme activate <%= themeName %>'
        ].join('&&'),
        options: {
            stdout: true
        }
      },
      devDbDump: {
        command: [
            'mkdir -p db',
            'mysqldump <%= themeName %>_development --user=<%= themeName %>_dev --password=<%= randomPassword %> --socket=/opt/boxen/data/mysql/socket --result-file db/<%= new Date().getTime() %>_dev.sql',
            'cp -f db/<%= new Date().getTime() %>_dev.sql db/dev.sql'
        ].join('&&'),
        options: {
            stdout: true
        }
      }
    }

  });

  grunt.registerTask('default', ['watch']);
  
  grunt.registerTask('build', ['sass:dev', 'copy']);
  
  grunt.registerTask('wp-init', 'shell:wpInit');

  grunt.registerTask('dev-db-dump', 'shell:devDbDump');

};
