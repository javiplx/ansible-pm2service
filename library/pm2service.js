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


// Get running processes

function parseProcess(process){
  return { "name": process.name,
           "status": process.pm2_env.status,
           "cwd": process.pm2_env.pm_cwd,
           "interpreter": process.pm2_env.exec_interpreter,
           "interpreterArgs": process.pm2_env.node_args,
           "script": process.pm2_env.pm_exec_path,
           "args": process.pm2_env.args
           };
  }


var pm2 = require('pm2');

pm2.connect(true, function(err) {
  if (err) {
    console.log(JSON.stringify({"failed": true, "msg": "pm2 error : " + err}));
    process.exit(2);
    }

  var services = [];

  pm2.list(function(err, processDescriptionList){
    if (err) {
      console.log(JSON.stringify({"failed": true, "msg": "pm2 error : " + err}));
      process.exit(2);
      }
    processDescriptionList.forEach(function(process){
      services.push(parseProcess(process));
      });
    var service = services.filter(function(item){return item.name===module_args.name})[0];

    var result = { "changed": false };

    var changes = Object.keys(module_args).filter(function(name){
      return module_args[name]!=service[name];
    }).reduce(function(result,name){
      result[name] = module_args[name];
      return result;
      },{});

    pm2.disconnect();

    if ( Object.keys(changes).length != 0 ) {
      result.changed = true;
      result.changes = changes;
      }
    console.log(JSON.stringify(result));

    });

  });

