"use strict";

import streamqueue from "streamqueue";
import babelify from "babelify";
import browserify from "browserify";
import browserSync from "browser-sync";
import buffer from "vinyl-buffer";
import crypto from "crypto";
import fs from "fs";
import glob from "glob";
import gulp from "gulp";
import gulpLoadPlugins from "gulp-load-plugins";
import merge from "merge-stream";
import path from "path";
import persistify from "persistify";
import runSequence from "run-sequence";
import source from "vinyl-source-stream";
import stylish from "jshint-stylish";
import basename from 'basename';

const $ = gulpLoadPlugins(),
reload = browserSync.reload,
dist = "Server/web",
src = "src",
plugins = `${src}/plugins`,
extensions = `./extensions`,
vendors = "bower_components",
PRODUCTION = typeof $.util.env.production !== "undefined" ? true : false,
DEVEL = !PRODUCTION,
PREPROCESSOR_CONTEXT = {
    context: {
        CONTEXT: PRODUCTION ? "PRODUCTION" : "DEVELOPMENT"
    }
},
externalJsSources = [
    `${vendors}/twin-bcrypt/twin-bcrypt.min.js`,
    `${vendors}/sql.js/js/sql.js`,
    `${vendors}/react/react.${PRODUCTION ? 'min.js' : 'js'}`,
    `${vendors}/react/react-dom.${PRODUCTION ? 'min.js' : 'js'}`,
    `${vendors}/jquery/dist/jquery.js`,
    `${vendors}/enjoyhint/enjoyhint.min.js`,
    `${vendors}/jquery.bipbop/dist/jquery.bipbop.js`,
    `${vendors}/jquery.payment/lib/jquery.payment.js`,
    `${vendors}/jquery-mask-plugin/src/jquery.mask.js`,
    `${vendors}/oauth.io/dist/oauth.min.js`,
    `${vendors}/toastr/toastr.js`,
    `${vendors}/mustache/mustache.js`,
    `${vendors}/moment/min/moment-with-locales.js`,
    `${vendors}/numeral/numeral.js`,
    `${vendors}/numeral/locales/pt-br.js`,
    `${vendors}/material-design-lite/material.js`,
    `${vendors}/pikaday/pikaday.js`,
    `${vendors}/vis/dist/vis.js`,
    `${vendors}/pikaday/plugins/pikaday.jquery.js`,
    `${vendors}/jszip/dist/jszip.min.js`,
    `${vendors}/outdated-browser/outdatedbrowser/outdatedbrowser.js`
],
accuracyJsSources = [
    `${vendors}/jquery/dist/jquery.js`,
    `${vendors}/jquery-mask-plugin/src/jquery.mask.js`,
    `${vendors}/toastr/toastr.js`,
    `${vendors}/moment/min/moment-with-locales.js`,
    `${vendors}/numeral/numeral.js`,
    `${vendors}/numeral/locales/pt-br.js`,
],
ichequesKeystore = "icheques.keystore",
accuracyKeystore = "accuracy.keystore";

function i18n(locale) {
    return gulp.src("src/js/internals/i18n/" + locale + "/**/*.json")
    .pipe($.messageformat({
        locale: locale,
        module: "commonJS"
    }))
    .pipe(gulp.dest("src/js/internals/i18n"))
    .pipe($.size({title: `>>> i18n-${locale}`}));
}

require('gulp-task-list')(gulp);

gulp.task("assets", ["outdatedbrowser:copy-files"], () => {
    return gulp.src([
        "src/assets/**/*"
    ])
    .pipe(gulp.dest(`${dist}/assets`))
    .pipe($.size({title: ">>> assets"}));
});

gulp.task("legal", () => {
    return gulp.src([
        "legal/**/*.pdf"
    ])
    .pipe(gulp.dest(`${dist}/legal`))
    .pipe($.size({title: ">>> legal"}));
});

gulp.task("manifest", () => {
    return gulp.src([
        "manifest*.json",
        "CNAME",
        `${src}/robots.txt`
    ])
    .pipe(gulp.dest(dist))
    .pipe($.size({title: ">>> manifest"}));
});

gulp.task("templates", () => {
    return gulp.src(`${src}/templates/**/*.tpl`)
    .pipe(gulp.dest(`${dist}/templates`))
    .pipe($.size({title: ">>> templates"}));
});

gulp.task("html", () => {
    return gulp.src(`${src}/**/*.html`)
    .pipe($.fileInclude({
        prefix: "@@",
        basepath: "@file"
    }))
    .pipe($.hashSrc({
        build_dir: dist,
        src_path: src
    }))
    .pipe($.htmlhint())
    .pipe($.htmlhint.reporter())
    .pipe($.htmlMinifier({
        collapseWhitespace: true,
        removeComments: true
    }))
    .pipe(gulp.dest(dist))
    .pipe($.size({title: ">>> html"}));
});

