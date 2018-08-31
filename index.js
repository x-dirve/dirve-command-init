'use strict';

var debug = require('debug')('dirve:init'),
    colors = require('colors'),
    path = require('path'),
    fs = require('fs'),
    inquirer = require('inquirer'),
    Metalsmith = require('metalsmith'),
    rm = require('rimraf'),
    spawn = require('child_process').spawn,
    ejs = require('ejs'),
    localPath = path.join(__dirname, 'node_modules');

// prepend ./node_modules to NODE_PATH
process.env.NODE_PATH = process.env.NODE_PATH ?
    localPath + ':' + process.env.NODE_PATH : localPath;

function log(type, msg, color) {
    color = color || 'grey';
    var pad = Array(Math.max(0, 10 - type.length) + 1).join(' '),
        m = type === 'error' ? type : 'log';
    console[m]((pad + type).green, msg[color]);
}

exports.name = 'init';
exports.usage = '[options]'
exports.desc = 'init dirve project';
exports.register = function (commander) {
    commander
        .option('-d --dest [dest]', 'destination')
        .action(function () {
            var args = Array.prototype.slice.call(arguments),
                options = args.pop(),
                opts = {
                    clean: true,
                    dest: options.dest
                }
            inquirer.prompt([
                {
                    type: 'input',
                    name: 'name',
                    default: 'dirve'
                },
                {
                    type: 'input',
                    name: 'version',
                    default: '1.0.0'
                },
                {
                    type: 'input',
                    name: 'description',
                    default: 'dirve scaffold'
                },
                {
                    type: 'input',
                    name: 'platform',
                    default: 'mobile'
                },
                {
                    type: 'confirm',
                    name: 'init',
                    message: 'init project?',
                    default: true
                }
            ]).then(meta => {
                var dest = path.join(process.cwd(), opts.dest || meta.name)
                var doIt = function() {
                    downloadTemplate('git@git.wxpai.cn:pi-plusplus/pi-scaffold.git', dest).then((src) => {
                        generate(src, dest, meta).then(() => {
                            if (meta.init) {
                                var npm = spawn('./init', {
                                    cwd: dest,
                                    stdio: 'inherit'
                                })
                                npm.on('close', (code) => {
                                    log('log', 'done!')
                                })
                            } else {
                                log('log', 'done!')
                            }
                        })
                    }).catch(err => {
                        log('error', err)
                    })
                }
                try {
                    fs.accessSync(dest, fs.constants.R_OK | fs.constants.W_OK)
                    inquirer.prompt([
                        {
                            type: 'confirm',
                            name: 'overwrite',
                            message: `overwrite exists project?`
                        }
                    ]).then(re => {
                        if (re.overwrite) {
                            rm(dest, doIt)
                        }
                    })
                } catch (err) {
                    doIt()
                }
                
            }).catch(err => {
                log('error', err)
            })
        });
};

function template(files, metalsmith, done) {
    var metadata = metalsmith.metadata();
    Object.keys(files).forEach(file => {
        var ext = path.extname(file)
        if ([
            '.json',
            '.js',
            '.md',
            '.html',
            '.ejs'
        ].indexOf(ext) === -1) return
        var str = files[file].contents.toString()
        files[file].contents = ejs.render(str, metadata, {
            delimiter: '$'
        })
    })
    done()
}

function generate(src, dest, meta) {
    return new Promise((resolve, reject) => {
        Metalsmith(__dirname)
            .source(src)
            .ignore('.git')
            .metadata(JSON.parse(JSON.stringify(meta)))
            .destination(dest)
            .use(template)
            .build(function(err) {
                if (err) {
                    reject(err)
                } else {
                    resolve()
                }
                rm(src, function() {})
            })
    }).catch(err => {
        log('error', err)
    })
}

function downloadTemplate(url, name) {
    var dest = path.join(name, '.template')
    return new Promise((resolve, reject) => {
        var git = spawn('git', ['clone', url, dest], {
            cwd: process.cwd(),
            stdio: 'inherit'
        })
        git.on('close', (code) => {
            resolve(dest)
        })
    })
}
