var gulp = require('gulp');
var bump = require('gulp-bump');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');

var paths = {
  scripts: ['src/**/*.js'],
};

gulp.task('bump', [], function () {
  'use strict';

  return gulp.src('./*.json')
    .pipe(bump({type: 'patch'}))
    .pipe(gulp.dest('./'));
});

gulp.task('minify', [], function () {
  'use strict';

  // Minify and copy all JavaScript (except vendor scripts)
  // with sourcemaps all the way down
  return gulp.src(paths.scripts)
    .pipe(uglify())
    .pipe(concat('angular-fabric.min.js'))
    .pipe(gulp.dest('dist/'));
});

gulp.task('build', [], function () {
  'use strict';

  return gulp.src(paths.scripts)
    .pipe(concat('angular-fabric.js'))
    .pipe(gulp.dest('dist/'));
});

gulp.task('rebuild', ['build', 'minify']);
gulp.task('default', ['rebuild', 'bump']);