gulp.task("i18n-en", () => {
    i18n("en");
});

gulp.task("i18n-pt", () => {
    i18n("pt");
});

gulp.task("i18n", ["i18n-en", "i18n-pt"]);

gulp.task("build:plugins:template", () => {
    return gulp.src(`${plugins}/templates/**/*.html`)
    .pipe($.htmlMinifier({
        collapseWhitespace: true,
        removeComments: true
    }))
    .pipe($.htmlToJs())
    .pipe(gulp.dest(`${plugins}/templates`))
    .pipe($.size({title: ">>> build:plugins:template"}));
});

gulp.task("build:plugins:markdown", () => {
    return gulp.src(`${plugins}/markdown/**/*.md`)
    .pipe($.markdown())
    .pipe($.htmlMinifier({
        collapseWhitespace: true,
        removeComments: true
    }))
    .pipe($.htmlToJs())
    .pipe(gulp.dest(`${plugins}/markdown`))
    .pipe($.size({title: ">>> build:plugins:markdown"}));
});

gulp.task("build:plugins:sql", () => {
    return gulp.src(`${plugins}/sql/**/*.sql`)
    .pipe($.texttojs({
        template: "module.exports = function (controller) { return controller.database.exec(<%= content %>); };"
    }))
    .pipe(gulp.dest(`${plugins}/sql`))
    .pipe($.size({title: ">>> build:plugins:sql"}));
});

gulp.task("build:plugins:css", ["styles"], () => {
    return gulp.src(`${plugins}/styles/**/*.css`)
    .pipe($.autoprefixer())
    .pipe($.importCss())
    .pipe($.cssnano({
        reduceIdents: false,
        mergeIdents: false
    }))
    .pipe($.css2js())
    .pipe(gulp.dest(`${plugins}/styles/`))
    .pipe($.size({title: ">>> build:plugins:css"}));
});

gulp.task("build:plugins:sass", () => {
    return gulp.src(`${plugins}/styles/**/*.scss`)
    .pipe($.sass())
    .pipe($.autoprefixer())
    .pipe($.importCss())
    .pipe($.cssnano({
        reduceIdents: false,
        mergeIdents: false
    }))
    .pipe($.css2js())
    .pipe(gulp.dest(`${plugins}/styles`))
    .pipe($.size({title: ">>> build:plugins:sass"}));
});

gulp.task("build:plugins:styles", ["build:plugins:sass", "build:plugins:css"]);

gulp.task("build:extensions", [
    "build",
], () => {
    let files = glob.sync(`${extensions}/*.json`);
    return merge(files.map((entry) => {
        entry = "./" + entry;
        let extensionName = basename(entry),
            buildDir = `${extensions}/build/${extensionName}`;
        return streamqueue({ objectMode: true },
                gulp.src(["${dist}/**/*", "!manifest*.json"], {base: "${dist}"}),
                gulp.src(entry).pipe($.concat('manifest.json')))
            .pipe($.size({title: ">>> build:extensions"}))
            .pipe(gulp.dest(buildDir));
    }));
});

// Copia os arquivos mobile para a iCheques
gulp.task("outdatedbrowser:copy-files", [], () => {
    return gulp.src([
        `${vendors}/outdated-browser/outdatedbrowser/lang/**/*.html`,
    ])
    .pipe(gulp.dest(`${dist}/outdatedbrowser/lang`))
    .pipe($.size({title: ">>> outdatedbrowser:copy-files"}));
});

gulp.task("build:plugins", [
    "build:plugins:template",
    "build:plugins:markdown",
    "build:plugins:styles",
    "build:plugins:sql",
], () => {
    let files = glob.sync(`${plugins}/*.js`);

    return merge(files.map((entry) => {
        entry = "./" + entry;
        return browserify({
            entries: entry,
            debug: !PRODUCTION
        })
        .transform(babelify, {presets: ["es2015", "react"]})
        .bundle()
        .pipe(source(path.basename(entry)))
        .pipe(buffer())
        .pipe($.if(DEVEL, $.sourcemaps.init({loadMaps: true})))
        .pipe($.if(PRODUCTION, $.stripDebug()))
        .pipe($.if(PRODUCTION, $.uglify()))
        .pipe($.if(DEVEL, $.sourcemaps.write(".")))
        .pipe(gulp.dest(`${dist}/js`))
        .pipe($.size({title: ">>> build:plugins"}));
    }));
});

