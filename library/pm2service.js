#!/usr/bin/env node

// API documentation : http://pm2.keymetrics.io/docs/usage/pm2-api

var pm2 = require('pm2');


// Parse input arguments

var arguments = new Hash(process.argv.slice(2));

var ansible_opts = Object.keys(arguments).filter(function(key){
  arguments[key].startsWith("_");
  });

var module_args = Object.keys(arguments).filter(function(key){
  ! arguments[key].startsWith("_");
  });


var result = { "changed": false }


// Verify required arguments

if ( ! module_args.name ) {
  result.error = "Missing required argument 'name'";
  console.log(JSON.stringify(result));
  process.exit()
  }

