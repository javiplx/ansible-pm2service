#!/usr/bin/env node

// API documentation : http://pm2.keymetrics.io/docs/usage/pm2-api


var documentation = `
---
module: pm2service

short_description: Manage services with pm2

version_added: "2.2"

description:
    - Manage services running under pm2 service manager

options:
    name:
        description:
            - Name of the application as given to pm2
        required: true
    state:
        description:
            - Directory from where application is executed
        choices: [ started, stopped, absent ]
        default: started
    script:
        description:
            - Script to run
        required: when state is started
    args:
        description:
            - Arguments to pass to the script
    cwd:
        description:
            - The working directory to start the process with
        default: user home directory
    interpreter:
        description:
            - The interpreter for script
        default: node
    interpreter_args:
        description:
            - Arguments to call the interpreter process with

author:
    - Javier Palacios (javiplx@gmail.com)
`;


var pm2 = require('pm2');


// Parse input arguments

var ansible_opts = {};
var module_args = {};

for (var i = 2; i < process.argv.length; i+=2) {
  var key = process.argv[i];
  key.startsWith("_ansible_") ? ansible_opts[key.substring(9)] = process.argv[i+1] : module_args[key] = process.argv[i+1];
  }


// Verify arguments

var arguments = ["name", "state", "script", "args", "cwd", "interpreter", "interpreter_args"];
var unknowns = Object.keys(module_args).filter(function(item){
  // Using the arguments variable causes an error
  return ! ["name", "state", "script", "args", "cwd", "interpreter", "interpreter_args"].includes(item);
  });
if ( unknowns.length != 0 ) {
  console.log(JSON.stringify({"failed": true, "msg": "Unknown arguments: '" + unknowns.join("', '") + "'"}));
  process.exit(1);
  }

if ( ! module_args.name ) {
  console.log(JSON.stringify({"failed": true, "msg": "Missing required argument 'name'"}));
  process.exit(1);
  }

if ( ! module_args.state )
  module_args.state = "started";

if ( module_args.state === "started" && ! module_args.script ) {
  console.log(JSON.stringify({"failed": true, "msg": "When state is 'started' argument 'script' is required"}));
  process.exit(1);
  }

var states = [ "started", "stopped", "absent"];
if ( ! states.includes(module_args.state) ) {
  console.log(JSON.stringify({"failed": true, "msg": "Unknown state '" + module_args.state + "' given"}));
  process.exit(1);
  }


// Get running processes

function parseProcess(name, env){
  return { "name": name,
           "status": env.status,
           "cwd": env.pm_cwd || env.cwd,
           "interpreter": env.exec_interpreter || env.interpreter,
           "interpreterArgs": env.node_args || env.interpreter_args,
           "script": env.pm_exec_path || env.script,
           "args": env.args
           };
  }


var pm2 = require('pm2');

pm2.connect(true, function(err) {
  if (err) {
    console.log(JSON.stringify({"failed": true, "msg": "pm2 error : " + err}));
    pm2.disconnect();
    process.exit(2);
    }

  pm2.describe(module_args.name, function(err, processDescription){
    if (err) {
      console.log(JSON.stringify({"failed": true, "msg": "pm2 error : " + err}));
      pm2.disconnect();
      process.exit(2);
      }

    if ( processDescription.length == 0 ) {
      var service = parseProcess(module_args.name, module_args);

      pm2.start(service, function(err, services) {
        if (err) {
          console.log(JSON.stringify({"failed": true, "msg": "pm2 error : " + err}));
          pm2.disconnect();
          process.exit(2);
          }
        var service = parseProcess(services[0].pm2_env.name, services[0].pm2_env);
        console.log(JSON.stringify({"changed": true, "changes": service}));
        pm2.disconnect();
        });
    } else {
      var service = parseProcess(processDescription[0].name, processDescription[0].pm2_env);

      var result = { "changed": false };

      var changes = Object.keys(module_args).filter(function(name){
        return module_args[name]!=service[name];
      }).reduce(function(result,name){
        ["interpreterArgs", "args"].includes(name)
          ? service[name] = module_args[name].split(" ")
          : service[name] = module_args[name];
        result[name] = module_args[name];
        return result;
        },{});

      if ( Object.keys(changes).length != 0 ) {
        result.changed = true;
        result.changes = changes;
        pm2.restart(service, function(err, services) {
          if (err) {
            console.log(JSON.stringify({"failed": true, "msg": "pm2 error : " + err, "otros": services}));
            pm2.disconnect();
            process.exit(2);
            }
          var service = parseProcess(services[0].pm2_env.name, services[0].pm2_env);
          console.log(JSON.stringify({"changed": true, "changes": service}));
          console.log(JSON.stringify(result));
          pm2.disconnect();
          });
      } else {
        pm2.disconnect();
        }
      }

    });
  });

