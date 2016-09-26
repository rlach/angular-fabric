var gulp = require('gulp');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');

var paths = {
  scripts: ['src/**/*.js'],
};

gulp.task('minify', [], function () {
  // Minify and copy all JavaScript (except vendor scripts)
  // with sourcemaps all the way down
  return gulp.src(paths.scripts)
    .pipe(uglify())
    .pipe(concat('angular-fabric.min.js'))
    .pipe(gulp.dest('dist/'));
});

gulp.task('build', [], function () {
  // Minify and copy all JavaScript (except vendor scripts)
  // with sourcemaps all the way down
  return gulp.src(paths.scripts)
    .pipe(concat('angular-fabric.js'))
    .pipe(gulp.dest('dist/'));
});

gulp.task('default', ['minify', 'build']);