gulp.task("deploy", () => {
    return gulp.src(`${dist}/**/*`)
    .pipe($.ghPages())
    .pipe($.size({title: "deploy"}));
});

// Mostra HINTS de programação JavaScript
gulp.task("jshint", () => {
    return gulp.src([
        `${src}/js/**/*.js`,
        `!${src}/js/internals/i18n/**/*`,
        `${plugins}/**/*.js`,
        `!${src}/**/*.html.js`
    ])
    .pipe($.jshint({esnext: true}))
    .pipe($.jshint.reporter(stylish))
    .pipe($.size({title: ">>> jshint"}));
});

// Compila os testes da aplicação
gulp.task("build:tests", ["jshint"], () => {
    return browserify({
        entries: `${src}/js/tests/index.js`,
        debug: !PRODUCTION
    })
    .transform(babelify, {presets: ["es2015", "react"]})
    .bundle()
    .pipe(source("index.js"))
    .pipe(buffer())
    .pipe($.addSrc(externalJsSources.concat([
        `${vendors}/chai/chai.js`,
        `${vendors}/mocha/mocha.js`
    ])))
    .pipe($.sourcemaps.init({loadMaps: true}))
    .pipe($.concat("index.js"))
    .pipe($.sourcemaps.write("."))
    .pipe(gulp.dest("test/spec"));
});

// Monta o desempacotador da aplicação
gulp.task("inflate", () => {
    return browserify({
        entries: `${src}/js/app-inflate.js`,
        debug: !PRODUCTION
    })
    .transform(babelify, {presets: ["es2015", "react"]})
    .bundle()
    .pipe(source("app-inflate.js"))
    .pipe(buffer())
    .pipe($.if(DEVEL, $.sourcemaps.init({loadMaps: true})))
    .pipe($.if(PRODUCTION, $.stripDebug()))
    .pipe($.if(PRODUCTION, $.uglify()))
    .pipe($.concat("app-inflate.js"))
    .pipe($.if(DEVEL, $.sourcemaps.write(".")))
    .pipe(gulp.dest(`${dist}/js`))
    .pipe($.size({title: ">>> inflate"}));
});

// Monta o Worker-Service do Chrome
gulp.task("service-worker", () => {
    return browserify({
        entries: `${src}/js/service-worker.js`,
        debug: !PRODUCTION
    })
    .transform(babelify, {presets: ["es2015"]})
    .bundle()
    .pipe(source("service-worker.js"))
    .pipe(buffer())
    .pipe($.if(DEVEL, $.sourcemaps.init({loadMaps: true})))
    .pipe($.if(PRODUCTION, $.stripDebug()))
    .pipe($.if(PRODUCTION, $.uglify()))
    .pipe($.concat("service-worker.js"))
    .pipe($.if(DEVEL, $.sourcemaps.write(".")))
    .pipe(gulp.dest(dist))
    .pipe($.size({title: ">>> service-worker"}));
});

// Cria o loader da aplicação Harlan
gulp.task("build:installer", ["build:application"], () => {
    return browserify({
        entries: `${src}/js/app-installer.js`,
        debug: !PRODUCTION
    })
    .transform(babelify, {presets: ["es2015", "react"]})
    .bundle()
    .pipe(source("app-installer.js"))
    .pipe(buffer())
    .pipe($.if(DEVEL, $.sourcemaps.init({loadMaps: true})))
    .pipe($.if(PRODUCTION, $.stripDebug()))
    .pipe($.if(PRODUCTION, $.uglify()))
    .pipe($.concat("app-installer.js"))
    .pipe($.preprocess({context: {
        COMPRESSED_SIZE: fs.statSync(`${dist}/js/app.js.gz`).size,
        APP_SIZE: fs.statSync(`${dist}/js/app.js`).size,
        MD5: crypto.createHash('md5').update(fs.readFileSync(`${dist}/js/app.js`)).digest("hex")
    }}))
    .pipe($.if(DEVEL, $.sourcemaps.write(".")))
    .pipe(gulp.dest(`${dist}/js`))
    .pipe($.size({title: ">>> build:installer"}));
});

