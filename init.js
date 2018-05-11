#!/usr/bin/env node
'use strict'
const initIt = require('.')

initIt(process.cwd(), `${__dirname}/template`, {github: 'iarna'})
console.log('* project initialized')
