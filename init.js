#!/usr/bin/env node
'use strict'
const qw = require('@perl/qw')
const initIt = require('.')

initIt(process.cwd(), `${__dirname}/template`, {
  github: 'zkat',
  namespaces: qw`zkat`
})
console.log('* project initialized')