// Copia os arquivos mobile para o Accuracy
gulp.task("app:copy-files:accuracy", () => {
    return gulp.src([
        `${dist}/images/accuracy/icon.png`,
        `${dist}/images/accuracy/text.png`,
        `${dist}/images/gamification.png`,
        `${dist}/accuracy-cordova.html`,
        `${dist}/js/app-accuracy.js`,
        `${dist}/js/accuracy.js`,
        `${dist}/fonts/fontawesome-webfont.eot`,
        `${dist}/css/app.css`,
        `${dist}/fonts/fontawesome-webfont.svg`,
        `${dist}/fonts/FontAwesome.otf`,
        `${dist}/fonts/fontawesome-webfont.woff`,
        `${dist}/fonts/fontawesome-webfont.woff2`,
        `${dist}/fonts/fontawesome-webfont.ttf`,
    ], {base: dist})
    .pipe(gulp.dest("cordova/accuracy/www"))
    .pipe($.size({title: ">>> app:copy-files"}));
});

// Copia os arquivos mobile para a iCheques
gulp.task("app:copy-files", ["app:copy-files:accuracy"], () => {
    return gulp.src([
        `${dist}/**`,
        `!${dist}/images/bg/**/*.{jpg,jpeg}`,
        `!${dist}/js/**/*.{gz,map}`
    ])
    .pipe(gulp.dest("cordova/icheques/www"))
    .pipe($.size({title: ">>> app:copy-files"}));
});

// Compila as aplicações mobile
gulp.task("build:cordova", ["build:app:icheques", "build:app:accuracy"]);

// Compila a aplicação accuracy
gulp.task("build:application:accuracy", ["jshint"], () => {
    return browserify({
        entries: `${src}/js/app-accuracy.js`,
        debug: !PRODUCTION
    })
    .transform(babelify, {presets: ["es2015"]})
    .bundle()
    .pipe(source("app-accuracy.js"))
    .pipe(buffer())
    .pipe($.preprocess(PREPROCESSOR_CONTEXT))
    .pipe($.addSrc(accuracyJsSources))
    .pipe($.if(DEVEL, $.sourcemaps.init({loadMaps: true})))
    .pipe($.if(PRODUCTION, $.stripDebug()))
    .pipe($.if(PRODUCTION, $.uglify()))
    .pipe($.concat("app-accuracy.js"))
    .pipe($.if(DEVEL, $.sourcemaps.write(".")))
    .pipe(gulp.dest(`${dist}/js`))
    .pipe($.pako.gzip())
    .pipe(gulp.dest(`${dist}/js`))
    .pipe($.size({title: ">>> build:application"}));
});

// Compila a aplicação Harlan
gulp.task("build:application:main", ["jshint", "i18n"], () => {
    return browserify({
        entries: `${src}/js/app.js`,
        debug: !PRODUCTION
    })
    .transform(babelify, {presets: ["es2015", "react"]})
    .bundle()
    .pipe(source("app.js"))
    .pipe(buffer())
    .pipe($.preprocess(PREPROCESSOR_CONTEXT))
    .pipe($.addSrc(externalJsSources))
    .pipe($.if(DEVEL, $.sourcemaps.init({loadMaps: true})))
    .pipe($.if(PRODUCTION, $.stripDebug()))
    .pipe($.if(PRODUCTION, $.uglify()))
    .pipe($.concat("app.js"))
    .pipe($.if(DEVEL, $.sourcemaps.write(".")))
    .pipe(gulp.dest(`${dist}/js`))
    .pipe($.pako.gzip())
    .pipe(gulp.dest(`${dist}/js`))
    .pipe($.size({title: ">>> build:application"}));
});

// Compila as aplicações JavaScript
gulp.task("build:application", ["build:application:accuracy", "build:application:main"]);

// Compila as imagens do tipo vetor
gulp.task("build:images:vector", () => {
    return gulp.src([
        `${src}/**/*.svg`
    ])
    .pipe($.newer(dist))
    .pipe(gulp.dest(dist))
    .pipe($.size({title: ">>> build:images:vector"}));
});

// Compila as imagens de fundo JPEG
gulp.task("build:images:backgrounds", () => {
    return gulp.src([
        `${src}/images/bg/**/*.{jpg,jpeg}`
    ])
    .pipe($.newer(`${dist}/images/bg`))
    .pipe($.imageResize({
        width: 4096,
        quality: 0.8,
        format: "jpg"
    }))
    .pipe(gulp.dest(`${dist}/images/bg`))
    .pipe($.size({title: ">>> build:images:backgrounds"}));
});

// Compila as imagens PNG, JPG, GIF e JPEG
gulp.task("build:images:no-vector", () => {
    return gulp.src([
        `${src}/**/*.{png,jpg,gif,jpeg}`,
        `!${src}/images/bg/*.{jpg,jpeg}`
    ])
    .pipe(gulp.dest(dist))
    .pipe($.size({title: ">>> build:images:no-vector"}));
});

gulp.task("build:images", ["build:images:no-vector", "build:images:vector", "build:images:backgrounds"]);

