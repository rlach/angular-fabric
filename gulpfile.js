var gulp = require('gulp');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');

var paths = {
  scripts: ['src/**/*.js'],
};

gulp.task('default', [], function() {
  // Minify and copy all JavaScript (except vendor scripts)
  // with sourcemaps all the way down
  return gulp.src(paths.scripts)
    .pipe(uglify())
    .pipe(concat('angular-fabric.min.js'))
    .pipe(gulp.dest('dist/'));
});