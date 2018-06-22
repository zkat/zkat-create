#!/usr/bin/env node
'use strict'
const qw = require('@perl/qw')
const initIt = require('.')

initIt(process.cwd(), `${__dirname}/template`, {
  github: 'iarna',
  namespaces: qw`iarna perl fanfic`
})
console.log('* project initialized')
