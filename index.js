'use strict'
const fs = require('fs')
const qr = require('@perl/qr')
const qx = require('@perl/qx').sync
const system = require('@perl/system').sync
const hostedGitInfo = require('hosted-git-info')
const readFile = fs.readFileSync
const writeFile = fs.writeFileSync
const exists = fs.existsSync

module.exports = (pkg, template, defaults) => {
  if (!defaults) defaults = {}
  let pjson = {}
  try {
    pjson = JSON.parse(readFile(`${pkg}/package.json`))
  } catch (_) {
  }
  let tjson = {}
  try {
    tjson = JSON.parse(readFile(`${template}/package.json`))
  } catch (_) {
  }

  if (!pjson.name) {
    const [, scope, name] = pkg.match(qr`(?:(@[^\\/]+)[\\/])?([^\\/]+)$`)
    pjson.name = (scope ? scope + '/' : '') + name
    console.error('name:', pjson.name)
  }

  if (!pjson.author) {
    let author = defaults.author || tjson.author || ''
    if (!author) {
      const email = defaults.email || npmConfig()['init-author-email']
      const name = defaults.name || npmConfig()['init-author-name']
      const url = defaults.url || npmConfig()['init-author-url']
      if (name) author += name
      if (author) author += ' '
      if (email) author += `<${email}>`
      if (author) author += ' '
      if (url) author += `(${url})`
    }
    pjson.author = author
    console.error('author:', pjson.author)
  }
  if (!pjson.license) {
    pjson.license = defaults.license || tjson.license || npmConfig()['init-license'] || 'ISC'
    console.error('license:', pjson.license)
  }

  if (pjson.license && !exists(`${pkg}/LICENSE`)) {
    let data = readFile(`${template}/LICENSE-${pjson.license}`, 'utf8')
    let copyright = defaults.copyright
    if (!copyright) {
      if (pjson.author) {
        if (pjson.author.name) {
          copyright = pjson.author.name
        } else {
          [, copyright] = pjson.author.match(qr`^([^<(]+)`)
          if (copyright) copyright = copyright.trim().replace(/^"(.*)"$/, '$1')
        }
      }
    }
    if (copyright) data = `Copyright ${copyright}\n\n${data}`
    writeFile(`${pkg}/LICENSE`, data)
    console.error('~:', 'created LICENSE')
  }
  if (!exists(`${pkg}/PULL_REQUEST_TEMPLATE`)) {
    writeFile(`${pkg}/PULL_REQUEST_TEMPLATE`, readFile(`${template}/PULL_REQUEST_TEMPLATE`))
    console.error('~:', 'created PULL_REQUEST_TEMPLATE')
  }
  if (!exists(`${pkg}/.gitignore`)) {
    writeFile(`${pkg}/.gitignore`, readFile(`${template}/gitignore`))
    console.error('~:', 'created .gitignore')
  }

  if (tjson.scripts) {
    if (!pjson.scripts) pjson.scripts = {}
    Object.keys(tjson.scripts).forEach(script => {
      if (!pjson.scripts[script]) {
        pjson.scripts[script] = tjson.scripts[script]
        console.error(`script.${script}:`, pjson.scripts[script])
      }
    })
  }

  if (tjson.devDependencies) {
    if (!pjson.devDependencies) pjson.devDependencies = {}
    Object.keys(tjson.devDependencies).forEach(dep => {
      if (!pjson.devDependencies[dep]) {
        pjson.devDependencies[dep] = tjson.devDependencies[dep]
        console.error(`devDependency.${dep}:`, pjson.devDependencies[dep])
      }
    })
  }
  if (!pjson.repository) {
    if (defaults.repository) {
      pjson.repository = defaults.repository
      if (pjson.repository.type) console.error(`repository.type:`, pjson.repository.type)
      if (pjson.repository.url) console.error(`repository.url:`, pjson.repository.url)
    } else {
      pjson.repository = {}
    }
  }
  if (!pjson.repository.type) {
    pjson.repository.type = 'git'
    console.error(`repository.type:`, pjson.repository.type)
  }
  const repoType = pjson.repository.type
  if (repoType === 'git' && !pjson.repository.url) {
    if (exists(`${pkg}/.git`)) {
      pjson.repository.url = qx`git remote get-url origin`.trim()
    }
    if (!pjson.repository.url && defaults.github) {
      const reponame = pjson.name.replace(/\W/g, '-').replace(/-+/g, '-').replace(/^-|-$/, '')
      pjson.repository.url = `https://github.com/${defaults.github}/${reponame}.git`
    } else {
      delete pjson.repository.url
    }
    if (pjson.repository.url) console.error(`repository.url:`, pjson.repository.url)
  }
  let repo
  try {
    repo = pjson.repository.url && hostedGitInfo.fromUrl(pjson.repository.url)
    if (!pjson.bugs) {
      pjson.bugs = repo.bugs()
      console.error(`bugs:`, pjson.bugs)
    }
    if (!pjson.homepage) {
      pjson.homepage = `https://npmjs.com/package/${pjson.name}`
      console.error(`homepage:`, pjson.homepage)
    }
  } catch (_) {
  }
  if (!repo) delete pjson.repository

  if (!pjson.description) {
    try {
      pjson.description = extractDescription(readFile(`${pkg}/README.md`, 'utf8'))
      console.error(`description:`, pjson.description)
    } catch (_) {
    }
  }

  writeFile(`${pkg}/package.json`, JSON.stringify(pjson, null, 2) + '\n')

  if (repoType === 'git' && repo && !exists(`${pkg}/.git`)) {
    console.error('~:', 'initializing git')
    const pwd = process.cwd()
    process.chdir(pkg)
    system(`git init`)
    writeFile(`${pkg}/.git/info/exclude`, '*~\n.#*\nDEADJOE\n')
    system(`npm i`)

    system(`git add .`)
    system(`git commit -minitial > /dev/null`)
    system(`git branch -m master latest`)
    if (pjson.scripts['update-coc']) system(`npm run update-coc`)
    if (pjson.scripts['update-contrib']) system(`npm run update-contrib`)
    if (repo) {
      system(`git remote add origin ${repo.ssh()}`)
      const reponame = pjson.name.replace(/\W/g, '-').replace(/-+/g, '-').replace(/^-|-$/, '')
      system(`hub create -d "${pjson.description}" -h ${pjson.homepage} ${reponame}`)
    }
    process.chdir(pwd)
  }
}

let conf
function npmConfig () {
  if (!conf) {
    conf = JSON.parse(qx`npm config ls --json`)
  }
  return conf
}

// Extracts description from contents of a readme file in markdown format
// borrowed from `normalize-package-data
function extractDescription (d) {
  if (!d) return
  if (d === 'ERROR: No README data found!') return
  // the first block of text before the first heading
  // that isn't the first line heading
  d = d.trim().split('\n')
  for (var s = 0; d[s] && d[s].trim().match(/^(#|$)/); s++) {}
  var l = d.length
  for (var e = s + 1; e < l && d[e].trim(); e++) {}
  return d.slice(s, e).join(' ').trim()
}
