#!/usr/bin/env node
var fs = require('fs');
var d2x = require('./dtd2xonomy.js');

var inputFile = process.argv[2];
console.log(inputFile);
fs.readFile(inputFile, 'utf8', function(err,data) {
  if (err) throw err;
  d2x.dtd2xonomy(data);
});
