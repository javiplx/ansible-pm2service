#!/usr/bin/env node

// API documentation : http://pm2.keymetrics.io/docs/usage/pm2-api

var pm2 = require('pm2');


// Parse input arguments

var ansible_opts = {};
var module_args = {};

for (var i = 2; i < process.argv.length; i+=2) {
  var key = process.argv[i];
  key.startsWith("_ansible_") ? ansible_opts[key.substring(9)] = process.argv[i+1] : module_args[key] = process.argv[i+1];
  }


// Verify required arguments

if ( ! module_args.name ) {
  console.log(JSON.stringify({"failed": true, "msg": "Missing required argument 'name'"}));
  process.exit(1);
  }