gulp.task("fonts", () => {
    return gulp.src([
        `${vendors}/font-awesome/fonts/**/*`,
        `fonts/**/*`
    ])
    .pipe(gulp.dest(`${dist}/fonts`))
    .pipe($.size({title: ">>> fonts"}));
});

gulp.task("styles", () => {
    return gulp.src([
        `${src}/scss/screen.scss`
    ])
    .pipe($.compass({
        css: `${dist}/css`,
        sass: `${src}/scss`,
        image: `${dist}/images`
    }))
    .pipe(buffer())
    .pipe($.autoprefixer())
    .pipe($.importCss())
    .pipe($.concat("app.css"))
    .pipe($.cssnano({
        reduceIdents: false,
        mergeIdents: false
    }))
    .pipe(gulp.dest(`${dist}/css`))
    .pipe($.size({title: ">>> styles"}))
    .pipe(reload({stream: true}));
});

gulp.task("default", cb => {
    return runSequence("build", "watch", cb);
});

gulp.task("clean", () => {
    return gulp.src(["cordova/*/www"])
        .pipe($.clean({force:true}));
});

gulp.task("build", cb => {
    const leaves = [
        "service-worker",
        "manifest",
        "legal",
        "fonts",
        "assets",
        "styles",
        "templates",
        "html",
        "inflate"
    ];

    return runSequence("clean", "build:images",
        ["build:plugins", "build:installer", "build:tests"],
        leaves,
        cb
    );
});

gulp.task("watch", () => {
    browserSync({
        notify: true,
        open: false,
        port: 3000,
        server: {
            baseDir: [dist]
        }
    });
    gulp.watch("src/js/internals/i18n/**/*.json", () => runSequence("build:installer", reload));
    gulp.watch(["src/scss/*", "src/scss/*.scss"], ["styles"]);
    gulp.watch(["src/js/service-worker.js"], () => runSequence("service-worker", reload));
    gulp.watch([
        "src/js/*.js",
        "src/js/internals/**/*.js",
        "!src/js/service-worker.js",
        "!src/js/app-installer.js",
        "!src/js/app-inflate.js",
        "!src/js/internals/i18n/**/*.js"
    ], () => runSequence("jshint", "build:installer", reload));
    gulp.watch("src/js/app-inflate.js", () => runSequence("jshint", "inflate", reload));
    gulp.watch("src/js/app-installer.js", () => runSequence("jshint", "build:installer", reload));
    gulp.watch("src/js/tests/**/*.js", () => runSequence("jshint", "build:tests", reload));
    gulp.watch(["src/**/*.html", "src/**/*.tpl"], () => runSequence("html", "templates", reload));
    gulp.watch([
        "src/plugins/styles/**/*.{css,scss}",
        "src/plugins/templates/**/*.html",
        "src/plugins/sql/**/*.sql",
        "src/plugins/**/*.js",
        "src/plugins/markdown/**/*.md",
        "!src/plugins/markdown/**/*.js",
        "!src/plugins/templates/**/*.js",
        "!src/plugins/sql/**/*.js",
        "!src/plugins/styles/**/*.js"
    ], () => runSequence("build:plugins", reload));
});

gulp.task("build:app:icheques", ["app:copy-files"],
$.shell.task(`cordova build android --release -- "--keystore=${ichequesKeystore}" --alias=icheques --password=icheques`, {
    cwd: './cordova/icheques'
}));

gulp.task("build:app", ["build:app:icheques", "build:app:accuracy"]);

gulp.task("build:app:accuracy", ["app:copy-files"],
$.shell.task(`cordova build android --release -- "--keystore=${accuracyKeystore}" --alias=accuracy --password=accuracy`, {
    cwd: './cordova/accuracy'
}));

gulp.task("release:app:accuracy", () => {
    return runSequence("build", "build:app:accuracy");
});

gulp.task("release:app:icheques", () => {
    return runSequence("build", "build:app:icheques");
});


gulp.task("install:app:icheques", ["app:copy-files"],
$.shell.task("cordova run android", {
    cwd: './cordova/icheques'
}));

gulp.task("install:app:accuracy", ["app:copy-files"],
$.shell.task("cordova run android", {
    cwd: './cordova/accuracy',
}));

gulp.task("watch:app:accuracy", ["watch"], () => {
    gulp.watch([`${dist}/**/*`], function (event) {
        return runSequence("app:copy-files", "install:app:accuracy");
    });
});

gulp.task("watch:app:icheques", ["watch"], () => {
    gulp.watch([`${dist}/**/*`], function (event) {
        return runSequence("app:copy-files", "install:app:icheques");
    });
});
