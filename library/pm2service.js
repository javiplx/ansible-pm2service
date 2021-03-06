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


// Although npm automatically installs here, that path is not automatically searched ...
module.paths.push('/usr/lib/node_modules');


var pm2 = require('pm2');


// Parse input arguments

var ansible_opts = {};
var module_args = {};

var input = require('fs').
  readFileSync(process.argv[2], 'utf8').
  trim();

if ( input )
  input.split(" ").
    reduce(function(result, item){
      if ( item.includes("=") )
        result.push(item);
      else {
        if ( ! result[result.length-1].endsWith("=") )
          result[result.length-1] += " ";
        result[result.length-1] += item;
        }
      return result;
      }, []).
    forEach(function(item){
      var kv = item.split("=");
      if ( kv[1].startsWith("'") && kv[1].endsWith("'") )
        kv[1] = kv[1].substring(1, kv[1].length-1);
      if( kv[0].startsWith("_ansible_") )
          ansible_opts[kv[0].substring(9)] = kv[1]
        else
          module_args[kv[0]] = kv[1];
      });


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
  if ( typeof env === 'undefined' ) {
    // name is actually "process" with embedded pm2_env property
    var env_name = name.name;
    env = name.pm2_env;
    name = env_name;
    }
  return { "name": name,
           "status": env.status,
           "cwd": env.pm_cwd || env.cwd,
           "interpreter": env.exec_interpreter || env.interpreter,
           "interpreterArgs": env.node_args && env.node_args.join(" ") || env.interpreter_args,
           "script": env.pm_exec_path || env.script,
           "args": typeof env.args === "object" ? env.args.join(" ") : env.args
           };
  }


function exit_json(result) {
  console.log(JSON.stringify(result));
  pm2.disconnect();
  process.exit(0);
  }

function fail_json(err) {
  console.log(JSON.stringify({"failed": true, "msg": "pm2 error : " + err}));
  pm2.disconnect();
  process.exit(2);
  }


var pm2 = require('pm2');

pm2.connect(true, function(err) {
  if (err) fail_json(err);

  pm2.describe(module_args.name, function(err, processDescription){
    if (err) fail_json(err);

    if ( processDescription.length == 0 ) {
      if ( module_args.state == "started" ) {
        pm2.start(parseProcess(module_args.name, module_args), function(err, apps) {
          if (err) fail_json(err);
          exit_json({"changed": true, "changes": parseProcess(apps[0])});
          });
      } else { // stopped is considered valid for a non existing service
        exit_json({"changed": false});
      }
    } else {
      if ( module_args.state == "started" ) {
        var service = parseProcess(processDescription[0]);

        var path = require("path");
        if ( ! path.isAbsolute(module_args.script) ) {
          module_args.script = path.join(module_args.cwd || service.cwd, module_args.script)
          }

        var result = { "changed": false };

        var changes = Object.keys(module_args).filter(function(name){
          return module_args[name]!=service[name];
        }).reduce(function(result,name){
          ["interpreterArgs", "args"].includes(name)
            ? service[name] = module_args[name].split(" ")
            : service[name] = module_args[name];
          if ( name != "state" )
            result[name] = module_args[name];
          return result;
          },{});

        if ( Object.keys(changes).length != 0 ) {
          result.changed = true;
          result.changes = changes;
          result.changes.state = "restarted";
          pm2.restart(service, function(err, apps) {
            if (err) fail_json(err);
            exit_json(result);
            });
        } else {
          exit_json(result);
          }
      } else {
        var result = { "changed": true , "changes": { "state": module_args.state } };
        if ( module_args.state == "stopped" ) {
          pm2.stop(module_args.name, function(err) {
            if (err) fail_json(err);
            exit_json(result);
            });
        } else { // absent
          pm2.delete(module_args.name, function(err) {
            if (err) fail_json(err);
            exit_json(result);
            });
          }
        }
      }

    });
  });

