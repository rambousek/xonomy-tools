#!/usr/bin/env node
var fs = require('fs');
var parser = require('fast-xml-parser');

var detx = require('../detect/detect.js');
var d2x = require('../dtdconvert/dtd2xonomy.js');

var inputFile = process.argv[2];
fs.readFile(inputFile, 'utf8', function(err,data) {
  if (err) throw err;
  var xmlStruct = detx.detectSchema(data, parser);
  var Xema = d2x.struct2Xema(xmlStruct);
  console.log(JSON.stringify(Xema, undefined, 1));
});
